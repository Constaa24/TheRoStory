import { describe, it, expect } from 'vitest';
import {
  formatArticleDate,
  getArticleKindLabel,
  readMinutes,
  articleExcerpt,
  articleCoverUrl,
  toneFor,
  placeLabel,
  TONES,
} from './article-utils';
import { CHAPTER_DELIMITER, type Article } from './supabase';

/**
 * These helpers produce almost every string a reader sees that isn't the
 * article body itself: the kind label on a card, the byline date, the read
 * time, the excerpt that doubles as the meta description, and the image the
 * card falls back to. None of them throw when they go wrong — they render
 * something plausible and slightly false, which is why they need tests
 * rather than types.
 */

const article = (over: Partial<Article> = {}): Article => ({
  id: 'art_1',
  titleEn: 'Painted Monasteries',
  titleRo: 'Mănăstirile Pictate',
  contentEn: '',
  contentRo: '',
  categoryId: 'cat_1',
  userId: 'user_1',
  isPublished: true,
  type: 'text',
  createdAt: '2026-03-14T10:00:00.000Z',
  ...over,
});

describe('formatArticleDate', () => {
  it('formats in the reader\'s locale', () => {
    expect(formatArticleDate('2026-03-14T10:00:00.000Z', 'en')).toBe('14 March 2026');
    expect(formatArticleDate('2026-03-14T10:00:00.000Z', 'en', 'short')).toBe('14 Mar 2026');
    // ro-RO renders month names lowercase, and that is correct Romanian.
    expect(formatArticleDate('2026-03-14T10:00:00.000Z', 'ro')).toContain('2026');
    expect(formatArticleDate('2026-03-14T10:00:00.000Z', 'ro')).toContain('14');
  });

  /**
   * The regression this file was opened for. `toLocaleDateString` does not
   * throw on an invalid date — it returns the literal string "Invalid Date".
   * The original try/catch therefore never fired and that string rendered
   * straight into the byline.
   */
  it('returns empty rather than the words "Invalid Date"', () => {
    for (const bad of ['not-a-date', '2026-13-45', 'undefined', '???']) {
      expect(formatArticleDate(bad, 'en')).toBe('');
      expect(formatArticleDate(bad, 'ro', 'short')).toBe('');
    }
  });

  /**
   * `new Date(null)` is not invalid, it is the epoch — so a null slipping
   * past the type would have printed "1 January 1970" as a publication date.
   */
  it('rejects falsy input instead of printing the epoch', () => {
    for (const empty of ['', null, undefined]) {
      expect(formatArticleDate(empty as unknown as string, 'en')).toBe('');
    }
  });
});

describe('getArticleKindLabel', () => {
  it('labels the three story types', () => {
    expect(getArticleKindLabel({ type: 'video', subtype: null }, 'en')).toBe('Film');
    expect(getArticleKindLabel({ type: 'carousel', subtype: null }, 'en')).toBe('Photo essay');
    expect(getArticleKindLabel({ type: 'carousel', subtype: null }, 'ro')).toBe('Eseu foto');
  });

  it('lets a text story override the default with a subtype', () => {
    expect(getArticleKindLabel({ type: 'text', subtype: 'poetry' }, 'en')).toBe('Poem');
    expect(getArticleKindLabel({ type: 'text', subtype: 'short_story' }, 'en')).toBe('Short story');
    expect(getArticleKindLabel({ type: 'text', subtype: 'short_story' }, 'ro')).toBe('Povestire');
  });

  /** Legacy rows predate the column and must keep their original wording. */
  it('treats a missing subtype as an essay', () => {
    expect(getArticleKindLabel({ type: 'text', subtype: null }, 'en')).toBe('Long read');
    expect(getArticleKindLabel({ type: 'text', subtype: undefined }, 'ro')).toBe('Lectură lungă');
  });

  /** A subtype on a non-text story is meaningless and must not leak through. */
  it('ignores subtype on video and carousel', () => {
    expect(getArticleKindLabel({ type: 'video', subtype: 'poetry' }, 'en')).toBe('Film');
    expect(getArticleKindLabel({ type: 'carousel', subtype: 'poetry' }, 'en')).toBe('Photo essay');
  });
});

describe('readMinutes', () => {
  it('rounds up and never drops below one minute', () => {
    expect(readMinutes(article({ contentEn: 'one two three' }), 'en')).toBe(1);
    expect(readMinutes(article({ contentEn: 'word '.repeat(200).trim() }), 'en')).toBe(1);
    expect(readMinutes(article({ contentEn: 'word '.repeat(201).trim() }), 'en')).toBe(2);
    expect(readMinutes(article({ contentEn: 'word '.repeat(600).trim() }), 'en')).toBe(3);
  });

  /**
   * Chapters are joined with no surrounding whitespace, so leaving the
   * delimiter in merges the last word of one chapter with the first of the
   * next and undercounts by one per boundary.
   */
  it('counts across chapter boundaries', () => {
    const joined = ['alpha', 'beta', 'gamma'].join(CHAPTER_DELIMITER);
    expect(readMinutes(article({ contentEn: joined }), 'en')).toBe(1);
    const long = Array.from({ length: 3 }, () => 'word '.repeat(100).trim()).join(CHAPTER_DELIMITER);
    // 300 words split across 3 chapters — the delimiter must not fuse them
    // into 298 tokens, and must not survive as a countable word either.
    expect(readMinutes(article({ contentEn: long }), 'en')).toBe(2);
  });

  /** An English-only story read in Romanian used to score a zero word count. */
  it('falls back to the other language when a translation is empty', () => {
    const enOnly = article({ contentEn: 'word '.repeat(400).trim(), contentRo: '' });
    expect(readMinutes(enOnly, 'ro')).toBe(2);
    expect(readMinutes(enOnly, 'ro')).toBe(readMinutes(enOnly, 'en'));
  });

  it('still reports a minute for an empty story', () => {
    expect(readMinutes(article(), 'en')).toBe(1);
  });
});

