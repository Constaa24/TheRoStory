/**
 * The Atlas's data model: how a published article becomes a pin, a mark on
 * the timeline and a row in the list, and the rules that decide which of
 * them a set of filters keeps. Pure functions only, so the page and the
 * tests share one definition of "matches".
 */
import type { Article } from '@/lib/supabase';
import { articleCoverUrl, getArticleKindLabel } from '@/lib/article-utils';
import { storageImage } from '@/lib/image-url';
import { formatYear } from '@/lib/story-facts';
import geo from './atlas-geo.json';
import { project } from './projection';

export type Lang = 'en' | 'ro';
/** [English, Romanian] */
export type Pair = readonly [string, string];
export const pick = (pair: Pair, lang: Lang): string => pair[lang === 'ro' ? 1 : 0];

export type AtlasKind = 'essay' | 'visual' | 'film' | 'poem' | 'short';

export const kindOf = (a: Pick<Article, 'type' | 'subtype'>): AtlasKind => {
  if (a.type === 'video') return 'film';
  if (a.type === 'carousel') return 'visual';
  if (a.subtype === 'poetry') return 'poem';
  if (a.subtype === 'short_story') return 'short';
  return 'essay';
};

const KIND_SOURCE: Record<AtlasKind, Pick<Article, 'type' | 'subtype'>> = {
  essay: { type: 'text', subtype: 'essay' },
  visual: { type: 'carousel' },
  film: { type: 'video' },
  poem: { type: 'text', subtype: 'poetry' },
  short: { type: 'text', subtype: 'short_story' },
};

export const FORMATS: AtlasKind[] = ['essay', 'visual', 'film', 'poem', 'short'];

/** The same name the story's card carries everywhere else on the site. */
export const kindName = (kind: AtlasKind, lang: Lang): string => getArticleKindLabel(KIND_SOURCE[kind], lang);

export type AtlasStory = {
  id: string;
  title: Pair;
  kind: AtlasKind;
  categoryId: string;
  county: string | null;
  /** Plate units; null when the story has neither a point nor a county. */
  x: number | null;
  y: number | null;
  /** True for a real point; false when the pin stands in for the county. */
  exact: boolean;
  place: Pair;
  y0: number | null;
  y1: number | null;
  timeless: boolean;
  /** Author's wording for the span ("15th century"), when they gave one. */
  eraLabel: Pair | null;
  thumb: string | null;
  cover: string | null;
};

type CountyGeo = { name: string; d: string; cx: number; cy: number; region: string };
export const COUNTY_GEO: readonly CountyGeo[] = geo.counties;
const countyByName = new Map(COUNTY_GEO.map((c) => [c.name, c]));

export const ACROSS_ROMANIA: Pair = ['Across Romania', 'În toată România'];

const bboxCache = new Map<string, readonly [number, number, number, number]>();
/** A county's bounding box in plate units [x0, y0, x1, y1], read off its (absolute M/L/Z) path. */
export const countyBBox = (name: string): readonly [number, number, number, number] | null => {
  const cached = bboxCache.get(name);
  if (cached) return cached;
  const d = countyByName.get(name)?.d;
  if (!d) return null;
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) {
    x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]);
    y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
  }
  const box = [x0, y0, x1, y1] as const;
  bboxCache.set(name, box);
  return box;
};

const ringsCache = new Map<string, number[][][]>();
const ringsOf = (name: string): number[][][] => {
  const cached = ringsCache.get(name);
  if (cached) return cached;
  const d = countyByName.get(name)?.d ?? '';
  const rings = d.split('M').filter(Boolean).map((seg) => seg.replace(/Z/g, '').split('L').map((p) => p.split(',').map(Number)));
  ringsCache.set(name, rings);
  return rings;
};

/**
 * The county containing a plate point, or null (outside Romania, or on the
 * patch of the Bucegi plateau the county data leaves unassigned). Even-odd
 * across all of a county's rings, so Ilfov's hole is București's.
 */
