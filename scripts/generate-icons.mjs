/**
 * Regenerates every app icon from one master artwork.
 *
 *     node scripts/generate-icons.mjs
 *
 * WHY THIS EXISTS
 *
 * The icons used to be hand-exported, and it showed. Every one of them sat
 * off-centre by the same amount — the artwork's bounding box was 22px from
 * the left of the 512 canvas and 41px from the right, 54 from the top and 67
 * from the bottom — because they had been cropped to the canvas rather than
 * to the art. Worse, they carried the "RoStory" wordmark down to 16x16, where
 * it renders as an unreadable grey smear and, in the navbar, duplicated the
 * typeset "The RoStory" sitting directly beside it.
 *
 * Both problems are the same problem: nothing derived the icons from anything,
 * so they could drift from each other and from the logo. This script is the
 * derivation. `brand/logo-master.png` is the only file a human edits.
 *
 * WHAT IT EMITS  (all into public/)
 *
 *   favicon-16x16.png  favicon-32x32.png  favicon.ico (16/32/48)
 *   apple-touch-icon.png (180)  android-chrome-192x192.png
 *   android-chrome-512x512.png  maskable-icon-512x512.png
 *   logo.png (256)  logo.webp (256)
 *
 * Every one uses the MARK — the illustration alone, no wordmark. Apple's HIG
 * and Android's icon guidance both advise against text in app icons because
 * it is illegible at the sizes they actually render, and the site already
 * spells the name in HTML text next to the logo.
 *
 * HOW IT FINDS THE MARK
 *
 * Nothing is hardcoded. The script measures the master's alpha channel to find
 * the artwork's true bounding box, then locates the widest fully-transparent
 * horizontal band inside it — the gutter between illustration and wordmark —
 * and takes everything above it. Re-draw the logo and the numbers re-derive
 * themselves; hardcoding them would reintroduce exactly the drift this
 * replaces.
 *
 * Requires Playwright (already a devDependency): Chromium is used purely as an
 * image compositor, for its high-quality canvas resampling.
 */

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MASTER = "brand/logo-master.png";
const OUT = "public";

/** Manifest background_color. Opaque grounds must match it exactly. */
const BRAND_BG = "#0d0b08";

/**
 * Jobs. `fill` is the fraction of the canvas the art's long edge occupies.
 *
 * `bg: null` keeps transparency. Two cases deliberately do not:
 *
 *   apple-touch-icon — iOS composites any transparency onto black and applies
 *     its own rounded mask, so shipping an explicit brand-coloured ground is
 *     the difference between a controlled result and a lucky one.
 *
 *   maskable — Android crops to an OS-chosen shape; transparent corners would
 *     show through as holes. fill 0.64 is the constraint that matters here:
 *     the safe zone is a circle of radius 40% (205px of 512), so the art's
 *     half-diagonal must stay inside it. At 0.64 the mark is 328x209, whose
 *     half-diagonal is 194px — inside 205 with room to spare.
 */
const JOBS = [
  { name: "favicon-16x16.png", size: 16, fill: 1.0, bg: null },
  { name: "favicon-32x32.png", size: 32, fill: 1.0, bg: null },
  // For Google Search, which documents that a favicon "should be a multiple
  // of 48px square" and picks among the icons a page declares. Nothing else
  // we declared qualified: 16 and 32 are not multiples of 48, apple-touch is
  // 180, and Google does not read manifest icons — so the 192 that would have
  // been perfect was invisible to it. Google was also rendering our icon
  // upscaled and soft at 128px, which is what having no large source does.
  //
  // fill 0.88 rather than 1.0 because Search masks the favicon to a circle:
  // measured, the mark's furthest ink lands at 44px against a 48px radius.
  { name: "favicon-96x96.png", size: 96, fill: 0.88, bg: null },
  // iOS renders this around 60pt; leave it its own breathing room because iOS
  // adds a corner radius but never any padding.
  { name: "apple-touch-icon.png", size: 180, fill: 0.8, bg: BRAND_BG },
  { name: "android-chrome-192x192.png", size: 192, fill: 0.88, bg: null },
  { name: "android-chrome-512x512.png", size: 512, fill: 0.88, bg: null },
  { name: "maskable-icon-512x512.png", size: 512, fill: 0.64, bg: BRAND_BG },
  // Navbar and footer render this at 42-48px next to the typeset name.
  { name: "logo.png", size: 256, fill: 1.0, bg: null },
  { name: "logo.webp", size: 256, fill: 1.0, bg: null, type: "image/webp" },
];

/** Sizes packed into favicon.ico, in order. */
const ICO_SIZES = [16, 32, 48];

/**
 * Builds a .ico from raw RGBA buffers.
 *
 * Written by hand rather than pulled from a dependency: the format is a
 * fixed-layout header and the alternative is another supply-chain entry for
 * ~40 lines of struct packing. Entries are 32bpp BMP/DIB, matching what the
 * previous favicon.ico shipped — PNG-in-ICO also works in modern browsers,
 * but DIB is what every Windows shell path has always accepted.
 */
