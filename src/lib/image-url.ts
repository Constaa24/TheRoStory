/**
 * On-the-fly image resizing for Supabase Storage objects.
 *
 * The bucket holds originals as the writer uploaded them: 63 images averaging
 * 7 MB, the largest 13 MB at 6000x4000. Those were being served to the browser
 * at full size, so an eight-frame photo essay was a ~56 MB page — worse per
 * visit than the films were, because images load on view rather than waiting
 * for a play click.
 *
 * Supabase's render endpoint resizes on request, so nothing has to be
 * re-uploaded and the originals stay untouched for future re-processing.
 * Measured on three real objects totalling 32.6 MB:
 *
 *     width=600   ->  100 KB   (99.7% smaller)
 *     width=1600  ->  571 KB   (98.3% smaller)
 *
 * Three parameter choices, each load-bearing:
 *
 * `resize=contain` — NOT optional, and not the default. Supabase defaults to
 *   `cover`, which with a width and no height returns 600x4000 from a
 *   6000x4000 source: it scales the width and leaves the height alone,
 *   squashing the image. `contain` gives the correct 600x400. Getting this
 *   wrong distorts every photograph on the site.
 *
 * `format=webp` — the endpoint does NOT negotiate on Accept, so without this
 *   a PNG comes back as a PNG, where `quality` barely applies: the 10 MB PNG
 *   is still 1910 KB at 600px as PNG, and 116 KB as WebP. AVIF was measured
 *   too and came out *larger* than WebP on this material (168 KB vs 116 KB),
 *   so WebP it is. Universal browser support since Safari 14; anything that
 *   can run this ES2020 bundle can decode it.
 *
 * `quality=72` — visually indistinguishable from the original at these
 *   display sizes, and the knee of the size curve.
 */

/** Public object URL prefix. Anything else is left alone. */
const OBJECT_MARKER = '/storage/v1/object/public/';
/** The resizing endpoint that replaces it. */
const RENDER_MARKER = '/storage/v1/render/image/public/';

/**
 * Widths per surface, chosen at roughly 2x the CSS box so the result stays
 * crisp on a retina display without needing a srcSet at every call site. At
 * these file sizes (a 600px frame is ~31 KB) the bytes a 1x screen
 * over-fetches are irrelevant next to the 98% already saved.
 */
export const IMAGE_WIDTHS = {
  /** 40-44px avatar circles in the nav, profile and admin table. */
  avatar: 96,
  /** Small thumbs: nav search results, map side panel, story-thumbnail. */
  thumb: 200,
  /** Grid cards, related-reading strip, favourites, editor previews. */
  card: 800,
  /** Home featured spread, article lead image, photo-essay frames, film poster. */
  feature: 1600,
  /** Full-bleed photo-essay hero (100vw). */
  hero: 1920,
} as const;

export type ImageSurface = keyof typeof IMAGE_WIDTHS;

/** Extensions that must never be routed through the image renderer. */
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

/**
 * Rewrites a Supabase Storage public URL to a resized WebP rendition.
 *
 * Passes the input straight through, unchanged, when it is anything other
 * than a transformable storage object — a local asset (`/hero/castle.jpg`,
 * `/logo.png`), a Google OAuth avatar on lh3.googleusercontent.com, a video
 * file, an already-transformed URL, or undefined. That pass-through is the
 * whole safety story: every call site can hand this whatever it has.
 */
export const storageImage = (
  url: string | undefined | null,
  surface: ImageSurface
): string | undefined => {
  if (!url) return undefined;
  // Already rewritten — re-applying would nest the marker and 404.
  if (url.includes(RENDER_MARKER)) return url;
  if (!url.includes(OBJECT_MARKER)) return url;
  // A video's own file. The <video> element needs the real object URL for
  // range requests; the renderer would reject it anyway.
  if (VIDEO_EXT_RE.test(url)) return url;

  const width = IMAGE_WIDTHS[surface];
  const [base, existingQuery] = url.replace(OBJECT_MARKER, RENDER_MARKER).split('?');
  // Preserve any query the caller already had (cache-busting tokens etc.)
  // rather than dropping it on the floor.
  const params = new URLSearchParams(existingQuery);
  params.set('width', String(width));
  params.set('quality', '72');
  params.set('format', 'webp');
  params.set('resize', 'contain');
  return `${base}?${params.toString()}`;
};

/** Open Graph card dimensions. Every major platform targets 1.91:1. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * The og:image rendition: cropped to exactly 1200x630.
 *
 * Social bots were being handed the raw poster — 7.2 MB for the article I
 * measured. Facebook's ceiling is 8 MB and X's is 5 MB, so the larger covers
 * were over the line and those cards would have rendered with no image at all.
 * PageHead also declares `og:image:width` 1200 and `og:image:height` 630, which
 * simply was not true of the original file; a platform that trusts those
 * numbers lays the card out wrong.
 *
 * Two deliberate differences from `storageImage`:
 *
 * `resize=cover` with BOTH dimensions, not `contain`. Here a crop is what we
 *   want — the declared 1200x630 has to be the real output, and a card is a
 *   fixed aspect no matter the source. This is the one case where cover is
 *   correct rather than the trap it is elsewhere.
 *
 * `format=origin`, not webp. WebP would be 45 KB against 1233 KB, but OG
 *   images are fetched once per share by a crawler rather than by every
 *   reader, so the bytes barely matter, while WebP support across every
 *   scraper (LinkedIn in particular) is not something worth betting a share
 *   card on. 1233 KB is comfortably inside every platform's limit.
 */
export const storageOgImage = (url: string | undefined | null): string | undefined => {
  if (!url) return undefined;
  if (url.includes(RENDER_MARKER)) return url;
  if (!url.includes(OBJECT_MARKER)) return url;
  if (VIDEO_EXT_RE.test(url)) return url;

  const [base, existingQuery] = url.replace(OBJECT_MARKER, RENDER_MARKER).split('?');
  const params = new URLSearchParams(existingQuery);
  params.set('width', String(OG_IMAGE_WIDTH));
  params.set('height', String(OG_IMAGE_HEIGHT));
  params.set('resize', 'cover');
  params.set('quality', '75');
  params.set('format', 'origin');
  return `${base}?${params.toString()}`;
};
