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
  stop: { en: ['stop', 'stops'], ro: ['oprire', 'opriri'] },
  county: { en: ['county', 'counties'], ro: ['județ', 'județe'] },
  minute: { en: ['minute', 'minutes'], ro: ['minut', 'minute'] },
  essay: { en: ['essay', 'essays'], ro: ['eseu', 'eseuri'] },
  poem: { en: ['poem', 'poems'], ro: ['poem', 'poeme'] },
  shortStory: { en: ['short story', 'short stories'], ro: ['povestire', 'povestiri'] },
  visualEssay: { en: ['visual essay', 'visual essays'], ro: ['eseu vizual', 'eseuri vizuale'] },
  film: { en: ['film', 'films'], ro: ['film', 'filme'] },
  chapter: { en: ['chapter', 'chapters'], ro: ['capitol', 'capitole'] },
  scene: { en: ['scene', 'scenes'], ro: ['scenă', 'scene'] },
  stanza: { en: ['stanza', 'stanzas'], ro: ['strofă', 'strofe'] },
  note: { en: ['note', 'notes'], ro: ['notă', 'note'] },
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
 *
 * A visual essay is read through its captions, not its short introduction,
 * so their words count too — without them a ten-frame essay with 340 words
 * of captions claimed to be a one-minute read.
 */
export const readMinutes = (article: Article, language: 'en' | 'ro'): number => {
  const other = language === 'en' ? 'ro' : 'en';
  const captions = article.type === 'carousel'
    ? (article.mediaCaptions || []).map((c) => (c?.[language] || c?.[other] || '')).join(' ')
    : '';
  const words = `${localizedContent(article, language).split(CHAPTER_DELIMITER).join(' ')} ${captions}`
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
};

export const placeLabel = (article: Pick<Article, 'location'>): string =>
  (article.location || '').toUpperCase();

/**
 * A story's text as one plain line for a card, cut at a word.
 *
 * Text stories store chapters joined with CHAPTER_DELIMITER; without
 * stripping it, excerpts (and the SEO description) leak the raw
 * `|||CHAPTER|||` token. A chapter's optional "# Title" line is a heading,
 * not its first words, and pull-quote/markdown markers go too.
 *
 * A poem keeps its line breaks as " / ", the way verse is quoted in prose;
 * collapsed into spaces it read as one run-on sentence with capitals in the
 * middle ("…served at the wedding By the groom's father…").
 *
 * The cut lands between words, never mid-word ("before s…"), and never
 * leaves an ellipsis after a full stop or a slash ("glass.…").
 */
export const excerptText = (raw: string, maxLength: number, poem = false): string => {
  let text = (raw || '')
    .split(CHAPTER_DELIMITER)
    .map((chapter) => chapter.replace(/^\s*#\s+[^\n]*\n?/, ''))
    .join(poem ? '\n' : ' ')
    .replace(/[#*_>`]/g, ' ');
  if (poem) text = text.trim().replace(/[ \t]*\n\s*/g, ' / ');
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength + 1);
  // Back up to the last space; a single word longer than the whole budget
  // is the only case cut mid-word.
  const atWord = /\s/.test(cut) ? cut.replace(/\s+\S*$/, '') : text.slice(0, maxLength);
  return atWord.replace(/[\s.,;:!?/—–-]+$/, '') + '…';
};

/** Items up to this long are kept on one line (a date, "33 views", "made with AI"). */
const KEEP_TOGETHER = 24;

/**
 * The small "a · b · c" lines under titles and on cards. On a phone they
 * wrap, and used to break inside an item ("11 / July 2026", "made / with
 * AI"). Short items get non-breaking spaces so they wrap whole; a long one
 * (a place name) may still wrap inside, rather than run off the screen. The
 * space before each dot is non-breaking too, so no line starts with "·".
 */
export const joinMeta = (parts: (string | null | undefined | false)[]): string =>
  parts
    .filter((p): p is string => !!p && !!p.trim())
    .map((p) => (p.length <= KEEP_TOGETHER ? p.replace(/ /g, ' ') : p.replace(/ · /g, ' · ')))
    .join(' · ');

/** Plain-text excerpt safe for cards and meta descriptions; see excerptText. */
export const articleExcerpt = (
  article: Article,
  language: 'en' | 'ro',
  maxLength: number
): string => excerptText(localizedContent(article, language), maxLength, article.subtype === 'poetry');

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
