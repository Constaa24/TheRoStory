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

type ArticleRow = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  type: string | null;
  title_en: string | null;
  title_ro: string | null;
  media_url: string | null;
  poster_url: string | null;
  media_urls: string[] | null;
};
type CategoryRow = { id: string };

type SitemapImage = { loc: string; title: string };

type UrlEntry = {
  /** Unprefixed in-app path, e.g. "/article/art_123". */
  path: string;
  lastmod?: string | undefined;
  changefreq?: string | undefined;
  priority?: string | undefined;
  /** Per-locale images. Keyed by language because <image:title> is localized. */
  images?: { en: SitemapImage[]; ro: SitemapImage[] } | undefined;
};

const escapeXml = (value: string): string =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

// Mirrors localizedPath in src/lib/locale.ts. Not imported from there: this
// runs on the edge runtime, which does not resolve the app's "@/" alias.
const RO_PREFIX = "/ro";
const localizedPath = (language: "en" | "ro", path: string): string => {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (language !== "ro") return clean;
  return clean === "/" ? RO_PREFIX : `${RO_PREFIX}${clean}`;
};

// Image entries, so the photographs are discoverable in Google Images and can
// carry the story into Discover. For a visual archive that is a first-class
// traffic source, and the sitemap previously advertised 80 pages and zero
// images.
//
// Mirrors src/lib/image-url.ts:storageImage at the `feature` width, not the
// raw object URL. That is deliberate: Google cross-references sitemap image
// URLs against what it finds when it renders the page, and the page now serves
// the resized rendition. Listing the 13 MB original would advertise a URL that
// appears nowhere in the markup.
const OBJECT_MARKER = "/storage/v1/object/public/";
const RENDER_MARKER = "/storage/v1/render/image/public/";
const IMAGE_WIDTH = 1600;

const sizedImage = (url: string): string => {
  if (!url.includes(OBJECT_MARKER)) return url;
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url)) return url;
  const [base, query] = url.replace(OBJECT_MARKER, RENDER_MARKER).split("?");
  const params = new URLSearchParams(query);
  params.set("width", String(IMAGE_WIDTH));
  params.set("quality", "72");
  params.set("format", "webp");
  params.set("resize", "contain");
  return `${base}?${params.toString()}`;
};

// Cover + every carousel frame. A photo essay's frames are the reason anyone
// would find it through image search, so listing only the cover would waste
// most of the opportunity. Videos contribute their poster and never media_url,
// which is the film itself.
const articleImages = (article: ArticleRow, language: "en" | "ro"): SitemapImage[] => {
  const title = (language === "ro" ? article.title_ro : article.title_en)
    || (language === "ro" ? article.title_en : article.title_ro)
    || "";
  const candidates: (string | null)[] = [article.poster_url];
  if (article.type !== "video") candidates.push(article.media_url);
  if (article.media_urls) candidates.push(...article.media_urls);

  const seen = new Set<string>();
  const out: SitemapImage[] = [];
  for (const raw of candidates) {
    if (!raw) continue;
    const loc = sizedImage(raw);
    if (loc === raw && !raw.includes(OBJECT_MARKER)) continue; // not ours to list
    if (seen.has(loc)) continue;
    seen.add(loc);
    out.push({ loc, title });
  }
  // The spec caps image entries at 1000 per <url>; nothing here approaches it,
  // but slice rather than trust the data.
  return out.slice(0, 1000);
};

/**
 * Emits one <url> per locale, each carrying the full reciprocal alternate set.
 *
 * Both entries list both languages *and themselves* — Google discards an
 * hreflang cluster where the annotations aren't mutually confirming, so the
 * self-reference is not redundant. This is how the Romanian half of the
 * archive becomes discoverable at all: before locales were in the URL, one
 * story had one address and only English was ever indexed.
 */
const urlEntries = ({ path, lastmod, changefreq, priority, images }: UrlEntry): string[] => {
  const alternates = [
    `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(SITE_URL + localizedPath("en", path))}"/>`,
    `    <xhtml:link rel="alternate" hreflang="ro" href="${escapeXml(SITE_URL + localizedPath("ro", path))}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(SITE_URL + localizedPath("en", path))}"/>`,
  ];

  return (["en", "ro"] as const).map((language) => {
    const parts = [
      `    <loc>${escapeXml(SITE_URL + localizedPath(language, path))}</loc>`,
      ...alternates,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
      priority ? `    <priority>${priority}</priority>` : null,
      ...(images?.[language] ?? []).map(
        (img) =>
          `    <image:image>
` +
          `      <image:loc>${escapeXml(img.loc)}</image:loc>
` +
          (img.title ? `      <image:title>${escapeXml(img.title)}</image:title>
` : "") +
          `    </image:image>`,
      ),
    ].filter(Boolean);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
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
    `?select=id,created_at,updated_at,type,title_en,title_ro,media_url,poster_url,media_urls&is_published=eq.true&order=created_at.desc,id.asc`;

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
          path: `/article/${article.id}`,
          lastmod: lastmodSource ? new Date(lastmodSource).toISOString().slice(0, 10) : undefined,
          changefreq: "monthly",
          priority: "0.7",
          images: {
            en: articleImages(article, "en"),
            ro: articleImages(article, "ro"),
          },
        };
      });
    } catch (error) {
      console.error("[sitemap] Failed to fetch articles:", error instanceof Error ? error.message : String(error));
    }

    try {
      const categories = await fetchCategories(supabaseUrl, anonKey);
      categoryEntries = categories.map((category) => ({
        path: `/category/${category.id}`,
        changefreq: "weekly",
        priority: "0.6",
      }));
    } catch (error) {
      console.error("[sitemap] Failed to fetch categories:", error instanceof Error ? error.message : String(error));
    }
  }

  const staticEntries: UrlEntry[] = STATIC_ROUTES.map((route) => ({
    path: route.path,
    changefreq: route.changefreq,
    priority: route.priority,
  }));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    // The xhtml namespace is what makes <xhtml:link rel="alternate"> legal
    // here; without the declaration the whole document fails validation.
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...[...staticEntries, ...categoryEntries, ...articleEntries].flatMap(urlEntries),
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
