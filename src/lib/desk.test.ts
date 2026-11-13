import { describe, it, expect } from 'vitest';
import { groupNotes, lastDays, statusOf } from './desk';
import { toCamelCase, type Article, type Category, type Comment } from './supabase';

describe("the desk's columns, as the app reads them", () => {
  // Rows come back snake_case; a column the map doesn't know keeps that
  // name, and code reading the camelCase field silently gets undefined.
  it('a story keeps its schedule', () => {
    const a = toCamelCase<Article>({ id: 'a', is_published: false, publish_at: '2026-12-01T07:00:00Z' });
    expect(a.publishAt).toBe('2026-12-01T07:00:00Z');
    expect(statusOf(a)).toBe('scheduled');
  });

  it('a note knows it is hidden', () => {
    expect(toCamelCase<Comment>({ id: 'n', hidden_at: '2026-11-10T10:00:00Z' }).hiddenAt).toBe('2026-11-10T10:00:00Z');
  });

  it('a shelf has its descriptions and its place', () => {
    const c = toCamelCase<Category>({ id: 'c', description_en: 'Painters.', description_ro: 'Pictori.', sort_order: 3 });
    expect([c.descriptionEn, c.descriptionRo, c.sortOrder]).toEqual(['Painters.', 'Pictori.', 3]);
  });
});

describe('statusOf', () => {
  it('is published, scheduled or a draft', () => {
    expect(statusOf({ isPublished: true, publishAt: null })).toBe('published');
    expect(statusOf({ isPublished: false, publishAt: '2026-12-01T07:00:00Z' })).toBe('scheduled');
    expect(statusOf({ isPublished: false, publishAt: null })).toBe('draft');
    expect(statusOf({ isPublished: false })).toBe('draft');
  });

  it('a published story is published, whatever schedule it once had', () => {
    expect(statusOf({ isPublished: true, publishAt: '2026-12-01T07:00:00Z' })).toBe('published');
  });
});

describe('lastDays', () => {
  it('ends today, oldest first', () => {
    expect(lastDays(3, new Date('2026-11-13T10:00:00Z'))).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it("counts Bucharest's days, not UTC's", () => {
    // 22:30 UTC is already half past midnight on the 14th in Bucharest.
    expect(lastDays(2, new Date('2026-11-13T22:30:00Z'))).toEqual(['2026-11-13', '2026-11-14']);
  });

  it('crosses months and years', () => {
    expect(lastDays(3, new Date('2026-03-01T10:00:00Z'))).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(lastDays(2, new Date('2027-01-01T10:00:00Z'))).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('keeps every day across the clock changes', () => {
    // Just after midnight on 30 March 2026 (summer time began on the 29th):
    // stepping back 24 hours from now used to land on the 28th, skipping the 29th.
    expect(lastDays(3, new Date('2026-03-29T21:30:00Z'))).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
    // 23:30 on 25 October 2026 (winter time began that night): 24 hours
    // earlier was still the 25th in summer time, so the day came out twice.
    expect(lastDays(2, new Date('2026-10-25T21:30:00Z'))).toEqual(['2026-10-24', '2026-10-25']);
  });

  it('gives consecutive, distinct days at every hour of the year', () => {
    const start = Date.parse('2026-01-01T00:00:00Z');
    for (let h = 0; h < 365 * 24; h++) {
      const days = lastDays(30, new Date(start + h * 3_600_000));
      expect(new Set(days).size).toBe(30);
      for (let i = 1; i < days.length; i++) {
        expect(Date.parse(days[i]) - Date.parse(days[i - 1])).toBe(86_400_000);
      }
    }
  });
});

describe('groupNotes', () => {
  const note = (id: string, flags: number, hiddenAt: string | null = null) => ({ id, flags, hiddenAt });

  it('flagged: on the site and flagged, most flags first', () => {
    const g = groupNotes([note('a', 1), note('b', 0), note('c', 3), note('d', 5, '2026-11-10T10:00:00Z')]);
    expect(g.flagged.map((n) => n.id)).toEqual(['c', 'a']);
  });

  it('on the site: every note not hidden, flagged or not; hidden: the rest', () => {
    const g = groupNotes([note('a', 1), note('b', 0), note('d', 5, '2026-11-10T10:00:00Z')]);
    expect(g.visible.map((n) => n.id)).toEqual(['a', 'b']);
    expect(g.hidden.map((n) => n.id)).toEqual(['d']);
  });

  it('copes with nothing', () => {
    expect(groupNotes([])).toEqual({ flagged: [], visible: [], hidden: [] });
  });
});
