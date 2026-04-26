// Generates public/sitemap.xml at build time, including one entry per
// published article fetched from Supabase. If the Supabase env vars are
// not set, the script logs a warning and leaves the existing fallback
// sitemap in place rather than failing the build.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const SITE_URL = "https://therostory.com";
const OUTPUT = path.join(projectRoot, "public", "sitemap.xml");

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

function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
  ].filter(Boolean);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

async function fetchPublishedArticles(supabaseUrl, anonKey) {
  // Use the REST API directly so we don't need the Supabase JS client at build.
  const endpoint = `${supabaseUrl}/rest/v1/articles?select=id,created_at&is_published=eq.true&order=created_at.desc`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase responded ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  let articleEntries = [];

  if (!supabaseUrl || !anonKey) {
    console.warn(
      "[generate-sitemap] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing — writing static-only sitemap."
    );
  } else {
    try {
      const articles = await fetchPublishedArticles(supabaseUrl, anonKey);
      articleEntries = articles.map((a) => ({
        loc: `${SITE_URL}/article/${a.id}`,
        lastmod: a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : undefined,
        changefreq: "monthly",
        priority: "0.7",
      }));
      console.log(`[generate-sitemap] Included ${articleEntries.length} article URLs.`);
    } catch (err) {
      console.warn("[generate-sitemap] Failed to fetch articles:", err.message);
    }
  }

  const staticEntries = STATIC_ROUTES.map((r) => ({
    loc: `${SITE_URL}${r.path}`,
    changefreq: r.changefreq,
    priority: r.priority,
  }));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...staticEntries, ...articleEntries].map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");

  await fs.writeFile(OUTPUT, xml, "utf-8");
  console.log(`[generate-sitemap] Wrote ${OUTPUT}`);
}

main().catch((err) => {
  console.error("[generate-sitemap] Unexpected error:", err);
  // Don't fail the build — fall back to whatever sitemap is on disk.
  process.exit(0);
});