function buildIco(images) {
  const dibs = images.map(({ size, rgba }) => {
    const rowBytes = size * 4;
    const xor = Buffer.alloc(rowBytes * size);
    // BMP scanlines run bottom-up, and channels are BGRA rather than RGBA.
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * rowBytes;
      for (let x = 0; x < size; x++) {
        const s = src + x * 4;
        const d = y * rowBytes + x * 4;
        xor[d] = rgba[s + 2];
        xor[d + 1] = rgba[s + 1];
        xor[d + 2] = rgba[s];
        xor[d + 3] = rgba[s + 3];
      }
    }
    // 1bpp AND mask, rows padded to 4 bytes. Left all-zero (fully opaque):
    // every consumer that understands 32bpp reads the alpha channel instead,
    // but the mask must still be present or the entry is malformed.
    const maskRow = Math.ceil(size / 32) * 4;
    const and = Buffer.alloc(maskRow * size);

    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0); // biSize
    header.writeInt32LE(size, 4); // biWidth
    header.writeInt32LE(size * 2, 8); // biHeight — XOR + AND stacked
    header.writeUInt16LE(1, 12); // biPlanes
    header.writeUInt16LE(32, 14); // biBitCount
    header.writeUInt32LE(0, 16); // biCompression = BI_RGB
    header.writeUInt32LE(xor.length + and.length, 20); // biSizeImage

    return { size, data: Buffer.concat([header, xor, and]) };
  });

  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type 1 = icon
  dir.writeUInt16LE(dibs.length, 4);

  let offset = 6 + dibs.length * 16;
  const entries = dibs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 encodes 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });

  return Buffer.concat([dir, ...entries, ...dibs.map((d) => d.data)]);
}

const master =
  "data:image/png;base64," + readFileSync(MASTER).toString("base64");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("about:blank");

const result = await page.evaluate(
  async ({ src, jobs, icoSizes }) => {
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const W = bmp.width;
    const H = bmp.height;
    const source = new OffscreenCanvas(W, H);
    source.getContext("2d").drawImage(bmp, 0, 0);
    const px = source.getContext("2d").getImageData(0, 0, W, H).data;
    const opaque = (x, y) => px[(y * W + x) * 4 + 3] > 12;

    // --- locate the mark, without hardcoding anything ---
    const rowCount = [];
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let x = 0; x < W; x++) if (opaque(x, y)) n++;
      rowCount.push(n);
    }
    const top = rowCount.findIndex((n) => n > 0);
    let bottom = H - 1;
    while (bottom > top && rowCount[bottom] === 0) bottom--;

    // Widest fully-empty band between top and bottom = the gutter under the
    // illustration. If the art has no such band there is no wordmark to drop,
    // and the mark is simply the whole thing.
    let best = null;
    let run = null;
    for (let y = top; y <= bottom; y++) {
      if (rowCount[y] === 0) run = run ?? y;
      else if (run !== null) {
        if (!best || y - run > best[1] - best[0] + 1) best = [run, y - 1];
        run = null;
      }
    }
    const markBottom = best ? best[0] - 1 : bottom;

    let x0 = W,
      x1 = -1,
      y0 = H,
      y1 = -1;
    for (let y = top; y <= markBottom; y++) {
      for (let x = 0; x < W; x++) {
        if (!opaque(x, y)) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };

    // Progressive halving. A single 512 -> 16 drawImage aliases badly however
    // high imageSmoothingQuality is set; halving repeatedly does not.
    const shrink = (sx, sy, sw, sh, dw, dh) => {
      let cur = new OffscreenCanvas(sw, sh);
      cur.getContext("2d").drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
      let cw = sw;
      let ch = sh;
      while (cw > dw * 2 && ch > dh * 2) {
        const nw = Math.max(dw, Math.round(cw / 2));
        const nh = Math.max(dh, Math.round(ch / 2));
        const next = new OffscreenCanvas(nw, nh);
        const ctx = next.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
        cur = next;
        cw = nw;
        ch = nh;
      }
      return { cur, cw, ch };
    };

    const render = (size, fill, bg) => {
      const target = size * fill;
      const scale = Math.min(target / box.w, target / box.h);
      const dw = Math.round(box.w * scale);
      const dh = Math.round(box.h * scale);
      const { cur, cw, ch } = shrink(box.x, box.y, box.w, box.h, dw, dh);
      const out = new OffscreenCanvas(size, size);
      const ctx = out.getContext("2d");
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Centre the CONTENT box. Centring the source canvas is what produced
      // the original off-centre icons.
      ctx.drawImage(cur, 0, 0, cw, ch, (size - dw) / 2, (size - dh) / 2, dw, dh);
      return out;
    };

    const b64 = async (canvas, type) => {
      const blob = await canvas.convertToBlob({ type, quality: 0.95 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (const byte of bytes) s += String.fromCharCode(byte);
      return btoa(s);
    };

    const files = {};
    for (const j of jobs) {
      files[j.name] = await b64(
        render(j.size, j.fill, j.bg),
        j.type || "image/png",
      );
    }

    // Raw RGBA for the .ico, assembled Node-side.
    const ico = {};
    for (const size of icoSizes) {
      const c = render(size, 1.0, null);
      const d = c.getContext("2d").getImageData(0, 0, size, size).data;
      let s = "";
      for (const byte of d) s += String.fromCharCode(byte);
      ico[size] = btoa(s);
    }

    return { files, ico, box, markBottom, gutter: best };
  },
  { src: master, jobs: JOBS, icoSizes: ICO_SIZES },
);

await browser.close();

console.log(
  `mark measured at x${result.box.x} y${result.box.y} ${result.box.w}x${result.box.h}` +
    (result.gutter
      ? `  (wordmark gutter at rows ${result.gutter[0]}-${result.gutter[1]})`
      : "  (no wordmark gutter found — using whole artwork)"),
);

for (const [name, data] of Object.entries(result.files)) {
  const buf = Buffer.from(data, "base64");
  writeFileSync(path.join(OUT, name), buf);
  console.log(`  ${name.padEnd(30)} ${String(buf.length).padStart(7)} B`);
}

const icoBuf = buildIco(
  ICO_SIZES.map((size) => ({
    size,
    rgba: Buffer.from(result.ico[size], "base64"),
  })),
);
writeFileSync(path.join(OUT, "favicon.ico"), icoBuf);
console.log(`  ${"favicon.ico".padEnd(30)} ${String(icoBuf.length).padStart(7)} B`);
