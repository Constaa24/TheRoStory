#!/usr/bin/env node
/**
 * Self-hosts the site's three typefaces: downloads them from Google Fonts
 * once, into public/fonts, and writes the @font-face rules to
 * src/styles/fonts.css. Run with `npm run fonts` after changing FAMILIES.
 *
 * Why not link Google Fonts directly, as the site used to:
 *   - Privacy. Every page view sent the reader's IP address to Google, a
 *     transfer the privacy policy never mentioned; European courts have held
 *     that embedding Google Fonts this way breaches the GDPR (LG München I,
 *     3 O 17493/20, January 2022). Same-origin files send nothing anywhere.
 *   - Speed. The Google stylesheet was render-blocking: a DNS lookup, TLS and
 *     a CSS round-trip to fonts.googleapis.com, then another origin for the
 *     files, before text could paint — about 0.9 s on a throttled phone.
 *
 * Only the Latin and Latin Extended subsets are kept: Romanian's ă, ș and ț
 * live in Latin Extended; the Cyrillic, Greek and Vietnamese subsets were
 * never used. The files are variable fonts, so one file per family, style
 * and subset covers every weight.
 *
 * File names carry Google's version (v21, v23…), which is what lets
 * vercel.json serve them as immutable for a year: a new version is a new
 * name. All three families are under the SIL Open Font License 1.1, which
 * permits this; their licenses are saved beside the files, as it requires.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "fonts");
const CSS_OUT = path.join(ROOT, "src", "styles", "fonts.css");

// The same families and weights the site has always requested.
const FAMILIES = [
  "family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700",
  "family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400;1,6..72,500",
  "family=Manrope:wght@300;400;500;600;700",
];
const SUBSETS = ["latin", "latin-ext"];
const LICENSES = {
  "Cormorant Garamond": "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt",
  Newsreader: "https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/OFL.txt",
  Manrope: "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt",
};
// A current browser's user agent, or Google answers with TTF instead of WOFF2.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const get = async (url, as = "text") => {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return as === "buffer" ? Buffer.from(await res.arrayBuffer()) : res.text();
};

const css = await get(`https://fonts.googleapis.com/css2?${FAMILIES.join("&")}&display=swap`);

// "/* latin-ext */ @font-face { … }" — Google labels every block with its subset.
const faces = new Map();
for (const m of css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]*)\}/g)) {
  const [, subset, body] = m;
  if (!SUBSETS.includes(subset)) continue;
  const field = (name) => new RegExp(`${name}:\\s*([^;]+);`).exec(body)?.[1].trim();
  const family = field("font-family").replace(/^'|'$/g, "");
  const style = field("font-style");
  const weight = Number(field("font-weight"));
  const url = /url\((https:[^)]+)\)/.exec(body)[1];
  const key = `${family}|${style}|${subset}`;
  const face = faces.get(key) ?? { family, style, subset, url, unicodeRange: field("unicode-range"), weights: [] };
  if (face.url !== url) throw new Error(`${key}: more than one file — not a variable font any more?`);
  face.weights.push(weight);
  faces.set(key, face);
}
if (!faces.size) throw new Error("No faces parsed — has the Google Fonts CSS format changed?");

await fs.rm(OUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUT_DIR, { recursive: true });

const rules = [];
for (const face of [...faces.values()].sort((a, b) => `${a.family}${a.style}${a.subset}`.localeCompare(`${b.family}${b.style}${b.subset}`))) {
  const version = /\/s\/[^/]+\/(v\d+)\//.exec(face.url)?.[1] ?? "v0";
  const file = `${slug(face.family)}-${face.style}-${face.subset}-${version}.woff2`;
  await fs.writeFile(path.join(OUT_DIR, file), await get(face.url, "buffer"));
  const lo = Math.min(...face.weights);
  const hi = Math.max(...face.weights);
  rules.push(`/* ${face.family} ${face.style}, ${face.subset} */
@font-face {
  font-family: '${face.family}';
  font-style: ${face.style};
  font-weight: ${lo === hi ? lo : `${lo} ${hi}`};
  font-display: swap;
  src: url('/fonts/${file}') format('woff2');
  unicode-range: ${face.unicodeRange};
}`);
  console.log(`fonts/${file}`);
}

for (const [family, url] of Object.entries(LICENSES)) {
  await fs.writeFile(path.join(OUT_DIR, `OFL-${slug(family)}.txt`), await get(url));
}

await fs.writeFile(CSS_OUT, `/* Generated by scripts/fetch-fonts.mjs — run \`npm run fonts\`, don't edit.
   The site's typefaces, self-hosted (see the script for why), under the SIL
   Open Font License 1.1: public/fonts/OFL-*.txt. */
/* stylelint-disable */

${rules.join("\n\n")}
`);
console.log(`\n${faces.size} faces → src/styles/fonts.css`);
