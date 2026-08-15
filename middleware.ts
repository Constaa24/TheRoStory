// Vercel Edge Middleware — social link previews for article pages.
//
// The site is a client-rendered SPA: per-article OG tags are added by React
// at runtime, which social preview bots (Facebook, WhatsApp, X, Discord,
// Slack, …) never execute. Without this middleware every shared article
// shows the generic homepage card. Here we detect those bots on
// /article/:id, fetch the published article from Supabase REST, and return
// a minimal HTML document carrying the article's real title, description,
// image, and canonical URL.
//
// Deliberately NOT matched: Googlebot/Bingbot. They render JavaScript and
// should index the real page; serving them a stripped stand-in would be
// cloaking and would lose the article body.
//
// Fail-open everywhere: any error (missing env, Supabase down, timeout,
// unknown id) falls through to the SPA so humans are never affected.

const SITE_URL = "https://therostory.com";
const SITE_NAME = "The RoStory";
const CHAPTER_DELIMITER = "|||CHAPTER|||";

// Social/link-preview crawlers only (no search engines — see header note).
const PREVIEW_BOT_RE =
  /facebookexternalhit|facebookcatalog|facebot|twitterbot|linkedinbot|whatsapp|slackbot|slack-imgproxy|telegrambot|discordbot|pinterest(bot)?|redditbot|skypeuripreview|vkshare|viber|line-poker|snapchat|iframely|embedly|quora link preview|outbrain|nuzzel|bitlybot|tumblr|bluesky|mastodon|misskey|pleroma|signal-desktop/i;

// Matches both locale trees: /article/:id (English) and /ro/article/:id.
// Capture 1 is the optional "ro" marker, capture 2 the article id.
const ARTICLE_PATH_RE = /^(?:\/(ro))?\/article\/([^/]+)\/?$/;

export const config = {
  matcher: ["/article/:id*", "/ro/article/:id*"],
};

type ArticleRow = {
  id: string;
  title_en: string | null;
  title_ro: string | null;
  content_en: string | null;
  content_ro: string | null;
  type: string | null;
  media_url: string | null;
  poster_url: string | null;
  media_urls: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

const escapeHtml = (input: string): string =>
  input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

// Mirrors src/lib/article-utils.ts:articleExcerpt — strip the chapter
// delimiter and markdown-ish markers, collapse whitespace, clamp length.
const excerpt = (text: string, maxLength: number): string => {
  const clean = text
    .split(CHAPTER_DELIMITER)
    .join(" ")
    .replace(/[#*_>`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength).trimEnd() + "…";
};

// Mirrors src/lib/article-utils.ts:articleCoverUrl — videos never fall back
// to media_url (that's the video file itself, useless as og:image).
const coverUrl = (article: ArticleRow): string => {
  if (article.type === "video") {
    return article.poster_url || `${SITE_URL}/og-image.jpg`;
  }
  if (article.type === "carousel") {
    return article.poster_url || article.media_urls?.[0] || article.media_url || `${SITE_URL}/og-image.jpg`;
  }
  return article.media_url || article.poster_url || `${SITE_URL}/og-image.jpg`;
};

const fetchArticle = async (id: string): Promise<ArticleRow | null> => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const endpoint =
    `${supabaseUrl}/rest/v1/articles` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&is_published=eq.true` +
    `&select=id,title_en,title_ro,content_en,content_ro,type,media_url,poster_url,media_urls,created_at,updated_at` +
    `&limit=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(endpoint, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as ArticleRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const buildHtml = (article: ArticleRow, language: "en" | "ro"): string => {
  // Serve the shared link in the language it was shared in. A /ro/article/x
  // link previously rendered an English card, because the middleware had no
  // notion of locale and always reached for the *_en columns first.
  const primaryTitle = language === "ro" ? article.title_ro : article.title_en;
  const fallbackTitle = language === "ro" ? article.title_en : article.title_ro;
  const primaryBody = language === "ro" ? article.content_ro : article.content_en;
  const fallbackBody = language === "ro" ? article.content_en : article.content_ro;

  const title = escapeHtml(primaryTitle || fallbackTitle || SITE_NAME);
  const description = escapeHtml(
    excerpt(primaryBody || fallbackBody || "", 160) ||
      (language === "ro"
        ? "Povestiri vizuale despre România — cultură, istorie, tradiții și locuri ascunse."
        : "Visual storytelling about Romania — culture, history, traditions, and hidden gems.")
  );
  const image = escapeHtml(coverUrl(article));
  const enUrl = `${SITE_URL}/article/${article.id}`;
  const roUrl = `${SITE_URL}/ro/article/${article.id}`;
  const url = escapeHtml(language === "ro" ? roUrl : enUrl);
  const published = article.created_at ?? "";
  const modified = article.updated_at || article.created_at || "";

  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8" />
<title>${title} — ${SITE_NAME}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${url}" />
<link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}" />
<link rel="alternate" hreflang="ro" href="${escapeHtml(roUrl)}" />
<link rel="alternate" hreflang="x-default" href="${escapeHtml(enUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:locale" content="${language === "ro" ? "ro_RO" : "en_US"}" />
<meta property="og:locale:alternate" content="${language === "ro" ? "en_US" : "ro_RO"}" />
${published ? `<meta property="article:published_time" content="${escapeHtml(published)}" />` : ""}
${modified ? `<meta property="article:modified_time" content="${escapeHtml(modified)}" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
<p><a href="${url}">Read the full story on ${SITE_NAME}</a></p>
</body>
</html>`;
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const userAgent = request.headers.get("user-agent") || "";
  if (!PREVIEW_BOT_RE.test(userAgent)) {
    // Humans (and JS-rendering search crawlers) get the SPA as usual.
    return undefined;
  }

  const { pathname } = new URL(request.url);
  const match = ARTICLE_PATH_RE.exec(pathname);
  if (!match) return undefined;

  const language = match[1] === "ro" ? "ro" : "en";
  const id = decodeURIComponent(match[2]);
  if (!id || id.length > 100) return undefined;

  const article = await fetchArticle(id);
  if (!article) return undefined;

  return new Response(buildHtml(article, language), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Let Vercel's CDN absorb repeat bot fetches for an hour; previews
      // don't need to be fresher than that.
      "Cache-Control": "public, max-age=0, s-maxage=3600",
      "X-Robots-Tag": "noindex",
      Vary: "User-Agent",
    },
  });
}
