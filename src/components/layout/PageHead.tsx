import React from "react";
import { useLocation } from "react-router-dom";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

interface PageHeadProps {
  /** Page title — will be suffixed with " — The RoStory" automatically */
  title: string;
  /** Meta description (~155 chars max) */
  description: string;
  /** Optional override; defaults to /og-image.png */
  imageUrl?: string;
  /** Locale: 'en' or 'ro'. Drives og:locale and html lang */
  language: "en" | "ro";
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
  children,
}) => {
  const location = useLocation();
  const canonical = `${SITE_URL}${location.pathname}`;
  const fullTitle = `${title} — ${SITE_NAME}`;
  const image = imageUrl || `${SITE_URL}/og-image.png`;
  const ogLocale = language === "en" ? "en_US" : "ro_RO";

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={ogLocale} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {children}
    </>
  );
};
