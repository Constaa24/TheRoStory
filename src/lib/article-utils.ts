import type { Article } from "@/lib/supabase";
import { getLocalized } from "@/lib/supabase";

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
