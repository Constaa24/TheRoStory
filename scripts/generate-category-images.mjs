#!/usr/bin/env node
/**
 * Smaller versions of the shelf artwork in public/categories, for srcset.
 *
 *     npm install --no-save sharp && node scripts/generate-category-images.mjs
 *
 * Each artwork ships as a 1024px .avif/.webp/.jpg. The Categories page shows
 * them four to a row on a laptop (~270px wide) and the category pages as
 * thumbnails, so every visit downloaded roughly three times the pixels it
 * displayed — Lighthouse put the waste at ~380 KB on the Categories page on
 * a phone. This writes 480px and 768px AVIF and WebP beside each original
 * (`cat_art_new-480.avif` …); lib/category-copy.ts builds the srcset, and the
 * browser picks the smallest that is sharp on the reader's screen. The 1024
 * originals stay as the largest candidate and the JPEG fallback.
 *
 * sharp is not a dependency (it is only needed when the artwork changes), so
 * install it without saving, as above. Re-running overwrites the variants.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed. Run: npm install --no-save sharp");
  process.exit(1);
}

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "categories");
const WIDTHS = [480, 768];

const originals = (await fs.readdir(DIR)).filter((f) => /^[a-z0-9_]+\.jpg$/.test(f));
for (const jpg of originals) {
  const base = jpg.replace(/\.jpg$/, "");
  // The JPEG is the source: it is what the AVIF and WebP were made from.
  const source = sharp(path.join(DIR, jpg));
  for (const width of WIDTHS) {
    const resized = source.clone().resize({ width, withoutEnlargement: true });
    await resized.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(DIR, `${base}-${width}.avif`));
    await resized.clone().webp({ quality: 74 }).toFile(path.join(DIR, `${base}-${width}.webp`));
  }
  console.log(`${base}: ${WIDTHS.join(", ")}`);
}
