import type { Article } from "@/lib/supabase";
import { getLocalized, CHAPTER_DELIMITER } from "@/lib/supabase";

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