describe('articleExcerpt', () => {
  it('strips the chapter delimiter so it never reaches a meta description', () => {
    const joined = ['First chapter.', 'Second chapter.'].join(CHAPTER_DELIMITER);
    const out = articleExcerpt(article({ contentEn: joined }), 'en', 200);
    expect(out).not.toContain(CHAPTER_DELIMITER);
    expect(out).toBe('First chapter. Second chapter.');
  });

  it('drops markdown and pull-quote markers and collapses whitespace', () => {
    const messy = article({ contentEn: '# Title\n\n> *A quote*   with   `code`_' });
    expect(articleExcerpt(messy, 'en', 200)).toBe('Title A quote with code');
  });

  it('clamps with an ellipsis, and only when it needs to', () => {
    const short = article({ contentEn: 'Short enough.' });
    expect(articleExcerpt(short, 'en', 200)).toBe('Short enough.');

    const long = article({ contentEn: 'a'.repeat(300) });
    const clamped = articleExcerpt(long, 'en', 100);
    expect(clamped).toHaveLength(101); // 100 chars + the ellipsis
    expect(clamped.endsWith('…')).toBe(true);
  });

  it('does not leave a dangling space before the ellipsis', () => {
    const out = articleExcerpt(article({ contentEn: 'aaaa bbbb cccc dddd' }), 'en', 10);
    expect(out).toBe('aaaa bbbb…');
  });

  it('falls back to the other language, like read time does', () => {
    const enOnly = article({ contentEn: 'Only English here.', contentRo: '   ' });
    expect(articleExcerpt(enOnly, 'ro', 200)).toBe('Only English here.');
  });
});

describe('articleCoverUrl', () => {
  /** mediaUrl on a video is the film itself and renders as a broken <img>. */
  it('never falls back to mediaUrl for a video', () => {
    expect(articleCoverUrl({ type: 'video', mediaUrl: 'clip.mp4', posterUrl: undefined, mediaUrls: undefined }))
      .toBeUndefined();
    expect(articleCoverUrl({ type: 'video', mediaUrl: 'clip.mp4', posterUrl: 'poster.jpg', mediaUrls: undefined }))
      .toBe('poster.jpg');
  });

  it('prefers the poster, then the first frame, for a carousel', () => {
    expect(articleCoverUrl({ type: 'carousel', posterUrl: 'poster.jpg', mediaUrls: ['a.jpg'], mediaUrl: 'b.jpg' }))
      .toBe('poster.jpg');
    expect(articleCoverUrl({ type: 'carousel', posterUrl: undefined, mediaUrls: ['a.jpg', 'b.jpg'], mediaUrl: 'c.jpg' }))
      .toBe('a.jpg');
    expect(articleCoverUrl({ type: 'carousel', posterUrl: undefined, mediaUrls: [], mediaUrl: 'c.jpg' }))
      .toBe('c.jpg');
  });

  it('prefers mediaUrl for a text story', () => {
    expect(articleCoverUrl({ type: 'text', mediaUrl: 'a.jpg', posterUrl: 'b.jpg', mediaUrls: undefined }))
      .toBe('a.jpg');
    expect(articleCoverUrl({ type: 'text', mediaUrl: undefined, posterUrl: 'b.jpg', mediaUrls: undefined }))
      .toBe('b.jpg');
  });

  /** Callers render a tone placeholder on undefined — never an empty src. */
  it('returns undefined rather than an empty string when there is no image', () => {
    expect(articleCoverUrl({ type: 'text', mediaUrl: '', posterUrl: '', mediaUrls: [] })).toBeUndefined();
  });
});

describe('toneFor', () => {
  it('is deterministic and always a real tone', () => {
    for (const id of ['art_1', 'art_2', 'a', '', 'x'.repeat(64)]) {
      const tone = toneFor(id);
      expect(TONES).toContain(tone);
      expect(toneFor(id)).toBe(tone);
    }
  });

  it('spreads ids across more than one tone', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => toneFor(`art_${i}`)));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('placeLabel', () => {
  it('uppercases, and is empty when there is no location', () => {
    expect(placeLabel({ location: 'Bucovina' })).toBe('BUCOVINA');
    expect(placeLabel({ location: undefined })).toBe('');
  });
});
