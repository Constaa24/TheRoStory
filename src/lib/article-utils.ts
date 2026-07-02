import type { Article, ArticleSubtype } from "@/lib/supabase";
import { getLocalized, CHAPTER_DELIMITER } from "@/lib/supabase";

/**
 * Human label for an article's kind, shown on cards, the article masthead,
 * and the Map side panel. Text articles can opt into a subtype (poetry /
 * short story) that overrides the default "Long read" copy. NULL subtype is
 * treated as essay so legacy rows keep their original wording.
 */
export const getArticleKindLabel = (
  article: Pick<Article, 'type' | 'subtype'>,
  language: 'en' | 'ro'
): string => {
  if (article.type === 'video') return language === 'en' ? 'Film' : 'Film';
  if (article.type === 'carousel') return language === 'en' ? 'Photo essay' : 'Eseu foto';
  const subtype: ArticleSubtype = (article.subtype as ArticleSubtype | null | undefined) || 'essay';
  if (subtype === 'poetry') return language === 'en' ? 'Poem' : 'Poem';
  if (subtype === 'short_story') return language === 'en' ? 'Short story' : 'Povestire';
  return language === 'en' ? 'Long read' : 'Lectură lungă';
};

/**
 * Locale-aware date for bylines and comment timestamps. `monthStyle`
 * distinguishes the article byline ("14 March 2026") from the tighter
 * comment stamp ("14 Mar 2026").
 */
export const formatArticleDate = (
  iso: string,
  lang: 'en' | 'ro',
  monthStyle: 'long' | 'short' = 'long'
): string => {
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ro-RO', {
      day: 'numeric',
      month: monthStyle,
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

export const TONES = ["warm", "forest", "sky", "oxblood", "bone"] as const;
export type Tone = typeof TONES[number];

export const toneFor = (id: string): Tone => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return TONES[Math.abs(h) % TONES.length];
};

export const readMinutes = (article: Article, language: 'en' | 'ro'): number => {
  const text = getLocalized(article, 'content', language);
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 220));
};

export const placeLabel = (article: Pick<Article, 'location'>): string =>
  (article.location || '').toUpperCase();

/**
 * Plain-text excerpt safe for cards and meta descriptions. Text stories
 * store chapters joined with CHAPTER_DELIMITER — without stripping it,
 * excerpts (and the SEO description) leak the raw `|||CHAPTER|||` token.
 * Also drops pull-quote/markdown markers and collapses whitespace.
 */
export const articleExcerpt = (
  article: Article,
  language: 'en' | 'ro',
  maxLength: number
): string => {
  const text = getLocalized(article, 'content', language)
    .split(CHAPTER_DELIMITER).join(' ')
    .replace(/[#*_>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
};

/**
 * Resolves the image URL to use as an article's cover/thumbnail.
 * Videos never fall back to `mediaUrl` — that's the video file itself
 * and renders as a broken <img>. Returns undefined when there is no
 * usable image (callers show a tone placeholder instead).
 */
export const articleCoverUrl = (
  article: Pick<Article, 'type' | 'mediaUrl' | 'posterUrl' | 'mediaUrls'>
): string | undefined => {
  if (article.type === 'video') return article.posterUrl || undefined;
  if (article.type === 'carousel') {
    return article.posterUrl || article.mediaUrls?.[0] || article.mediaUrl || undefined;
  }
  return article.mediaUrl || article.posterUrl || undefined;
};