export const countyAt = (x: number, y: number): string | null => {
  for (const c of COUNTY_GEO) {
    const b = countyBBox(c.name);
    if (!b || x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    let inside = false;
    for (const ring of ringsOf(c.name)) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    if (inside) return c.name;
  }
  return null;
};

export const toAtlasStory = (a: Article): AtlasStory => {
  const county = a.location && countyByName.has(a.location) ? a.location : null;
  let x: number | null = null;
  let y: number | null = null;
  let exact = false;
  if (a.lat != null && a.lng != null) {
    [x, y] = project(a.lng, a.lat);
    exact = true;
  } else if (county) {
    const c = countyByName.get(county)!;
    x = c.cx;
    y = c.cy;
  }
  const placeEn = a.placeNameEn?.trim() || a.placeNameRo?.trim() || '';
  const placeRo = a.placeNameRo?.trim() || a.placeNameEn?.trim() || '';
  const place: Pair = placeEn ? [placeEn, placeRo] : county ? [county, county] : ACROSS_ROMANIA;
  const timeless = !!a.timeless;
  const y0 = timeless ? null : a.yearStart ?? null;
  const y1 = y0 == null ? null : Math.max(y0, a.yearEnd ?? y0);
  const eraEn = a.eraLabelEn?.trim() || a.eraLabelRo?.trim() || '';
  const eraRo = a.eraLabelRo?.trim() || a.eraLabelEn?.trim() || '';
  const coverUrl = articleCoverUrl(a);
  return {
    id: a.id,
    title: [a.titleEn, a.titleRo],
    kind: kindOf(a),
    categoryId: a.categoryId,
    county,
    x,
    y,
    exact,
    place,
    y0,
    y1,
    timeless,
    eraLabel: y0 != null && eraEn ? [eraEn, eraRo] : null,
    thumb: storageImage(coverUrl, 'thumb') ?? null,
    cover: storageImage(coverUrl, 'card') ?? null,
  };
};

/** Oldest first; timeless, then undated, after every dated story. */
export const compareStories = (a: AtlasStory, b: AtlasStory): number => {
  const rank = (s: AtlasStory) => (s.y0 != null ? 0 : s.timeless ? 1 : 2);
  return rank(a) - rank(b) || (a.y0 ?? 0) - (b.y0 ?? 0) || a.title[0].localeCompare(b.title[0]);
};

// ---------------------------------------------------------------- time

export { formatYear };

/** How the card, list and tooltip say when a story happens. */
export const whenOf = (s: AtlasStory, lang: Lang): string => {
  if (s.timeless) return lang === 'ro' ? 'Atemporală' : 'Timeless';
  if (s.y0 == null) return lang === 'ro' ? 'Fără dată' : 'Undated';
  if (s.eraLabel) return pick(s.eraLabel, lang);
  return s.y1 != null && s.y1 !== s.y0
    ? `${formatYear(s.y0, lang)}–${formatYear(s.y1, lang)}`
    : formatYear(s.y0, lang);
};

export type Era = { id: string; from: number; to: number; long: Pair; short: Pair };

export type TimeScale = {
  start: number;
  end: number;
  /** [year, percent along the axis] breakpoints. */
  seg: readonly (readonly [number, number])[];
  eras: readonly Era[];
};

const BASE_SEG: readonly (readonly [number, number])[] = [[1300, 0], [1500, 16], [1800, 26], [1900, 56], [2000, 92], [2030, 100]];
const BASE_ERAS: readonly Era[] = [
  { id: 'medieval', from: 1300, to: 1500, long: ['Medieval', 'Evul Mediu'], short: ['Med.', 'Ev M.'] },
  { id: 'early-modern', from: 1500, to: 1800, long: ['Early modern', 'Epoca modernă timpurie'], short: ['Early', 'Mod.'] },
  { id: 'c19', from: 1800, to: 1900, long: ['19th century', 'Secolul al XIX-lea'], short: ['19th c.', 'Sec. XIX'] },
  { id: 'c20', from: 1900, to: 2000, long: ['20th century', 'Secolul XX'], short: ['20th c.', 'Sec. XX'] },
  { id: 'today', from: 2000, to: 2030, long: ['Today', 'Astăzi'], short: ['Now', 'Azi'] },
];

/**
 * A piecewise axis: the archive is dense in the 19th and 20th centuries and
 * sparse before, so those centuries get more of the width. The era bands
 * and ticks make every change of scale visible. A story older than 1300
 * adds an "Earlier" band in front rather than being squeezed onto the edge.
 */
export const buildTimeScale = (stories: readonly AtlasStory[]): TimeScale => {
  const dated = stories.filter((s) => s.y0 != null);
  const min = Math.min(1300, ...dated.map((s) => s.y0!));
  const max = Math.max(2030, ...dated.map((s) => s.y1 ?? s.y0!));
  let seg = BASE_SEG.map(([y, p]) => [y, p] as const);
  let eras = BASE_ERAS.slice();
  if (max > 2030) {
    const end = Math.ceil(max / 10) * 10;
    seg = [...seg.slice(0, -1), [end, 100] as const];
    eras = eras.map((e) => (e.id === 'today' ? { ...e, to: end } : e));
  }
  if (min < 1300) {
    const start = Math.floor(min / 100) * 100;
    seg = [[start, 0] as const, ...seg.map(([y, p]) => [y, 10 + p * 0.9] as const)];
    eras = [{ id: 'earlier', from: start, to: 1300, long: ['Before 1300', 'Înainte de 1300'], short: ['Earlier', 'Înainte'] }, ...eras];
  }
  return { start: seg[0][0], end: seg[seg.length - 1][0], seg, eras };
};

/** Year to percent along the axis. */
export const xOf = (scale: TimeScale, year: number): number => {
  const { seg } = scale;
  if (year <= seg[0][0]) return 0;
  for (let i = 0; i < seg.length - 1; i++) {
    const [a, pa] = seg[i];
    const [b, pb] = seg[i + 1];
    if (year <= b) return pa + ((year - a) / (b - a)) * (pb - pa);
  }
  return 100;
};

/** Percent along the axis to year. */
export const yearOf = (scale: TimeScale, pct: number): number => {
  const { seg } = scale;
  if (pct <= 0) return seg[0][0];
  for (let i = 0; i < seg.length - 1; i++) {
    const [a, pa] = seg[i];
    const [b, pb] = seg[i + 1];
    if (pct <= pb) return a + ((pct - pa) / (pb - pa)) * (b - a);
  }
  return seg[seg.length - 1][0];
};

/**
 * Axis ticks that fit the track: era boundaries are placed first, then the
 * in-between years, and any tick closer than `minGapPx` to one already
 * placed is dropped. On a phone that keeps "1500" and "1800" from printing
 * as "15001800".
 */
export const ticksFor = (scale: TimeScale, widthPx: number, minGapPx = 40): number[] => {
  const boundaries = [...new Set([scale.start, ...scale.eras.map((e) => e.to)])].filter((y) => y < scale.end);
  const between = [1400, 1850, 1950, 1925, 1975].filter((y) => y > scale.start && y < scale.end);
  const placed: { y: number; x: number }[] = [];
  for (const y of [...boundaries, ...between]) {
    const x = (xOf(scale, y) / 100) * widthPx;
    if (placed.every((p) => Math.abs(p.x - x) >= minGapPx)) placed.push({ y, x });
  }
  return placed.map((p) => p.y).sort((a, b) => a - b);
};

/** The era a story is listed under: an era id, 'timeless' or 'undated'. */
export const eraOf = (s: AtlasStory, scale: TimeScale): string => {
  if (s.timeless) return 'timeless';
  if (s.y0 == null) return 'undated';
  return (scale.eras.find((e) => s.y0! < e.to) ?? scale.eras[scale.eras.length - 1]).id;
};

export const eraName = (id: string, scale: TimeScale, lang: Lang): string => {
  if (id === 'timeless') return lang === 'ro' ? 'Atemporale' : 'Timeless';
  if (id === 'undated') return lang === 'ro' ? 'Fără dată' : 'Undated';
  const era = scale.eras.find((e) => e.id === id);
  return era ? pick(era.long, lang) : id;
};

// ---------------------------------------------------------------- filters

export type AtlasFilters = {
  theme: string | null;
  format: AtlasKind | null;
  range: readonly [number, number];
  showTimeless: boolean;
};

/** The play cursor's value once every dated story has appeared. */
export const PLAY_DONE = Number.POSITIVE_INFINITY;

export const isFullRange = (f: AtlasFilters, scale: TimeScale): boolean =>
  f.range[0] <= scale.start && f.range[1] >= scale.end;

export const filtersActive = (f: AtlasFilters, scale: TimeScale): boolean =>
  !!f.theme || !!f.format || !isFullRange(f, scale) || !f.showTimeless;

/**
 * Whether a story survives the filters. `playYear` is the play cursor: while
 * it runs, a dated story appears once the cursor reaches its first year and
 * timeless ones only at the end. An undated story can't be placed in time,
 * so it drops out whenever the reader narrows the years or plays them.
 */
export const matches = (s: AtlasStory, f: AtlasFilters, scale: TimeScale, playYear: number | null = null): boolean => {
  if (f.theme && s.categoryId !== f.theme) return false;
  if (f.format && s.kind !== f.format) return false;
  if (s.timeless) {
    if (!f.showTimeless) return false;
    if (playYear != null && playYear !== PLAY_DONE) return false;
    return true;
  }
  if (s.y0 == null) return isFullRange(f, scale) && playYear == null;
  if (s.y1! < f.range[0] || s.y0 > f.range[1]) return false;
  if (playYear != null && s.y0 > playYear) return false;
  return true;
};

// ---------------------------------------------------------------- copy helpers

const CENTURY_WORDS: Record<Lang, readonly string[]> = {
  en: ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
  ro: ['', 'un', 'două', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă', 'zece', 'unsprezece', 'douăsprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece', 'douăzeci'],
};

/**
 * Whole centuries the dated stories span, in words ("six centuries",
 * "șase secole"), or null when they span less than two — the headline then
 * falls back to wording that promises no number.
 */
export const centuriesSpanned = (stories: readonly AtlasStory[], lang: Lang): string | null => {
  const dated = stories.filter((s) => s.y0 != null);
  if (!dated.length) return null;
  const span = Math.max(...dated.map((s) => s.y1!)) - Math.min(...dated.map((s) => s.y0!));
  const n = Math.floor(span / 100);
  if (n < 2) return null;
  const word = CENTURY_WORDS[lang][n] ?? String(n);
  if (lang === 'ro') return `${word}${n >= 20 ? ' de' : ''} secole`;
  return `${word} centuries`;
};

export const capitalise = (s: string): string => s.charAt(0).toLocaleUpperCase() + s.slice(1);

const CHAPTER_DELIMITER = '|||CHAPTER|||';

/**
 * A plain-text opening for the story card: chapters joined, markup marks
 * dropped, cut at a word boundary, and never an ellipsis straight after a
 * full stop ("glass.…").
 */
export const excerpt = (text: string, max = 170): string => {
  const clean = (text || '').split(CHAPTER_DELIMITER).join(' ').replace(/[#*_>`]/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, '').replace(/[\s.,;:!?—–-]+$/, '') + '…';
};

// ---------------------------------------------------------------- layout

/**
 * Timeline lanes: each dated mark takes the first row where it clears the
 * previous mark by a few pixels, so overlapping spans stack instead of
 * hiding each other.
 */
export const layoutLanes = (
  dated: readonly AtlasStory[],
  widthPx: number,
  scale: TimeScale
): { lanes: Map<string, number>; count: number } => {
  const ends: number[] = [];
  const lanes = new Map<string, number>();
  for (const s of dated) {
    if (s.y0 == null) continue;
    const a = (xOf(scale, s.y0) / 100) * widthPx;
    const b = (xOf(scale, s.y1 ?? s.y0) / 100) * widthPx;
    let lane = ends.findIndex((end) => a - 10 > end);
    if (lane === -1) {
      lane = ends.length;
      ends.push(0);
    }
    ends[lane] = Math.max(a, b) + 8;
    lanes.set(s.id, lane);
  }
  return { lanes, count: ends.length };
};
