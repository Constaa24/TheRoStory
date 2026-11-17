import { describe, it, expect } from 'vitest';
import { previewArticle, type NewArticleInput } from './supabase';

const base: NewArticleInput = {
  type: 'text',
  subtype: 'essay',
  titleEn: '  The Salt Mine ',
  titleRo: 'Salina',
  contentEn: 'One|||CHAPTER|||Two',
  contentRo: 'Unu|||CHAPTER|||Doi',
  categoryId: 'cat_1',
  userId: 'u1',
  isPublished: false,
  location: ' Cluj ',
  mediaUrl: null,
};
const at = { id: 'art_1', createdAt: '2026-12-01T07:00:00.000Z' };

describe('previewArticle', () => {
  it('is the story a save would make, as the story page reads it', () => {
    const a = previewArticle(base, at);
    expect(a).toMatchObject({
      id: 'art_1', type: 'text', subtype: 'essay', titleEn: 'The Salt Mine', titleRo: 'Salina',
      contentEn: 'One|||CHAPTER|||Two', categoryId: 'cat_1', location: 'Cluj', isPublished: false,
      createdAt: '2026-12-01T07:00:00.000Z',
    });
  });

  it('carries the schedule, which a published story drops', () => {
    expect(previewArticle({ ...base, publishAt: at.createdAt }, at).publishAt).toBe(at.createdAt);
    expect(previewArticle({ ...base, isPublished: true, publishAt: at.createdAt }, at).publishAt).toBeNull();
  });

  it('carries the place and time, the note, and a film’s extras', () => {
    const a = previewArticle({
      ...base,
      type: 'video',
      placeDate: { lat: 46.77, lng: 23.6, placeNameEn: ' Cluj ', placeNameRo: 'Cluj', yearStart: 1900, yearEnd: null, eraLabelEn: null, eraLabelRo: null, timeless: false },
      note: { en: 'Why', ro: 'De ce' },
      film: { subtitlesEnUrl: 'https://x/en.vtt', subtitlesRoUrl: null, chapters: [{ t: 0, en: 'Start', ro: 'Început' }] },
    }, at);
    expect(a).toMatchObject({ lat: 46.77, placeNameEn: 'Cluj', yearStart: 1900, noteEn: 'Why', subtitlesEnUrl: 'https://x/en.vtt' });
    expect(a.filmChapters).toHaveLength(1);
    // Only a written story has a subtype.
    expect(a.subtype).toBeNull();
  });
});
