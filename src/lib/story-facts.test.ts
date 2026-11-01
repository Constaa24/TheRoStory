import { describe, it, expect } from 'vitest';
import {
  formatYear,
  placeOf,
  whenOf,
  placeAndTime,
  kindPhrase,
  readPhrase,
  toRoman,
  splitTitle,
  parseStoryChapters,
  splitOpening,
  pinOf,
} from './story-facts';
import { CHAPTER_DELIMITER, type Article } from './supabase';

/**
 * The facts every storybook card and title page leads with — where, when,
 * what kind of story, how long. Like the other copy helpers they never
 * throw: a slip here renders a plausible, wrong line on every card.
 */

const article = (over: Partial<Article> = {}): Article => ({
  id: 'art_1',
  titleEn: 'The Guardian of Time',
  titleRo: 'Paznicul timpului',
  contentEn: '',
  contentRo: '',
  categoryId: 'cat_1',
  userId: 'user_1',
  isPublished: true,
  type: 'text',
  createdAt: '2026-06-18T10:00:00.000Z',
  ...over,
});

describe('formatYear', () => {
  it('writes years before Christ the way each language does', () => {
    expect(formatYear(1916, 'en')).toBe('1916');
    expect(formatYear(-106, 'en')).toBe('106 BC');
    expect(formatYear(-106, 'ro')).toBe('106 î.Hr.');
  });
});

describe('placeOf', () => {
  it('prefers the named place, in the reader\'s language, then the other, then the county', () => {
    const named = article({ placeNameEn: 'Clock Tower, Sighișoara', placeNameRo: 'Turnul cu Ceas, Sighișoara', location: 'Mureș' });
    expect(placeOf(named, 'en')).toBe('Clock Tower, Sighișoara');
    expect(placeOf(named, 'ro')).toBe('Turnul cu Ceas, Sighișoara');
    expect(placeOf(article({ placeNameEn: 'Peleș Castle', location: 'Prahova' }), 'ro')).toBe('Peleș Castle');
    expect(placeOf(article({ location: 'Prahova' }), 'en')).toBe('Prahova');
  });

  it('is null for a story placed nowhere', () => {
    expect(placeOf(article({ location: '  ' }), 'en')).toBeNull();
  });
});

describe('whenOf', () => {
  it('says "timeless" for a legend, whatever its years say', () => {
    expect(whenOf(article({ timeless: true, yearStart: 1800 }), 'en')).toBe('timeless');
    expect(whenOf(article({ timeless: true }), 'ro')).toBe('atemporală');
  });

  it('uses the era label when there is one', () => {
    expect(whenOf(article({ yearStart: 1301, yearEnd: 1400, eraLabelEn: '14th century', eraLabelRo: 'secolul al XIV-lea' }), 'ro'))
      .toBe('secolul al XIV-lea');
  });

  it('otherwise gives the years, collapsing a single year', () => {
    expect(whenOf(article({ yearStart: 1873, yearEnd: 1914 }), 'en')).toBe('1873–1914');
    expect(whenOf(article({ yearStart: 1916, yearEnd: 1916 }), 'en')).toBe('1916');
    expect(whenOf(article({ yearStart: -106 }), 'ro')).toBe('106 î.Hr.');
  });

  it('is null for an undated story', () => {
    expect(whenOf(article(), 'en')).toBeNull();
  });
});

describe('placeAndTime', () => {
  it('joins whichever of the two the story has', () => {
    expect(placeAndTime(article({ location: 'Bacău', yearStart: 1916 }), 'en')).toBe('Bacău · 1916');
    expect(placeAndTime(article({ location: 'Bacău' }), 'en')).toBe('Bacău');
    expect(placeAndTime(article({ timeless: true }), 'en')).toBe('timeless');
    expect(placeAndTime(article(), 'en')).toBeNull();
  });
});

describe('kindPhrase', () => {
  it('names each kind of story', () => {
    expect(kindPhrase(article(), 'en')).toBe('An essay');
    expect(kindPhrase(article({ subtype: 'poetry' }), 'ro')).toBe('Un poem');
    expect(kindPhrase(article({ subtype: 'short_story' }), 'en')).toBe('A short story');
    expect(kindPhrase(article({ type: 'video' }), 'ro')).toBe('Un film');
  });

  it('counts a visual essay\'s frames, with Romanian plurals', () => {
    expect(kindPhrase(article({ type: 'carousel', mediaUrls: ['a', 'b'] }), 'en')).toBe('A visual essay · 2 frames');
    expect(kindPhrase(article({ type: 'carousel', mediaUrls: ['a'] }), 'ro')).toBe('Un eseu vizual · 1 cadru');
    expect(kindPhrase(article({ type: 'carousel', mediaUrls: Array(20).fill('x') }), 'ro')).toBe('Un eseu vizual · 20 de cadre');
    expect(kindPhrase(article({ type: 'carousel' }), 'en')).toBe('A visual essay');
  });
});

