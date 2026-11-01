import { describe, it, expect } from 'vitest';
import type { Article } from '@/lib/supabase';
import { project, invert, PLATE_W, PLATE_H } from './projection';
import {
  toAtlasStory,
  whenOf,
  buildTimeScale,
  xOf,
  yearOf,
  matches,
  eraOf,
  ticksFor,
  centuriesSpanned,
  excerpt,
  layoutLanes,
  compareStories,
  countyAt,
  filtersActive,
  COUNTY_GEO,
  PLAY_DONE,
  ACROSS_ROMANIA,
  type AtlasFilters,
  type AtlasStory,
} from './model';

const article = (over: Partial<Article> = {}): Article => ({
  id: 'art_1',
  titleEn: 'Title',
  titleRo: 'Titlu',
  contentEn: '',
  contentRo: '',
  categoryId: 'cat_history',
  userId: 'u',
  isPublished: true,
  type: 'text',
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

const story = (over: Partial<AtlasStory> = {}): AtlasStory => ({
  ...toAtlasStory(article()),
  ...over,
});

describe('projection', () => {
  it('round-trips a coordinate', () => {
    const [x, y] = project(26.1018, 44.4355);
    const [lng, lat] = invert(x, y);
    expect(lng).toBeCloseTo(26.1018, 9);
    expect(lat).toBeCloseTo(44.4355, 9);
  });

  it('puts University Square inside the plate, near București', () => {
    const [x, y] = project(26.1018, 44.4355);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(PLATE_W);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(PLATE_H);
    const buc = COUNTY_GEO.find((c) => c.name === 'București')!;
    expect(Math.hypot(x - buc.cx, y - buc.cy)).toBeLessThan(15);
  });

  it('finds the county under a point', () => {
    expect(countyAt(...project(26.1018, 44.4355))).toBe('București');
    expect(countyAt(...project(25.5878, 45.6409))).toBe('Brașov');
    expect(countyAt(...project(26.2, 44.6))).toBe('Ilfov');
    expect(countyAt(...project(30.2, 44.0))).toBeNull();
  });

  it('keeps north up and east right', () => {
    const [x1, y1] = project(24, 45);
    const [x2, y2] = project(25, 46);
    expect(x2).toBeGreaterThan(x1);
    expect(y2).toBeLessThan(y1);
  });
});

describe('toAtlasStory', () => {
  it('pins an exact point and keeps the author’s place names', () => {
    const s = toAtlasStory(article({ lat: 44.4355, lng: 26.1018, location: 'București', placeNameEn: 'University Square', placeNameRo: 'Piața Universității' }));
    expect(s.exact).toBe(true);
    expect(s.place).toEqual(['University Square', 'Piața Universității']);
    expect(s.county).toBe('București');
  });

  it('falls back to the county centre and name without a point', () => {
    const s = toAtlasStory(article({ location: 'Sibiu' }));
    const sibiu = COUNTY_GEO.find((c) => c.name === 'Sibiu')!;
    expect(s.exact).toBe(false);
    expect([s.x, s.y]).toEqual([sibiu.cx, sibiu.cy]);
    expect(s.place).toEqual(['Sibiu', 'Sibiu']);
  });

  it('leaves a story with neither point nor county off the map', () => {
    const s = toAtlasStory(article({ timeless: true }));
    expect(s.x).toBeNull();
    expect(s.place).toEqual(ACROSS_ROMANIA);
  });

  it('ignores an unknown county name', () => {
    expect(toAtlasStory(article({ location: 'Atlantis' })).county).toBeNull();
  });

  it('fills a missing language from the other one', () => {
    const s = toAtlasStory(article({ placeNameEn: 'Babele', yearStart: 1500, eraLabelRo: 'secolul al XVI-lea' }));
    expect(s.place).toEqual(['Babele', 'Babele']);
    expect(s.eraLabel).toEqual(['secolul al XVI-lea', 'secolul al XVI-lea']);
  });

  it('treats a missing end year as a single year', () => {
    const s = toAtlasStory(article({ yearStart: 1859 }));
    expect([s.y0, s.y1]).toEqual([1859, 1859]);
  });

  it('maps every article shape to a format', () => {
    expect(toAtlasStory(article({ type: 'video' })).kind).toBe('film');
    expect(toAtlasStory(article({ type: 'carousel' })).kind).toBe('visual');
    expect(toAtlasStory(article({ subtype: 'poetry' })).kind).toBe('poem');
    expect(toAtlasStory(article({ subtype: 'short_story' })).kind).toBe('short');
    expect(toAtlasStory(article({ subtype: null })).kind).toBe('essay');
  });
});

describe('whenOf', () => {
  it('formats spans, single years and BCE', () => {
    expect(whenOf(story({ y0: 1873, y1: 1914 }), 'en')).toBe('1873–1914');
    expect(whenOf(story({ y0: 1859, y1: 1859 }), 'en')).toBe('1859');
    expect(whenOf(story({ y0: -82, y1: -44 }), 'en')).toBe('82 BC–44 BC');
    expect(whenOf(story({ y0: -82, y1: -82 }), 'ro')).toBe('82 î.Hr.');
  });

  it('prefers the author’s wording, and names the undatable', () => {
    expect(whenOf(story({ y0: 1431, y1: 1476, eraLabel: ['15th century', 'secolul al XV-lea'] }), 'ro')).toBe('secolul al XV-lea');
    expect(whenOf(story({ timeless: true }), 'en')).toBe('Timeless');
    expect(whenOf(story(), 'ro')).toBe('Fără dată');
  });
});

describe('time scale', () => {
  const base = buildTimeScale([story({ y0: 1383, y1: 1689 }), story({ y0: 1989, y1: 1989 })]);

  it('runs 1300 to 2030 by default', () => {
    expect([base.start, base.end]).toEqual([1300, 2030]);
    expect(base.eras.map((e) => e.id)).toEqual(['medieval', 'early-modern', 'c19', 'c20', 'today']);
  });

  it('maps years to the axis and back', () => {
    expect(xOf(base, 1300)).toBe(0);
    expect(xOf(base, 1900)).toBe(56);
    expect(xOf(base, 2030)).toBe(100);
    for (const y of [1350, 1650, 1877, 1989]) expect(yearOf(base, xOf(base, y))).toBeCloseTo(y, 9);
  });

  it('opens an earlier band for a story before 1300', () => {
    const s = buildTimeScale([story({ y0: 106, y1: 106 })]);
    expect(s.start).toBe(100);
    expect(s.eras[0].id).toBe('earlier');
    expect(xOf(s, 1300)).toBe(10);
    expect(xOf(s, 106)).toBeGreaterThan(0);
    expect(xOf(s, 106)).toBeLessThan(10);
  });

  it('stretches to a story after 2030', () => {
    expect(buildTimeScale([story({ y0: 2040, y1: 2044 })]).end).toBe(2050);
  });

  it('drops ticks that would print on top of each other', () => {
    expect(ticksFor(base, 900)).toEqual([1300, 1400, 1500, 1800, 1850, 1900, 1925, 1950, 1975, 2000]);
    const phone = ticksFor(base, 310);
    expect(phone).toContain(1300);
    expect(phone).toContain(2000);
    const xs = phone.map((y) => (xOf(base, y) / 100) * 310);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(40);
  });

  it('files stories under eras', () => {
    expect(eraOf(story({ y0: 1431, y1: 1476 }), base)).toBe('medieval');
    expect(eraOf(story({ y0: 1900, y1: 1900 }), base)).toBe('c20');
    expect(eraOf(story({ timeless: true }), base)).toBe('timeless');
    expect(eraOf(story(), base)).toBe('undated');
  });
});

describe('matches', () => {
  const scale = buildTimeScale([]);
  const all: AtlasFilters = { theme: null, format: null, range: [1300, 2030], showTimeless: true };
  const dated = story({ y0: 1873, y1: 1914, categoryId: 'landmarks', kind: 'visual' });
  const myth = story({ timeless: true });
  const undated = story();

  it('keeps everything with no filters', () => {
    expect([dated, myth, undated].every((s) => matches(s, all, scale))).toBe(true);
    expect(filtersActive(all, scale)).toBe(false);
  });

  it('filters by theme and format', () => {
    expect(matches(dated, { ...all, theme: 'landmarks' }, scale)).toBe(true);
    expect(matches(dated, { ...all, theme: 'myths' }, scale)).toBe(false);
    expect(matches(dated, { ...all, format: 'film' }, scale)).toBe(false);
  });

  it('keeps a span that overlaps the range', () => {
    expect(matches(dated, { ...all, range: [1900, 2000] }, scale)).toBe(true);
    expect(matches(dated, { ...all, range: [1915, 2000] }, scale)).toBe(false);
  });

  it('drops undated stories once the years are narrowed, keeps timeless ones', () => {
    const narrowed = { ...all, range: [1800, 1900] as const };
    expect(matches(undated, narrowed, scale)).toBe(false);
    expect(matches(myth, narrowed, scale)).toBe(true);
    expect(filtersActive(narrowed, scale)).toBe(true);
  });

  it('hides timeless stories on request', () => {
    expect(matches(myth, { ...all, showTimeless: false }, scale)).toBe(false);
  });

  it('reveals stories in order while playing, timeless ones last', () => {
    expect(matches(dated, all, scale, 1850)).toBe(false);
    expect(matches(dated, all, scale, 1873)).toBe(true);
    expect(matches(myth, all, scale, 1990)).toBe(false);
    expect(matches(myth, all, scale, PLAY_DONE)).toBe(true);
    expect(matches(undated, all, scale, PLAY_DONE)).toBe(false);
  });
});

describe('copy helpers', () => {
  it('counts whole centuries in both languages', () => {
    const stories = [story({ y0: 1350, y1: 1676 }), story({ y0: 1989, y1: 2004 })];
    expect(centuriesSpanned(stories, 'en')).toBe('six centuries');
    expect(centuriesSpanned(stories, 'ro')).toBe('șase secole');
    expect(centuriesSpanned([story({ y0: -82, y1: -82 }), story({ y0: 1989, y1: 1989 })], 'ro')).toBe('douăzeci de secole');
    expect(centuriesSpanned([story({ y0: 1900, y1: 1989 })], 'en')).toBeNull();
  });

  it('cuts an excerpt at a word and never after a full stop', () => {
    expect(excerpt('Short.')).toBe('Short.');
    const long = 'The light came through the glass. '.repeat(10);
    const cut = excerpt(long, 34);
    expect(cut).toBe('The light came through the glass…');
    expect(excerpt('> A quote|||CHAPTER|||Next **bold**', 100)).toBe('A quote Next bold');
  });
});

describe('order and lanes', () => {
  it('sorts dated stories by year, then timeless, then undated', () => {
    const list = [story({ id: 'u' }), story({ id: 't', timeless: true }), story({ id: 'b', y0: 1900, y1: 1900 }), story({ id: 'a', y0: 1400, y1: 1400 })];
    expect(list.sort(compareStories).map((s) => s.id)).toEqual(['a', 'b', 't', 'u']);
  });

  it('stacks overlapping spans into lanes', () => {
    const scale = buildTimeScale([]);
    const { lanes, count } = layoutLanes(
      [story({ id: 'a', y0: 1850, y1: 1950 }), story({ id: 'b', y0: 1900, y1: 1900 }), story({ id: 'c', y0: 1990, y1: 1990 })],
      1000,
      scale
    );
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(1);
    expect(lanes.get('c')).toBe(0);
    expect(count).toBe(2);
  });
});
