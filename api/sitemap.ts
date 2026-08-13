// Live sitemap.xml.
//
// This used to be a build artifact: scripts/generate-sitemap.mjs ran in
// `prebuild` and wrote public/sitemap.xml from whatever Supabase held at that
// moment. Two consequences, both invisible until you looked for them —
// publishing a story left it out of the sitemap until the next deploy, and
// editing one never refreshed its <lastmod>, so the site kept telling Google
// "unchanged since the last build" about articles revised days earlier.
//
// Serving it from a function means the sitemap is whatever the database says
// at crawl time. The CDN holds it for an hour (s-maxage) with a day of
// stale-while-revalidate behind that, so crawler traffic costs on the order of
// one Supabase read per hour rather than one per request.
//
// Degradation is deliberate and ordered:
//   1. Normal — static routes + category pages + every published article.
//   2. Supabase unreachable or erroring — static routes only, still HTTP 200,
//      still valid XML. A short sitemap is something Google re-reads next
//      crawl; a 500 teaches it the endpoint is broken.
// That mirrors what the old script did when the env vars were missing, which
// is the behaviour worth keeping from it.
//
// IMPORTANT: nothing may write public/sitemap.xml again. Vercel resolves the
// filesystem before applying the rewrite in vercel.json, so a static file at
// that path would silently shadow this function — the sitemap would look fine
// and be stale, which is the exact bug this replaces.

export const config = { runtime: "edge" };

const SITE_URL = "https://therostory.com";

// Fail fast rather than hold a crawler's connection open. Falling back to the
// static-only sitemap beats a timeout at the CDN.
const FETCH_TIMEOUT_MS = 5000;

const STATIC_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/categories", changefreq: "daily", priority: "0.9" },
  { path: "/map", changefreq: "weekly", priority: "0.8" },
  { path: "/support", changefreq: "monthly", priority: "0.5" },
  { path: "/my-story", changefreq: "monthly", priority: "0.5" },
  { path: "/contact-us", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

type ArticleRow = { id: string; created_at: string | null; updated_at: string | null };
type CategoryRow = { id: string };

type UrlEntry = {
  loc: string;
  lastmod?: string | undefined;
  changefreq?: string | undefined;
  priority?: string | undefined;
};

const escapeXml = (value: string): string =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const urlEntry = ({ loc, lastmod, changefreq, priority }: UrlEntry): string => {
  const parts = [
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
  ].filter(Boolean);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
};

const supabaseFetch = async (
  url: string,
  anonKey: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, ...extraHeaders },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

// PostgREST caps a response at the project's max-rows (1000 here), so page
// with the Range header to stay complete as the archive grows. `id` tiebreaks
// the sort because created_at is not unique — without it, tied rows have no
// guaranteed order between requests and paging can emit a URL twice or drop
// one. count=exact is deliberately not requested: it would force a COUNT(*)
// per page and we only need the batch length to know when to stop.
async function fetchPublishedArticles(supabaseUrl: string, anonKey: string): Promise<ArticleRow[]> {
  const PAGE = 1000;
  const endpoint =
    `${supabaseUrl}/rest/v1/articles` +
    `?select=id,created_at,updated_at&is_published=eq.true&order=created_at.desc,id.asc`;

  const collected: ArticleRow[] = [];
  let from = 0;
  while (true) {
    const res = await supabaseFetch(endpoint, anonKey, { Range: `${from}-${from + PAGE - 1}` });
    if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
    const batch = (await res.json()) as ArticleRow[];
    collected.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (from > 100_000) break; // safety stop, far beyond any plausible count
  }
  return collected;
}

// Category landing pages (/category/:id) are linked from the nav and footer on
// every page, so they belong here alongside the /categories index.
async function fetchCategories(supabaseUrl: string, anonKey: string): Promise<CategoryRow[]> {
  const res = await supabaseFetch(
    `${supabaseUrl}/rest/v1/categories?select=id&order=name_en.asc`,
    anonKey,
  );
  if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
  return (await res.json()) as CategoryRow[];
}

export default async function handler(): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  let articleEntries: UrlEntry[] = [];
  let categoryEntries: UrlEntry[] = [];

  if (!supabaseUrl || !anonKey) {
    console.warn("[sitemap] Supabase env missing — serving static-only sitemap.");
  } else {
    // Independent try/catch per query: a categories failure shouldn't cost us
    // the article URLs, which are the ones that matter for indexing.
    try {
      const articles = await fetchPublishedArticles(supabaseUrl, anonKey);
      articleEntries = articles.map((article) => {
        const lastmodSource = article.updated_at || article.created_at;
        return {
          loc: `${SITE_URL}/article/${article.id}`,
          lastmod: lastmodSource ? new Date(lastmodSource).toISOString().slice(0, 10) : undefined,
          changefreq: "monthly",
          priority: "0.7",
        };
      });
    } catch (error) {
      console.error("[sitemap] Failed to fetch articles:", error instanceof Error ? error.message : String(error));
    }

    try {
      const categories = await fetchCategories(supabaseUrl, anonKey);
      categoryEntries = categories.map((category) => ({
        loc: `${SITE_URL}/category/${category.id}`,
        changefreq: "weekly",
        priority: "0.6",
      }));
    } catch (error) {
      console.error("[sitemap] Failed to fetch categories:", error instanceof Error ? error.message : String(error));
    }
  }

  const staticEntries: UrlEntry[] = STATIC_ROUTES.map((route) => ({
    loc: `${SITE_URL}${route.path}`,
    changefreq: route.changefreq,
    priority: route.priority,
  }));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...staticEntries, ...categoryEntries, ...articleEntries].map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // max-age=0 keeps browsers honest; s-maxage lets the CDN absorb crawler
      // traffic, and stale-while-revalidate means a Supabase blip is served
      // from the last good copy instead of degrading to static-only.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