describe('readPhrase', () => {
  it('gives a read time, and a film is watched instead', () => {
    expect(readPhrase(article({ contentEn: 'word '.repeat(600).trim() }), 'en')).toBe('3-minute read');
    expect(readPhrase(article({ contentRo: 'cuvânt '.repeat(40).trim() }), 'ro')).toBe('Lectură de 1 minut');
    expect(readPhrase(article({ type: 'video' }), 'en')).toBe('Watch the film');
  });
});

describe('toRoman', () => {
  it('numbers chapters as a book does', () => {
    expect([1, 4, 9, 14, 40, 49].map(toRoman)).toEqual(['I', 'IV', 'IX', 'XIV', 'XL', 'XLIX']);
  });

  it('never prints an empty numeral', () => {
    expect(toRoman(0)).toBe('I');
  });
});

describe('splitTitle', () => {
  it('splits at the first colon into a title and its subtitle', () => {
    expect(splitTitle('The Guardian of Time: The Clock Tower of Sighișoara'))
      .toEqual({ main: 'The Guardian of Time', sub: 'The Clock Tower of Sighișoara' });
    expect(splitTitle('A: B: C')).toEqual({ main: 'A', sub: 'B: C' });
  });

  it('leaves a title alone when the colon is not a subtitle break', () => {
    expect(splitTitle('Lead')).toEqual({ main: 'Lead', sub: null });
    expect(splitTitle(': nothing before')).toEqual({ main: ': nothing before', sub: null });
    expect(splitTitle('Ends in a colon:')).toEqual({ main: 'Ends in a colon:', sub: null });
  });
});

describe('parseStoryChapters', () => {
  it('reads an optional "# Title" line as the chapter\'s title, not its words', () => {
    const content = ['# Kronstadt, 1383\nWhen Brașov was still known as Kronstadt, there lived…', 'The moment that changed everything came in 1689.'].join(CHAPTER_DELIMITER);
    const [first, second] = parseStoryChapters(content);
    expect(first.title).toBe('Kronstadt, 1383');
    expect(first.body.startsWith('When Brașov')).toBe(true);
    expect(second.title).toBeNull();
  });

  it('gives each chapter its first five words for the chapter path', () => {
    const [ch] = parseStoryChapters('For three centuries, the tower stood invincible.');
    expect(ch.incipit).toBe('For three centuries, the tower…');
    const [short] = parseStoryChapters('> Only three words.');
    expect(short.incipit).toBe('Only three words');
  });

  it('drops empty chapters and survives empty content', () => {
    expect(parseStoryChapters(['One.', '   ', 'Two.'].join(CHAPTER_DELIMITER))).toHaveLength(2);
    expect(parseStoryChapters('')).toEqual([]);
  });
});

describe('splitOpening', () => {
  it('splits off the opening words, keeping the rest exactly', () => {
    expect(splitOpening('To look at the Clock Tower today', 4)).toEqual(['To look at the', ' Clock Tower today']);
  });

  it('returns a short paragraph whole', () => {
    expect(splitOpening('Too short.', 4)).toEqual(['Too short.', '']);
  });
});

describe('pinOf', () => {
  it('pins an exact place inside the outline', () => {
    // Sighișoara's clock tower.
    const pin = pinOf(article({ lat: 46.2194, lng: 24.7925 }));
    expect(pin?.exact).toBe(true);
    expect(pin!.left).toBeGreaterThan(30);
    expect(pin!.left).toBeLessThan(70);
    expect(pin!.top).toBeGreaterThan(20);
    expect(pin!.top).toBeLessThan(80);
  });

  it('falls back to the county\'s centre, marked as approximate', () => {
    const pin = pinOf(article({ location: 'Alba' }));
    expect(pin).not.toBeNull();
    expect(pin!.exact).toBe(false);
  });

  it('has nothing to pin for a story placed nowhere, or in no known county', () => {
    expect(pinOf(article())).toBeNull();
    expect(pinOf(article({ location: 'Atlantis' }))).toBeNull();
  });
});
