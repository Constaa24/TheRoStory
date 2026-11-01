/**
 * The editors' "Place & time" fields: what the form holds while someone
 * types, and how it becomes the ArticlePlaceDate the database stores.
 * Pure functions, shared by all three story editors.
 */
import { PLACE_DATE_LIMITS, type Article, type ArticlePlaceDate } from '@/lib/supabase';

export type PlaceDateDraft = {
  /** "lat, lng" as typed, pasted from a map app, or set by the pin picker. */
  coords: string;
  placeNameEn: string;
  placeNameRo: string;
  yearStart: string;
  yearEnd: string;
  eraLabelEn: string;
  eraLabelRo: string;
  timeless: boolean;
};

export const EMPTY_PLACE_DATE: PlaceDateDraft = {
  coords: '',
  placeNameEn: '',
  placeNameRo: '',
  yearStart: '',
  yearEnd: '',
  eraLabelEn: '',
  eraLabelRo: '',
  timeless: false,
};

/** Four decimals is about ten metres: as exact as a story's place needs. */
export const formatCoords = (lat: number, lng: number): string => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

/**
 * Reads "44.4355, 26.1018" — and the variants map apps copy: no comma,
 * extra spaces, a trailing degree sign. Null for an empty field.
 */
export const parseCoords = (text: string): { lat: number; lng: number } | null | 'invalid' => {
  const t = text.trim();
  if (!t) return null;
  const nums = t.replace(/°/g, '').split(/[\s,;]+/).filter(Boolean).map(Number);
  if (nums.length !== 2 || nums.some((n) => !Number.isFinite(n))) return 'invalid';
  return { lat: nums[0], lng: nums[1] };
};

const parseYear = (text: string): number | null | 'invalid' => {
  const t = text.trim().replace(/^[−–]/, '-');
  if (!t) return null;
  return /^-?\d{1,4}$/.test(t) ? Number(t) : 'invalid';
};

/**
 * The draft for an article, and whether the article was read with the
 * place/date columns at all. A row fetched before the Atlas migration
 * carries none of them, and the editor must then not send them back.
 */
export const draftFromArticle = (a: Article): { draft: PlaceDateDraft; supported: boolean } => ({
  supported: 'timeless' in a,
  draft: {
    coords: a.lat != null && a.lng != null ? formatCoords(a.lat, a.lng) : '',
    placeNameEn: a.placeNameEn ?? '',
    placeNameRo: a.placeNameRo ?? '',
    yearStart: a.yearStart != null ? String(a.yearStart) : '',
    yearEnd: a.yearEnd != null ? String(a.yearEnd) : '',
    eraLabelEn: a.eraLabelEn ?? '',
    eraLabelRo: a.eraLabelRo ?? '',
    timeless: !!a.timeless,
  },
});

export const isDraftEmpty = (d: PlaceDateDraft): boolean =>
  (Object.keys(EMPTY_PLACE_DATE) as (keyof PlaceDateDraft)[]).every((k) =>
    typeof d[k] === 'string' ? !(d[k] as string).trim() : d[k] === EMPTY_PLACE_DATE[k]
  );

export type PlaceDateError = { field: string; message: string };

/** Every problem with the draft, in the editor's language. */
export const placeDateErrors = (d: PlaceDateDraft, lang: 'en' | 'ro'): PlaceDateError[] => {
  const L = PLACE_DATE_LIMITS;
  const en = lang === 'en';
  const errs: PlaceDateError[] = [];
  const coords = parseCoords(d.coords);
  if (coords === 'invalid') {
    errs.push({ field: 'coords', message: en ? 'Coordinates should look like “44.4355, 26.1018”' : 'Coordonatele trebuie să arate ca „44.4355, 26.1018”' });
  } else if (coords && (coords.lat < L.LAT_MIN || coords.lat > L.LAT_MAX || coords.lng < L.LNG_MIN || coords.lng > L.LNG_MAX)) {
    errs.push({
      field: 'coords',
      message: en
        ? 'That point is outside Romania — check the order is latitude, then longitude'
        : 'Punctul e în afara României — verifică ordinea: latitudine, apoi longitudine',
    });
  }
  if (d.timeless) return errs;
  const y0 = parseYear(d.yearStart);
  const y1 = parseYear(d.yearEnd);
  const inRange = (y: number) => y >= L.YEAR_MIN && y <= L.YEAR_MAX;
  if (y0 === 'invalid' || (typeof y0 === 'number' && !inRange(y0))) {
    errs.push({ field: 'yearStart', message: en ? 'Start year must be a year, e.g. 1859 (or -82 for 82 BC)' : 'Anul de început trebuie să fie un an, ex. 1859 (sau -82 pentru 82 î.Hr.)' });
  }
  if (y1 === 'invalid' || (typeof y1 === 'number' && !inRange(y1))) {
    errs.push({ field: 'yearEnd', message: en ? 'End year must be a year' : 'Anul de sfârșit trebuie să fie un an' });
  } else if (typeof y1 === 'number' && y0 === null) {
    errs.push({ field: 'yearStart', message: en ? 'Add a start year before an end year' : 'Adaugă un an de început înaintea celui de sfârșit' });
  } else if (typeof y1 === 'number' && typeof y0 === 'number' && y1 < y0) {
    errs.push({ field: 'yearEnd', message: en ? 'End year is before the start year' : 'Anul de sfârșit e înaintea celui de început' });
  }
  return errs;
};

/**
 * The value to save. Only call once placeDateErrors() is empty. A timeless
 * story drops any years still sitting in the form, and an end year equal to
 * the start is stored as a single year.
 */
export const draftToPlaceDate = (d: PlaceDateDraft): ArticlePlaceDate => {
  const coords = parseCoords(d.coords);
  const point = coords && coords !== 'invalid' ? coords : null;
  const y0 = d.timeless ? null : parseYear(d.yearStart);
  const y1 = d.timeless ? null : parseYear(d.yearEnd);
  const start = typeof y0 === 'number' ? y0 : null;
  const end = typeof y1 === 'number' && start != null && y1 !== start ? y1 : null;
  return {
    lat: point ? Math.round(point.lat * 1e4) / 1e4 : null,
    lng: point ? Math.round(point.lng * 1e4) / 1e4 : null,
    placeNameEn: d.placeNameEn.trim() || null,
    placeNameRo: d.placeNameRo.trim() || null,
    yearStart: start,
    yearEnd: end,
    eraLabelEn: start != null ? d.eraLabelEn.trim() || null : null,
    eraLabelRo: start != null ? d.eraLabelRo.trim() || null : null,
    timeless: d.timeless,
  };
};

/**
 * Whether a save should include place and date. Always for a story read
 * with the columns (so clearing a field clears it); for a new story or one
 * read before the migration, only once something has been filled in.
 */
export const shouldSendPlaceDate = (d: PlaceDateDraft, supported: boolean): boolean => supported || !isDraftEmpty(d);
