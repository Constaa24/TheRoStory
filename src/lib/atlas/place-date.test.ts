import { describe, it, expect } from 'vitest';
import { validatePlaceDate, type Article } from '@/lib/supabase';
import {
  EMPTY_PLACE_DATE,
  draftFromArticle,
  draftToPlaceDate,
  formatCoords,
  isDraftEmpty,
  parseCoords,
  placeDateErrors,
  shouldSendPlaceDate,
  type PlaceDateDraft,
} from './place-date';

const draft = (over: Partial<PlaceDateDraft> = {}): PlaceDateDraft => ({ ...EMPTY_PLACE_DATE, ...over });
const fields = (d: PlaceDateDraft) => placeDateErrors(d, 'en').map((e) => e.field);

describe('parseCoords', () => {
  it('reads what map apps copy', () => {
    expect(parseCoords('44.4355, 26.1018')).toEqual({ lat: 44.4355, lng: 26.1018 });
    expect(parseCoords(' 44.43553 26.10182 ')).toEqual({ lat: 44.43553, lng: 26.10182 });
    expect(parseCoords('44.4355°, 26.1018°')).toEqual({ lat: 44.4355, lng: 26.1018 });
  });

  it('tells empty from wrong', () => {
    expect(parseCoords('  ')).toBeNull();
    expect(parseCoords('Bucharest')).toBe('invalid');
    expect(parseCoords('44.4')).toBe('invalid');
  });
});

describe('placeDateErrors', () => {
  it('accepts an empty draft and a full one', () => {
    expect(fields(draft())).toEqual([]);
    expect(fields(draft({ coords: '44.4355, 26.1018', yearStart: '1989', yearEnd: '1989' }))).toEqual([]);
  });

  it('catches swapped and foreign coordinates', () => {
    expect(fields(draft({ coords: '26.1018, 44.4355' }))).toEqual(['coords']);
    expect(fields(draft({ coords: '48.85, 2.35' }))).toEqual(['coords']);
    expect(fields(draft({ coords: 'here' }))).toEqual(['coords']);
  });

  it('checks the years', () => {
    expect(fields(draft({ yearStart: 'c. 1500' }))).toEqual(['yearStart']);
    expect(fields(draft({ yearEnd: '1900' }))).toEqual(['yearStart']);
    expect(fields(draft({ yearStart: '1900', yearEnd: '1800' }))).toEqual(['yearEnd']);
    expect(fields(draft({ yearStart: '-82' }))).toEqual([]);
    expect(fields(draft({ yearStart: '–82' }))).toEqual([]);
  });

  it('ignores leftover years on a timeless story', () => {
    expect(fields(draft({ timeless: true, yearStart: 'nonsense' }))).toEqual([]);
  });

  it('speaks Romanian', () => {
    expect(placeDateErrors(draft({ coords: 'x' }), 'ro')[0].message).toMatch(/Coordonatele/);
  });
});

describe('draftToPlaceDate', () => {
  it('produces what the database accepts', () => {
    const p = draftToPlaceDate(draft({ coords: '44.435531, 26.101822', placeNameEn: ' University Square ', yearStart: '1989', yearEnd: '1989', eraLabelEn: '21–22 December 1989' }));
    expect(p).toEqual({
      lat: 44.4355, lng: 26.1018, placeNameEn: 'University Square', placeNameRo: null,
      yearStart: 1989, yearEnd: null, eraLabelEn: '21–22 December 1989', eraLabelRo: null, timeless: false,
    });
    expect(() => validatePlaceDate(p)).not.toThrow();
  });

  it('drops years and the period label from a timeless story', () => {
    const p = draftToPlaceDate(draft({ timeless: true, yearStart: '1500', eraLabelEn: 'Old' }));
    expect([p.yearStart, p.yearEnd, p.eraLabelEn, p.timeless]).toEqual([null, null, null, true]);
    expect(() => validatePlaceDate(p)).not.toThrow();
  });
});

describe('round trip and sending', () => {
  const article = (over: Partial<Article>): Article => ({
    id: 'a', titleEn: '', titleRo: '', contentEn: '', contentRo: '', categoryId: 'c', userId: 'u',
    isPublished: true, type: 'text', createdAt: '', ...over,
  });

  it('loads an article into the form and back', () => {
    const { draft: d, supported } = draftFromArticle(article({ lat: 45.3599, lng: 25.5426, yearStart: 1873, yearEnd: 1914, timeless: false, placeNameEn: 'Peleș Castle, Sinaia' }));
    expect(supported).toBe(true);
    expect(d.coords).toBe(formatCoords(45.3599, 25.5426));
    expect(draftToPlaceDate(d)).toMatchObject({ lat: 45.3599, lng: 25.5426, yearStart: 1873, yearEnd: 1914 });
  });

  it('knows a row read before the migration', () => {
    expect(draftFromArticle(article({})).supported).toBe(false);
  });

  it('sends nothing for an untouched form on an old database', () => {
    expect(isDraftEmpty(draft({ placeNameEn: '   ' }))).toBe(true);
    expect(shouldSendPlaceDate(draft(), false)).toBe(false);
    expect(shouldSendPlaceDate(draft({ yearStart: '1900' }), false)).toBe(true);
    expect(shouldSendPlaceDate(draft(), true)).toBe(true);
  });
});
