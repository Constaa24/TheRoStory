import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  basenameFor,
  localizedPath,
  stripLanguage,
  ogLocaleFor,
  RO_PREFIX,
  DEFAULT_LANGUAGE,
  type Language,
} from './locale';

/**
 * These helpers decide, for every request, which language the reader gets and
 * what every canonical and hreflang URL says. A bug here is close to
 * invisible: the page still renders, it just renders the wrong language, or
 * tells Google two URLs are the same page when they are not.
 *
 * The cases below are the ones the module's own comments call out as traps.
 */
describe('detectLanguage', () => {
  it('matches the Romanian tree', () => {
    expect(detectLanguage('/ro')).toBe('ro');
    expect(detectLanguage('/ro/')).toBe('ro');
    expect(detectLanguage('/ro/categories')).toBe('ro');
    expect(detectLanguage('/ro/article/art_123')).toBe('ro');
  });

  it('does not swallow English paths that merely start with the letters "ro"', () => {
    // The whole reason detectLanguage isn't a startsWith('/ro'). An article
    // slugged "romania" is the single most likely title on this site.
    expect(detectLanguage('/romania')).toBe('en');
    expect(detectLanguage('/rock-churches')).toBe('en');
    expect(detectLanguage('/roman-ruins/sarmizegetusa')).toBe('en');
  });

  it('treats "ro" appearing later in the path as English', () => {
    expect(detectLanguage('/article/ro')).toBe('en');
    expect(detectLanguage('/category/ro')).toBe('en');
  });

  it('defaults to English at the root', () => {
    expect(detectLanguage('/')).toBe('en');
    expect(detectLanguage('')).toBe(DEFAULT_LANGUAGE);
  });
});

describe('localizedPath', () => {
  it('leaves English paths bare', () => {
    expect(localizedPath('en', '/')).toBe('/');
    expect(localizedPath('en', '/categories')).toBe('/categories');
    expect(localizedPath('en', '/article/art_1')).toBe('/article/art_1');
  });

  it('prefixes Romanian paths', () => {
    expect(localizedPath('ro', '/categories')).toBe('/ro/categories');
    expect(localizedPath('ro', '/article/art_1')).toBe('/ro/article/art_1');
  });

  it('maps the Romanian home to /ro, never /ro/', () => {
    // '/ro/' would be a second URL for the same page — a canonical that
    // disagrees with itself, and duplicate content in Search Console.
    expect(localizedPath('ro', '/')).toBe(RO_PREFIX);
    expect(localizedPath('ro', '/')).not.toBe('/ro/');
  });

  it('tolerates a path handed over without its leading slash', () => {
    expect(localizedPath('en', 'categories')).toBe('/categories');
    expect(localizedPath('ro', 'categories')).toBe('/ro/categories');
  });
});

describe('stripLanguage', () => {
  it('removes the prefix', () => {
    expect(stripLanguage('/ro')).toBe('/');
    expect(stripLanguage('/ro/')).toBe('/');
    expect(stripLanguage('/ro/categories')).toBe('/categories');
  });

  it('leaves English paths alone, including look-alikes', () => {
    expect(stripLanguage('/categories')).toBe('/categories');
    expect(stripLanguage('/romania')).toBe('/romania');
    expect(stripLanguage('/')).toBe('/');
  });
});

describe('localizedPath and stripLanguage are inverses', () => {
  const paths = [
    '/',
    '/categories',
    '/article/art_123',
    '/category/history',
    '/romania',
    '/rock-churches',
    '/article/ro',
    '/support',
  ];
  const languages: Language[] = ['en', 'ro'];

  it.each(languages)('round-trips every path for %s', (language) => {
    for (const p of paths) {
      expect(stripLanguage(localizedPath(language, p))).toBe(p);
    }
  });

  it.each(languages)('the prefixed path detects back as %s', (language) => {
    for (const p of paths) {
      expect(detectLanguage(localizedPath(language, p))).toBe(language);
    }
  });
});

describe('router and metadata helpers', () => {
  it('gives Router the right basename', () => {
    expect(basenameFor('en')).toBe('/');
    expect(basenameFor('ro')).toBe(RO_PREFIX);
  });

  it('maps to Open Graph locales', () => {
    expect(ogLocaleFor('en')).toBe('en_US');
    expect(ogLocaleFor('ro')).toBe('ro_RO');
  });
});
