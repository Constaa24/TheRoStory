/**
 * The facts a story is introduced by on the storybook pages: where and when
 * it happens, what kind of story it is, how long it takes, and how its
 * chapters begin. Kept free of heavy imports (the projection reads a ~1 KB
 * file) so every card on every page can use it.
 */
import type { Article } from './supabase';
import { CHAPTER_DELIMITER } from './supabase';
import { countLabel, readMinutes } from './article-utils';
import { countyCentre, project, PLATE_H, PLATE_W } from './atlas/projection';

type Lang = 'en' | 'ro';
type PlaceFields = Pick<Article, 'location' | 'placeNameEn' | 'placeNameRo'>;
type TimeFields = Pick<Article, 'timeless' | 'yearStart' | 'yearEnd' | 'eraLabelEn' | 'eraLabelRo'>;

const pickLang = (en: string | null | undefined, ro: string | null | undefined, lang: Lang): string => {
  const a = (lang === 'ro' ? ro : en)?.trim();
  const b = (lang === 'ro' ? en : ro)?.trim();
  return a || b || '';
};

export const formatYear = (year: number, lang: Lang): string =>
  year < 0 ? `${-year} ${lang === 'ro' ? 'î.Hr.' : 'BC'}` : String(year);

/** "University Square, Bucharest" — the author's place name, else the county. */
export const placeOf = (a: PlaceFields, lang: Lang): string | null =>
  pickLang(a.placeNameEn, a.placeNameRo, lang) || a.location?.trim() || null;

/** "1873–1914", "15th century", "timeless" — or null for an undated story. */
export const whenOf = (a: TimeFields, lang: Lang): string | null => {
  if (a.timeless) return lang === 'ro' ? 'atemporală' : 'timeless';
  if (a.yearStart == null) return null;
  const label = pickLang(a.eraLabelEn, a.eraLabelRo, lang);
  if (label) return label;
  return a.yearEnd != null && a.yearEnd !== a.yearStart
    ? `${formatYear(a.yearStart, lang)}–${formatYear(a.yearEnd, lang)}`
    : formatYear(a.yearStart, lang);
};

/** The line a card leads with: "Bacău · 1916". Null when there is neither. */
export const placeAndTime = (a: PlaceFields & TimeFields, lang: Lang): string | null =>
  [placeOf(a, lang), whenOf(a, lang)].filter(Boolean).join(' · ') || null;

/** "An essay", "A poem", "A visual essay · 10 frames", "A film". */
export const kindPhrase = (a: Pick<Article, 'type' | 'subtype' | 'mediaUrls' | 'mediaUrl'>, lang: Lang): string => {
  const ro = lang === 'ro';
  if (a.type === 'video') return ro ? 'Un film' : 'A film';
  if (a.type === 'carousel') {
    const frames = a.mediaUrls?.length || (a.mediaUrl ? 1 : 0);
    const base = ro ? 'Un eseu vizual' : 'A visual essay';
    return frames ? `${base} · ${countLabel(frames, 'frame', lang)}` : base;
  }
  if (a.subtype === 'poetry') return ro ? 'Un poem' : 'A poem';
  if (a.subtype === 'short_story') return ro ? 'O povestire' : 'A short story';
  return ro ? 'Un eseu' : 'An essay';
};

/** The kind alone, without a visual essay's frame count: "A visual essay", "A poem". */
export const kindWord = (a: Pick<Article, 'type' | 'subtype' | 'mediaUrls' | 'mediaUrl'>, lang: Lang): string =>
  a.type === 'carousel' ? (lang === 'ro' ? 'Un eseu vizual' : 'A visual essay') : kindPhrase(a, lang);

/** "3-minute read" / "Lectură de 3 minute"; films are watched, not read. */
export const readPhrase = (a: Article, lang: Lang): string => {
  if (a.type === 'video') return lang === 'ro' ? 'Vezi filmul' : 'Watch the film';
  const n = readMinutes(a, lang);
  return lang === 'ro' ? `Lectură de ${countLabel(n, 'minute', lang)}` : `${n}-minute read`;
};

export const toRoman = (n: number): string => {
  const map: [number, string][] = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  let rest = Math.max(1, Math.floor(n));
  for (const [v, s] of map) while (rest >= v) { out += s; rest -= v; }
  return out;
};

/** A title's main line and, after its first colon, its subtitle. */
export const splitTitle = (title: string): { main: string; sub: string | null } => {
  const i = title.indexOf(':');
  if (i < 1 || i > title.length - 3) return { main: title, sub: null };
  return { main: title.slice(0, i).trim(), sub: title.slice(i + 1).trim() };
};

export type StoryChapter = {
  /** From an optional first line "# Title"; null when the chapter has none. */
  title: string | null;
  body: string;
  /** The chapter's first words, for the chapter path: "For three centuries…" */
  incipit: string;
};

const firstWords = (text: string, n: number): string => {
  const words = text.replace(/^>\s*/, '').trim().split(/\s+/);
  const head = words.slice(0, n).join(' ').replace(/[,;:.—–-]+$/, '');
  return words.length > n ? `${head}…` : head;
};

/**
 * A text story's chapters. A chapter may open with a line "# Title" — that
 * line becomes its title (shown on the chapter path and as the scene
 * heading) and is not part of the body.
 */
export const parseStoryChapters = (content: string): StoryChapter[] =>
  (content || '')
    .split(CHAPTER_DELIMITER)
    .map((raw) => raw.replace(/^\s+/, ''))
    .filter((raw) => raw.trim())
    .map((raw) => {
      const m = raw.match(/^#\s+(.+)\n?/);
      const title = m ? m[1].trim() : null;
      const body = (m ? raw.slice(m[0].length) : raw).trim();
      return { title, body, incipit: firstWords(body, 5) };
    });

/** A paragraph's first few words, set in capitals as a book opens a chapter. */
export const splitOpening = (paragraph: string, words = 4): [string, string] => {
  const m = paragraph.match(new RegExp(`^((?:\\S+\\s+){${words - 1}}\\S+)([\\s\\S]*)$`));
  return m ? [m[1], m[2]] : [paragraph, ''];
};

/**
 * Where a story's pin sits on the small Romania outline, in percent, and
 * whether it is an exact point or just the county.
 */
export const pinOf = (a: Pick<Article, 'lat' | 'lng' | 'location'>): { left: number; top: number; exact: boolean } | null => {
  let xy: [number, number] | null = null;
  let exact = false;
  if (a.lat != null && a.lng != null) {
    xy = project(a.lng, a.lat);
    exact = true;
  } else if (a.location) {
    xy = countyCentre(a.location);
  }
  if (!xy) return null;
  return { left: (xy[0] / PLATE_W) * 100, top: (xy[1] / PLATE_H) * 100, exact };
};
