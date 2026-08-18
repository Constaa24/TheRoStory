import React from "react";
import { useLocation } from "react-router-dom";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { localizedPath, ogLocaleFor } from "@/lib/locale";
import { storageOgImage, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from "@/lib/image-url";

interface PageHeadProps {
  /** Page title — will be suffixed with " — The RoStory" automatically */
  title: string;
  /** Meta description (~155 chars max) */
  description: string;
  /** Optional override; defaults to /og-image.jpg */
  imageUrl?: string;
  /** Locale: 'en' or 'ro'. Drives og:locale and html lang */
  language: "en" | "ro";
  /**
   * Optional canonical URL override. Defaults to SITE_URL + the current
   * locale's path. Pass an explicit value for paginated/filtered views so the
   * canonical is self-referential (e.g. "/?page=2") instead of collapsing to
   * "/". An override must already carry the locale prefix — build it with
   * `localizedPath` rather than by hand.
   */
  canonical?: string;
  /**
   * Optional unprefixed path (no locale, no origin) used to build the
   * hreflang alternates when the canonical is overridden — e.g. "/?page=2".
   * Defaults to the router pathname, which is correct for every plain page.
   */
  alternatePath?: string;
  /**
   * og:type for this page. Defaults to "website"; article pages pass
   * "article". This is a prop rather than something a caller can override
   * via `children` because React does not de-duplicate <meta> tags — passing
   * a second og:type as a child emits both, and crawlers read the first.
   */
  ogType?: "website" | "article";
  /** Any extra head children — JSON-LD scripts, link rels, etc. */
  children?: React.ReactNode;
}

/**
 * Centralizes per-page <head> metadata: title, description, OG/Twitter tags,
 * and canonical URL.
 *
 * Uses React 19's built-in support for hoisting <title>, <meta>, <link>, and
 * <script> elements rendered in component output. This replaces the previous
 * react-helmet-async wrapper, which is no longer maintained for React 19.
 *
 * The html `lang` attribute is set globally by LanguageProvider so it stays
 * in sync across the app — including pages that don't use PageHead.
 */
export const PageHead: React.FC<PageHeadProps> = ({
  title,
  description,
  imageUrl,
  language,
  canonical,
  alternatePath,
  ogType = "website",
  children,
}) => {
  const location = useLocation();
  // location.pathname is basename-stripped, so it is the same unprefixed path
  // in both locales — which is exactly what the alternates need.
  const basePath = alternatePath || location.pathname;
  // Split off any query/hash before prefixing. localizedPath treats its
  // argument as a pure path, so handing it "/?page=2" whole produced
  // "/ro/?page=2" while the canonical built from the bare path produced
  // "/ro?page=2" — two spellings of one URL. Google drops an hreflang cluster
  // whose alternate doesn't match the target page's canonical exactly, so
  // that near-miss would have silently cost the paginated pages their pairing.
  const queryStart = basePath.search(/[?#]/);
  const pathOnly = queryStart === -1 ? basePath : basePath.slice(0, queryStart);
  const suffix = queryStart === -1 ? "" : basePath.slice(queryStart);
  const localized = (lang: "en" | "ro") => `${SITE_URL}${localizedPath(lang, pathOnly)}${suffix}`;

  const canonicalUrl = canonical || localized(language);
  const enUrl = localized("en");
  const roUrl = localized("ro");
  const fullTitle = `${title} — ${SITE_NAME}`;
  // Cropped to exactly the 1200x630 the tags below declare. Passing the raw
  // storage object made those declarations false and, at 7 MB, put the larger
  // covers over X's 5 MB ceiling. Local assets pass through untouched.
  const image = storageOgImage(imageUrl) || `${SITE_URL}/og-image.jpg`;
  const ogLocale = ogLocaleFor(language);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Reciprocal hreflang. Both versions must point at each other AND at
          themselves, or Google ignores the pair. x-default goes to English,
          which is the unprefixed tree and the one an unknown locale lands on.
          Without these the two languages were a single URL and only English
          was ever indexed. */}
      <link rel="alternate" hrefLang="en" href={enUrl} />
      <link rel="alternate" hrefLang="ro" href={roUrl} />
      <link rel="alternate" hrefLang="x-default" href={enUrl} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
      <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
      <meta property="og:image:alt" content={title} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:locale:alternate" content={ogLocaleFor(language === "en" ? "ro" : "en")} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={title} />

      {children}
    </>
  );
};
