import { describe, it, expect } from 'vitest';
import { categoryDescription, shelfBlurb } from './category-copy';

const history = { slug: 'history', nameEn: 'History', nameRo: 'Istorie' };

describe('shelfBlurb', () => {
  it("a shelf's own description, in the reader's language", () => {
    const shelf = { ...history, descriptionEn: 'Battles and the people between them.', descriptionRo: 'Bătălii și oamenii dintre ele.' };
    expect(shelfBlurb(shelf, 'en')).toBe('Battles and the people between them.');
    expect(shelfBlurb(shelf, 'ro')).toBe('Bătălii și oamenii dintre ele.');
  });

  it('without one, the built-in line', () => {
    expect(shelfBlurb(history, 'en')).toBe(categoryDescription('history', 'History', 'en'));
    expect(shelfBlurb({ ...history, descriptionEn: null, descriptionRo: '   ' }, 'ro')).toBe(categoryDescription('history', 'Istorie', 'ro'));
  });

  it('an English description is never shown to Romanian readers', () => {
    const shelf = { ...history, descriptionEn: 'Only in English.' };
    expect(shelfBlurb(shelf, 'ro')).toBe(categoryDescription('history', 'Istorie', 'ro'));
  });

  it('trims what was written', () => {
    expect(shelfBlurb({ ...history, descriptionEn: '  Spaced out.  ' }, 'en')).toBe('Spaced out.');
  });

  it('a shelf with no slug falls back on its name', () => {
    const shelf = { nameEn: 'Folk Music', nameRo: 'Muzică populară' };
    expect(shelfBlurb(shelf, 'en')).toBe(categoryDescription('folk music', 'Folk Music', 'en'));
  });
});
