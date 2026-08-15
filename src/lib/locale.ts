/**
 * Locale routing.
 *
 * The site is written twice, in English and Romanian, but until now both
 * versions shared one URL: language was a client-side toggle held in
 * localStorage. A story had exactly one address, so a search engine indexed
 * whichever language the toggle happened to default to (English) and had no
 * way to learn the Romanian version existed. For an archive about Romania,
 * whose most motivated readers search in Romanian, that hid half the work.
 *
 * English keeps the bare path and Romanian takes a `/ro` prefix:
 *
 *     /                     /ro
 *     /article/art_123      /ro/article/art_123
 *     /categories           /ro/categories
 *
 * English is deliberately left unprefixed rather than moved to `/en`. Every
 * URL already indexed or shared keeps working and keeps its ranking; the
 * alternative turns all forty of them into redirects for a symmetry nobody
 * looking at the site can see.
 *
 * The prefix is applied through React Router's `basename` (see main.tsx), so
 * every existing `<Link to="/map">` in the app resolves to `/ro/map` on the
 * Romanian side with no change at the call site. The consequence to remember:
 * inside the app, `useLocation().pathname` is always the *unprefixed* path.
 * Anything that builds an absolute, outward-facing URL — canonicals,
 * hreflang, the sitemap, OG tags — has to add the prefix back, which is what
 * `localizedPath` below is for.
 */

export type Language = 'en' | 'ro';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'ro'] as const;

export const DEFAULT_LANGUAGE: Language = 'en';

/** Path segment that marks the Romanian tree. No trailing slash. */
export const RO_PREFIX = '/ro';

/**
 * Reads the locale out of a full (prefixed) pathname.
 *
 * Matches `/ro` exactly and `/ro/...`, but deliberately not `/romania` or
 * `/rock-churches` — a bare `startsWith('/ro')` would swallow both.
 */
export const detectLanguage = (pathname: string): Language =>
  pathname === RO_PREFIX || pathname.startsWith(`${RO_PREFIX}/`) ? 'ro' : DEFAULT_LANGUAGE;

/**
 * The React Router basename for a locale. Router strips this from every
 * location and re-adds it to every generated href.
 */
export const basenameFor = (language: Language): string =>
  language === 'ro' ? RO_PREFIX : '/';

/**
 * Turns an unprefixed in-app path into the full path for a locale.
 * `localizedPath('ro', '/article/x')` -> `/ro/article/x`
 * `localizedPath('en', '/article/x')` -> `/article/x`
 *
 * Takes the path React Router reports (already basename-stripped), so callers
 * never have to reason about whether a prefix is already present.
 */
export const localizedPath = (language: Language, pathname: string): string => {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (language !== 'ro') return clean;
  // '/' would otherwise become '/ro/' — a second URL for the same page.
  return clean === '/' ? RO_PREFIX : `${RO_PREFIX}${clean}`;
};

/**
 * Strips a locale prefix off a full pathname, yielding the in-app path.
 * Inverse of `localizedPath`. Used where we have a real browser pathname
 * rather than a Router one — the language switcher, and the edge middleware.
 */
export const stripLanguage = (pathname: string): string => {
  if (pathname === RO_PREFIX) return '/';
  if (pathname.startsWith(`${RO_PREFIX}/`)) return pathname.slice(RO_PREFIX.length) || '/';
  return pathname || '/';
};

/** BCP 47 tag for hreflang and og:locale. */
export const hreflangFor = (language: Language): string => (language === 'ro' ? 'ro' : 'en');
export const ogLocaleFor = (language: Language): string => (language === 'ro' ? 'ro_RO' : 'en_US');
