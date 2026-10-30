import type { Article, ArticleSubtype } from "@/lib/supabase";
import { getLocalized, CHAPTER_DELIMITER } from "@/lib/supabase";

/**
 * Human label for an article's kind, shown on cards, the article masthead,
 * and the Map side panel. Text articles can opt into a subtype (poetry /
 * short story) that overrides the default "Essay" label. NULL subtype is
 * treated as essay.
 *
 * Two labels used to claim more than the stories deliver. "Long read" sat on
 * essays of 300–700 words, a two-to-four-minute read. "Photo essay" sat on
 * carousels whose frames are sometimes illustrations or animation stills
 * rather than photographs — on an archive whose mission is correcting
 * misconceptions, the format label should not assert a medium. "Visual
 * essay" is true of every carousel.
 */
export const getArticleKindLabel = (
  article: Pick<Article, 'type' | 'subtype'>,
  language: 'en' | 'ro'
): string => {
  if (article.type === 'video') return language === 'en' ? 'Film' : 'Film';
  if (article.type === 'carousel') return language === 'en' ? 'Visual essay' : 'Eseu vizual';
  const subtype: ArticleSubtype = (article.subtype as ArticleSubtype | null | undefined) || 'essay';
  if (subtype === 'poetry') return language === 'en' ? 'Poem' : 'Poem';
  if (subtype === 'short_story') return language === 'en' ? 'Short story' : 'Povestire';
  return language === 'en' ? 'Essay' : 'Eseu';
};

/**
 * Nouns the interface counts, as [singular, plural] per language. The "de"
 * that Romanian puts after 20 and up is added by countLabel, not stored here.
 */
const COUNT_NOUNS = {
  story: { en: ['story', 'stories'], ro: ['poveste', 'povești'] },
  view: { en: ['view', 'views'], ro: ['vizualizare', 'vizualizări'] },
  reply: { en: ['reply', 'replies'], ro: ['răspuns', 'răspunsuri'] },
  frame: { en: ['frame', 'frames'], ro: ['cadru', 'cadre'] },
} as const;

export type CountNoun = keyof typeof COUNT_NOUNS;

const PLURAL_RULES = {
  en: new Intl.PluralRules('en'),
  ro: new Intl.PluralRules('ro'),
};

/**
 * "1 story" / "3 stories" — and in Romanian "1 poveste" / "3 povești" /
 * "24 de povești".
 *
 * Counts used to be written as `${n} povești` everywhere, which is wrong
 * twice in Romanian: a single story is "1 poveste", and any number whose
 * last two digits fall in 20–99, or that is a round hundred, takes "de" —
 * "24 de povești", the very number the map shows. English had its own slip,
 * "1 stories". Intl.PluralRules encodes the Romanian split as one / few /
 * other, so this follows CLDR rather than a hand-rolled approximation.
 */
export const countLabel = (n: number, noun: CountNoun, language: 'en' | 'ro'): string => {
  const [one, many] = COUNT_NOUNS[noun][language];
  const formatted = n.toLocaleString(language === 'en' ? 'en-GB' : 'ro-RO');
  const category = PLURAL_RULES[language].select(n);
  if (category === 'one') return `${formatted} ${one}`;
  if (language === 'ro' && category === 'other') return `${formatted} de ${many}`;
  return `${formatted} ${many}`;
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
  // toLocaleDateString does NOT throw on an invalid date — it returns the
  // literal string "Invalid Date", so the try/catch this used to rely on
  // never fired and a bad timestamp rendered into the byline verbatim.
  // Falsy input is rejected separately because `new Date(null)` is not
  // invalid, it's the epoch, which would print as 1 January 1970.
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ro-RO', {
      day: 'numeric',
      month: monthStyle,
      year: 'numeric',
    });
  } catch {
    // Only reachable via a RangeError from the formatter itself.
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

/**
 * Content in the requested language, falling back to the other language
 * when that translation is empty. Without the fallback an English-only
 * story read in Romanian resolved to '' — which silently zeroed the word
 * count and blanked the excerpt.
 */
const localizedContent = (article: Article, language: 'en' | 'ro'): string => {
  const primary = getLocalized(article, 'content', language);
  if (primary.trim()) return primary;
  return getLocalized(article, 'content', language === 'en' ? 'ro' : 'en');
};

const WORDS_PER_MINUTE = 200;

/**
 * Estimated reading time in whole minutes.
 *
 * The chapter delimiter is stripped before counting. Chapters are joined
 * without surrounding whitespace, so `end|||CHAPTER|||start` splits as one
 * token — leaving it in merges the last word of each chapter with the first
 * word of the next and undercounts by one per chapter boundary.
 *
 * The floor is 1 minute. It used to be 3, paired with a 220 wpm divisor,
 * which meant every story under 770 words rounded down into the floor and
 * displayed exactly "3 min read" — that covers most of the archive, so the
 * number carried no information.
 */
export const readMinutes = (article: Article, language: 'en' | 'ro'): number => {
  const words = localizedContent(article, language)
    .split(CHAPTER_DELIMITER).join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
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
  const text = localizedContent(article, language)
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
