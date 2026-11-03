import { createClient } from '@supabase/supabase-js';
import { isAbortError } from './utils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---- Column name mapping utilities ----

const COLUMN_MAP: Record<string, string> = {
  nameEn: 'name_en',
  nameRo: 'name_ro',
  titleEn: 'title_en',
  titleRo: 'title_ro',
  contentEn: 'content_en',
  contentRo: 'content_ro',
  categoryId: 'category_id',
  mediaUrl: 'media_url',
  posterUrl: 'poster_url',
  userId: 'user_id',
  isPublished: 'is_published',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  articleId: 'article_id',
  userDisplayName: 'user_display_name',
  displayName: 'display_name',
  avatarUrl: 'avatar_url',
  location: 'location',
  mediaUrls: 'media_urls',
  mediaCaptions: 'media_captions',
  placeNameEn: 'place_name_en',
  placeNameRo: 'place_name_ro',
  yearStart: 'year_start',
  yearEnd: 'year_end',
  eraLabelEn: 'era_label_en',
  eraLabelRo: 'era_label_ro',
  introEn: 'intro_en',
  introRo: 'intro_ro',
  sortOrder: 'sort_order',
  noteEn: 'note_en',
  noteRo: 'note_ro',
  subtitlesEnUrl: 'subtitles_en_url',
  subtitlesRoUrl: 'subtitles_ro_url',
  filmChapters: 'film_chapters',
};

const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([k, v]) => [v, k])
);

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[COLUMN_MAP[key] || key] = value;
  }
  return result;
}

export function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[REVERSE_MAP[key] || key] = value;
  }
  return result as T;
}

function toCamelCaseArray<T>(arr: Record<string, unknown>[]): T[] {
  return arr.map(item => toCamelCase<T>(item));
}

// ---- Types ----

export type Category = {
  id: string;
  nameEn: string;
  nameRo: string;
  slug: string;
  createdAt: string;
};

export type MediaCaption = { en: string; ro: string };

/** A chapter of a film: where it starts, in seconds, and its title. */
export type FilmChapter = { t: number; en?: string; ro?: string };

/**
 * A dated point in a text story, tied to one chapter: "1383 · The first
 * stones". Keys are stored as written (snake_case) inside the JSON column.
 */
export type StoryMoment = {
  chapter: number;
  when_en?: string;
  when_ro?: string;
  label_en?: string;
  label_ro?: string;
};

// Subtype is a rendering hint for `text` articles only. NULL/undefined is
// treated as 'essay' so existing rows render unchanged.
export type ArticleSubtype = 'essay' | 'poetry' | 'short_story';

export type Article = {
  id: string;
  titleEn: string;
  titleRo: string;
  contentEn: string;
  contentRo: string;
  categoryId: string;
  mediaUrl?: string;
  posterUrl?: string;
  userId: string;
  isPublished: boolean;
  type: 'text' | 'video' | 'carousel';
  subtype?: ArticleSubtype | null;
  mediaUrls?: string[];
  mediaCaptions?: MediaCaption[];
  location?: string;
  // Atlas place and date (migration 20261031120000). Absent — not merely
  // null — on rows read before that migration ran.
  lat?: number | null;
  lng?: number | null;
  placeNameEn?: string | null;
  placeNameRo?: string | null;
  yearStart?: number | null;
  yearEnd?: number | null;
  eraLabelEn?: string | null;
  eraLabelRo?: string | null;
  timeless?: boolean;
  // Optional "About this story" note (migration 20261101090000).
  noteEn?: string | null;
  noteRo?: string | null;
  // Films: subtitles and chapters. Text stories: dated moments (migration
  // 20261102140000). Absent on rows read before it ran.
  subtitlesEnUrl?: string | null;
  subtitlesRoUrl?: string | null;
  filmChapters?: FilmChapter[] | null;
  moments?: StoryMoment[] | null;
  createdAt: string;
  updatedAt?: string;
};

/** A curated walk through stories, shown on the Atlas. */
export type Journey = {
  id: string;
  titleEn: string;
  titleRo: string;
  introEn: string;
  introRo: string;
  sortOrder: number;
  isPublished: boolean;
  /** Article ids in walking order. */
  stops: string[];
};

export type Comment = {
  id: string;
  articleId: string;
  userId: string;
  userDisplayName?: string;
  content: string;
  createdAt: string;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  role: 'admin' | 'writer' | 'reader';
  createdAt: string;
  emailVerified: boolean;
};

export type AdminUsersPage = {
  users: AdminUserSummary[];
  page: number;
  perPage: number;
  total: number | null;
  hasMore: boolean;
};

// ---- Localization utility ----

export const getLocalized = (obj: Record<string, unknown>, field: string, lang: 'en' | 'ro'): string => {
  const localizedKey = `${field}${lang === 'en' ? 'En' : 'Ro'}`;
  return String(obj[localizedKey] ?? obj[field] ?? '');
};

// ---- Constants and Parsers ----

export const CHAPTER_DELIMITER = "|||CHAPTER|||";

export const parseChapters = (content: string): string[] => {
  if (!content) return [""];
  // No cap here — the chapter ceiling is enforced by the editor
  // (MAX_CHAPTERS in TextStoryCreate). Capping here silently dropped
  // chapters 6–10 from the round-trip even though the DB had them.
  return content.split(CHAPTER_DELIMITER);
};

// ---- Data Fetching ----

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Lightweight cache for the categories list. The footer mounts on every
// navigation and used to fire a fresh categories query each time; this caps
// it to one query per TTL window. Populated by fetchCategories().
let _categoriesCache: { data: Category[]; time: number } | null = null;

// Lightweight cache for category article counts (category_id column only)
let _categoryCountsCache: { data: Record<string, number>; time: number } | null = null;

/** Invalidate cached public content (call after admin creates/edits/deletes content). */
export const invalidatePublicContentCache = () => {
  _categoriesCache = null;
  _categoryCountsCache = null;
  _archiveIndexCache = null;
};

/**
 * Fetches only the category_id column for all published articles and returns
 * a map of categoryId → count. Much lighter than fetching full articles.
 */
export const fetchArticleCategoryCounts = async (): Promise<Record<string, number>> => {
  if (_categoryCountsCache && Date.now() - _categoryCountsCache.time < CACHE_TTL) {
    return _categoryCountsCache.data;
  }

  // Paged with .range(): PostgREST silently truncates an unbounded select at
  // the project's `max-rows` (1000 by default), so the unpaged version began
  // under-reporting every category the moment the archive passed 1000
  // published stories — with no error to notice. Same approach as
  // scripts/generate-sitemap.mjs.
  const PAGE = 1000;
  const MAX_PAGES = 100; // 100k published articles; a guard, not a real limit
  const counts: Record<string, number> = {};

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from('articles')
      .select('category_id')
      .eq('is_published', true)
      // Ordered by the primary key so paging is deterministic. Postgres
      // guarantees no row order without an ORDER BY, so consecutive .range()
      // windows over an unordered query can overlap or skip rows — which
      // would silently miscount rather than just truncate.
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;

    const rows = (data || []) as { category_id: string }[];
    rows.forEach((row) => {
      counts[row.category_id] = (counts[row.category_id] || 0) + 1;
    });
    if (rows.length < PAGE) break;
  }

  _categoryCountsCache = { data: counts, time: Date.now() };
  return counts;
};

export type ArchiveEntry = Pick<Article, 'id' | 'categoryId' | 'location' | 'titleEn' | 'titleRo'>;

let _archiveIndexCache: { data: ArchiveEntry[]; time: number } | null = null;

/**
 * A one-line index of every published story, newest first: id, shelf,
 * county and title. What the storybook pages count and quote from ("25
 * stories, from 16 counties", a shelf's "Inside: …" line) without pulling
 * covers or content. Paged for the same reason as the counts above.
 */
export const fetchArchiveIndex = async (): Promise<ArchiveEntry[]> => {
  if (_archiveIndexCache && Date.now() - _archiveIndexCache.time < CACHE_TTL) {
    return _archiveIndexCache.data;
  }
  const PAGE = 1000;
  const MAX_PAGES = 100;
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from('articles')
      .select('id, category_id, location, title_en, title_ro')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      // See PAGINATION_TIEBREAKER note above fetchArticlesPage.
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data || []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  const data = toCamelCaseArray<ArchiveEntry>(rows);
  _archiveIndexCache = { data, time: Date.now() };
  return data;
};

const ATLAS_BASE_COLUMNS =
  'id, title_en, title_ro, type, subtype, media_url, poster_url, media_urls, location, category_id, created_at';
const ATLAS_PLACE_COLUMNS =
  'lat, lng, place_name_en, place_name_ro, year_start, year_end, era_label_en, era_label_ro, timeless';

/** Postgres "undefined column": the select named a column the table lacks. */
const isMissingColumn = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === '42703';

/** PostgREST / Postgres "no such table". */
const isMissingTable = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;
  return code === 'PGRST205' || code === '42P01';
};

/**
 * Every published story with what the Atlas draws: title, format, cover,
 * county, and the exact place and dates when the story has them. Unlike the
 * old map, stories without a county are included too: a timeless myth told
 * across the country belongs on the timeline and in the list even with no
 * pin. `content_en` / `content_ro` are never selected; the card fetches one
 * story's excerpt on demand (fetchArticleExcerptSource).
 *
 * `hasPlaceData` is false when the place/date columns do not exist yet (the
 * code shipped before migration 20261031120000 ran). The Atlas then pins
 * every story to its county instead of failing.
 */
export const fetchAtlasArticles = async (): Promise<{ articles: Article[]; hasPlaceData: boolean }> => {
  // Paged: PostgREST caps unbounded selects at `max-rows` (1000 by default)
  // and truncates silently, which would quietly drop pins from the map.
  const PAGE = 1000;
  const MAX_PAGES = 50; // 50k stories; a guard, not a real limit

  const fetchAll = async (columns: string) => {
    const rows: Record<string, unknown>[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE;
      const { data, error } = await supabase
        .from('articles')
        .select(columns)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        // See PAGINATION_TIEBREAKER note above fetchArticlesPage.
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = (data || []) as unknown as Record<string, unknown>[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
    return toCamelCaseArray<Article>(rows);
  };

  try {
    return { articles: await fetchAll(`${ATLAS_BASE_COLUMNS}, ${ATLAS_PLACE_COLUMNS}`), hasPlaceData: true };
  } catch (error) {
    if (!isMissingColumn(error)) throw error;
    return { articles: await fetchAll(ATLAS_BASE_COLUMNS), hasPlaceData: false };
  }
};

/**
 * Both bodies of one published story, for the Atlas card's excerpt. One row
 * at a time and only when a reader opens that card, so the map itself never
 * pays for content.
 */
export const fetchArticleExcerptSource = async (id: string): Promise<{ en: string; ro: string } | null> => {
  const { data, error } = await supabase
    .from('articles')
    .select('content_en, content_ro')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { en: data.content_en || '', ro: data.content_ro || '' };
};

type JourneyRow = Record<string, unknown> & {
  journey_stops?: { article_id: string; position: number }[] | null;
};

const toJourney = (row: JourneyRow): Journey => {
  const { journey_stops: stops, ...rest } = row;
  const base = toCamelCase<Omit<Journey, 'stops'>>(rest);
  return {
    ...base,
    stops: (stops || []).slice().sort((a, b) => a.position - b.position).map((s) => s.article_id),
  };
};

const JOURNEY_COLUMNS =
  'id, title_en, title_ro, intro_en, intro_ro, sort_order, is_published, journey_stops(article_id, position)';

/**
 * Published journeys with their stops in order. RLS only returns stops whose
 * story is published, so a draft never shows up as a gap mid-journey.
 * Returns [] when the journeys table does not exist yet.
 */
export const fetchJourneys = async (): Promise<Journey[]> => {
  const { data, error } = await supabase
    .from('journeys')
    .select(JOURNEY_COLUMNS)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return ((data || []) as unknown as JourneyRow[]).map(toJourney);
};

/**
 * Every journey, drafts included, for the dashboard. Admin-only by RLS.
 * Null — not [] — when the journeys table does not exist yet, so the
 * dashboard can say the migration is missing rather than show an empty list.
 */
export const fetchAdminJourneys = async (): Promise<Journey[] | null> => {
  const { data, error } = await supabase
    .from('journeys')
    .select(JOURNEY_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return ((data || []) as unknown as JourneyRow[]).map(toJourney);
};

export const JOURNEY_LIMITS = {
  ID_MAX: 60,
  TITLE_MAX: 120,
  INTRO_MAX: 600,
  STOPS_MAX: 50,
} as const;

/** The slug shape the journeys table enforces: lowercase words joined by hyphens. */
export const JOURNEY_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Creates or updates a journey and replaces its stops. `originalId` is the
 * id the journey was loaded with; a different `id` renames it (the stops
 * follow through ON UPDATE CASCADE).
 */
export const saveJourney = async (journey: Journey, originalId?: string): Promise<void> => {
  const titleEn = journey.titleEn.trim();
  const titleRo = journey.titleRo.trim();
  if (!JOURNEY_ID_PATTERN.test(journey.id) || journey.id.length > JOURNEY_LIMITS.ID_MAX) {
    throw new Error('Journey id must be lowercase words joined by hyphens');
  }
  if (!titleEn || !titleRo) throw new Error('Both titles are required');
  assertLen(titleEn, JOURNEY_LIMITS.TITLE_MAX, 'Title (English)');
  assertLen(titleRo, JOURNEY_LIMITS.TITLE_MAX, 'Title (Romanian)');
  assertLen(journey.introEn, JOURNEY_LIMITS.INTRO_MAX, 'Intro (English)');
  assertLen(journey.introRo, JOURNEY_LIMITS.INTRO_MAX, 'Intro (Romanian)');
  if (journey.stops.length > JOURNEY_LIMITS.STOPS_MAX) {
    throw new Error(`Too many stops (max ${JOURNEY_LIMITS.STOPS_MAX})`);
  }
  if (new Set(journey.stops).size !== journey.stops.length) throw new Error('A story can appear only once per journey');

  const row = {
    id: journey.id,
    title_en: titleEn,
    title_ro: titleRo,
    intro_en: journey.introEn.trim(),
    intro_ro: journey.introRo.trim(),
    sort_order: journey.sortOrder,
    is_published: journey.isPublished,
  };
  const { error } = originalId
    ? await supabase.from('journeys').update(row).eq('id', originalId)
    : await supabase.from('journeys').insert(row);
  if (error) throw error;

  const { error: stopsError } = await supabase.rpc('set_journey_stops', {
    p_journey_id: journey.id,
    p_article_ids: journey.stops,
  });
  if (stopsError) throw stopsError;
};

export const deleteJourney = async (id: string): Promise<void> => {
  const { error } = await supabase.from('journeys').delete().eq('id', id);
  if (error) throw error;
};

/**
 * Slim columns used by listing surfaces (related-articles strip, future
 * editor previews). Excludes `content_en` / `content_ro` so we don't pull
 * ~10k chars per row when the consumer only renders title + cover.
 */
const ARTICLE_CARD_COLUMNS =
  'id, title_en, title_ro, type, subtype, media_url, poster_url, media_urls, location, category_id, user_id, is_published, created_at';

let placeColumnsProbe: Promise<boolean> | null = null;

/**
 * Whether the articles table has the place/date columns yet (migration
 * 20261031120000). Asked once per page load, with the cheapest possible
 * query; a transient failure is not remembered, so the next caller asks
 * again rather than hiding every card's place for the rest of the visit.
 */
export const hasPlaceColumns = (): Promise<boolean> => {
  placeColumnsProbe ??= (async () => {
    const { error } = await supabase.from('articles').select('timeless').limit(1);
    if (!error) return true;
    if (!isMissingColumn(error)) placeColumnsProbe = null;
    return false;
  })();
  return placeColumnsProbe;
};

/** Card columns, plus place and date when the database has them. */
const cardColumns = async (): Promise<string> =>
  (await hasPlaceColumns()) ? `${ARTICLE_CARD_COLUMNS}, ${ATLAS_PLACE_COLUMNS}` : ARTICLE_CARD_COLUMNS;

/**
 * Published stories from the same county as the one being read — the story
 * page's "nearby" card. Newest first.
 */
export const fetchNearbyArticles = async (location: string, excludeId: string, limit = 2): Promise<Article[]> => {
  const { data, error } = await supabase
    .from('articles')
    .select(await cardColumns())
    .eq('is_published', true)
    .eq('location', location)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return toCamelCaseArray<Article>((data || []) as unknown as Record<string, unknown>[]);
};

/** Card rows for specific published stories (a journey's neighbouring stops). */
export const fetchArticleCardsByIds = async (ids: string[]): Promise<Article[]> => {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('articles')
    .select(await cardColumns())
    .eq('is_published', true)
    .in('id', ids);
  if (error) throw error;
  return toCamelCaseArray<Article>((data || []) as unknown as Record<string, unknown>[]);
};

/**
 * Fetches up to `limit` published articles related to the given one.
 * Strategy: same-category first; if fewer than `limit` rows match, fill
 * the remainder from other categories (most recent first). Replaces a
 * full all-articles round-trip (500 rows, full content) that
 * fired on every article view.
 */
export const fetchRelatedArticles = async (
  excludeId: string,
  categoryId: string | null | undefined,
  limit: number = 3
): Promise<Article[]> => {
  if (limit <= 0) return [];
  try {
    const columns = await cardColumns();
    let sameCategory: Article[] = [];
    if (categoryId) {
      const { data, error } = await supabase
        .from('articles')
        .select(columns)
        .eq('is_published', true)
        .eq('category_id', categoryId)
        .neq('id', excludeId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      sameCategory = toCamelCaseArray<Article>((data || []) as unknown as Record<string, unknown>[]);
    }

    const remaining = limit - sameCategory.length;
    if (remaining <= 0) return sameCategory;

    // Fill the remainder. Exclude the article itself and (if we have one)
    // the category we already pulled from, so we don't risk dupes.
    let supplementalQuery = supabase
      .from('articles')
      .select(columns)
      .eq('is_published', true)
      .neq('id', excludeId)
      .order('created_at', { ascending: false })
      .limit(remaining);
    if (categoryId) {
      supplementalQuery = supplementalQuery.neq('category_id', categoryId);
    }
    const { data: supplementalData, error: supplementalError } = await supplementalQuery;
    if (supplementalError) throw supplementalError;
    return [...sameCategory, ...toCamelCaseArray<Article>((supplementalData || []) as unknown as Record<string, unknown>[])];
  } catch (error) {
    if (!isAbortError(error)) {
      console.error('Error fetching related articles:', error);
    }
    return [];
  }
};

/**
 * The newest published stories, card columns only — for surfaces that list
 * titles and places but never render a body (the home page ticker).
 */
export const fetchLatestArticleCards = async (limit: number): Promise<Article[]> => {
  const { data, error } = await supabase
    .from('articles')
    .select(await cardColumns())
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    // See PAGINATION_TIEBREAKER note above fetchArticlesPage.
    .order('id', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return toCamelCaseArray<Article>((data || []) as unknown as Record<string, unknown>[]);
};

/**
 * Paginated admin/writer dashboard fetcher for articles. Skips the
 * public-content cache (admins always want fresh data) and accepts an
 * optional `ownerId` so writers fetch only their own rows server-side.
 *
 * Returns the requested page plus the exact total so the dashboard can show
 * Previous/Next controls and a result range — replacing the old all-at-once
 * `.limit(500)` fetch, which silently hid stories beyond the 500th.
 *
 * Categories are fetched separately via `fetchCategories()`; they don't
 * paginate and are reused by the category-management tab.
 */
export const fetchAdminArticlesPage = async (
  page: number,
  pageSize: number,
  ownerId?: string
): Promise<{ articles: Article[]; total: number }> => {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safeSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 20;
  const start = (safePage - 1) * safeSize;
  const end = start + safeSize - 1;

  // The dashboard table renders title / category / type / status only, and
  // the delete path needs the media URLs for storage cleanup. It never shows
  // an excerpt, so both full content columns were pure waste — 20 rows x 2
  // languages x up to 50k chars per page load. The editors load the full row
  // separately via fetchAnyArticle().
  let query = supabase
    .from('articles')
    .select(ARTICLE_CARD_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    // See PAGINATION_TIEBREAKER note above fetchArticlesPage.
    .order('id', { ascending: true });
  if (ownerId) query = query.eq('user_id', ownerId);

  const { data, error, count } = await query.range(start, end);
  if (error) throw error;
  return { articles: toCamelCaseArray<Article>(data || []), total: count ?? 0 };
};

/**
 * Unified article creation. All three story types funnel through here:
 * one INSERT shape, one validation pass, UUID-based IDs, and consistent
 * cache invalidation. Replaces three near-identical inserts spread across
 * AdminDashboard / VideoStoryCreate / CarouselStoryCreate.
 */
export type NewArticleInput = {
  type: 'text' | 'video' | 'carousel';
  subtype?: ArticleSubtype | null;
  titleEn: string;
  titleRo: string;
  contentEn: string;
  contentRo: string;
  categoryId: string;
  userId: string;
  isPublished: boolean;
  location?: string;
  mediaUrl?: string | null;
  posterUrl?: string | null;
  mediaUrls?: string[];
  mediaCaptions?: MediaCaption[];
  /**
   * Atlas place and date. Omit to leave the columns untouched — which is
   * also what keeps saves working against a database that predates them.
   */
  placeDate?: ArticlePlaceDate;
  /**
   * "About this story". Omit to leave the columns untouched, for the same
   * reason as placeDate.
   */
  note?: { en: string | null; ro: string | null };
  /** A film's subtitles and chapters. Omit to leave the columns untouched. */
  film?: { subtitlesEnUrl: string | null; subtitlesRoUrl: string | null; chapters: FilmChapter[] | null };
  /** A text story's dated moments. Omit to leave the column untouched. */
  moments?: StoryMoment[] | null;
};

export type ArticlePlaceDate = {
  lat: number | null;
  lng: number | null;
  placeNameEn: string | null;
  placeNameRo: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  eraLabelEn: string | null;
  eraLabelRo: string | null;
  timeless: boolean;
};

/**
 * The same rules the articles table's CHECK constraints enforce
 * (migration 20261031120000), so a bad value fails here with a readable
 * message instead of as a constraint name from Postgres.
 */
export const PLACE_DATE_LIMITS = {
  PLACE_NAME_MAX: 120,
  ERA_LABEL_MAX: 80,
  YEAR_MIN: -3000,
  YEAR_MAX: 2100,
  // A box around Romania. The Atlas draws nothing else, and the box
  // catches swapped coordinates.
  LAT_MIN: 43.5,
  LAT_MAX: 48.5,
  LNG_MIN: 20,
  LNG_MAX: 30.5,
} as const;

export const validatePlaceDate = (p: ArticlePlaceDate): void => {
  const L = PLACE_DATE_LIMITS;
  if ((p.lat == null) !== (p.lng == null)) throw new Error('Set both latitude and longitude, or neither');
  if (p.lat != null && p.lng != null) {
    if (!Number.isFinite(p.lat) || p.lat < L.LAT_MIN || p.lat > L.LAT_MAX) throw new Error(`Latitude must be between ${L.LAT_MIN} and ${L.LAT_MAX}`);
    if (!Number.isFinite(p.lng) || p.lng < L.LNG_MIN || p.lng > L.LNG_MAX) throw new Error(`Longitude must be between ${L.LNG_MIN} and ${L.LNG_MAX}`);
  }
  if (p.placeNameEn) assertLen(p.placeNameEn, L.PLACE_NAME_MAX, 'Place name (English)');
  if (p.placeNameRo) assertLen(p.placeNameRo, L.PLACE_NAME_MAX, 'Place name (Romanian)');
  if (p.eraLabelEn) assertLen(p.eraLabelEn, L.ERA_LABEL_MAX, 'Period label (English)');
  if (p.eraLabelRo) assertLen(p.eraLabelRo, L.ERA_LABEL_MAX, 'Period label (Romanian)');
  const isYear = (y: number) => Number.isInteger(y) && y >= L.YEAR_MIN && y <= L.YEAR_MAX;
  if (p.yearStart != null && !isYear(p.yearStart)) throw new Error(`Start year must be a whole year between ${L.YEAR_MIN} and ${L.YEAR_MAX}`);
  if (p.yearEnd != null) {
    if (p.yearStart == null) throw new Error('An end year needs a start year');
    if (!isYear(p.yearEnd) || p.yearEnd < p.yearStart) throw new Error('End year must not be before the start year');
  }
  if (p.timeless && (p.yearStart != null || p.yearEnd != null)) throw new Error('A timeless story has no years');
};

const placeDateRow = (p: ArticlePlaceDate): Record<string, unknown> => {
  validatePlaceDate(p);
  const text = (v: string | null) => v?.trim() || null;
  return {
    lat: p.lat,
    lng: p.lng,
    place_name_en: text(p.placeNameEn),
    place_name_ro: text(p.placeNameRo),
    year_start: p.yearStart,
    year_end: p.yearEnd,
    era_label_en: text(p.eraLabelEn),
    era_label_ro: text(p.eraLabelRo),
    timeless: p.timeless,
  };
};

/**
 * PostgREST answers a write naming an unknown column with PGRST204. Before
 * the Atlas migration has run that is the only way a place/date save can
 * fail, so say what is actually wrong.
 */
const explainPlaceDateError = (error: unknown): unknown => {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === 'PGRST204' && /lat|lng|place_name|year_|era_label|timeless/.test(e.message || '')) {
    return new Error('Place and date can be saved once the Atlas database update (migration 20261031120000) has been applied.');
  }
  if (e?.code === 'PGRST204' && /note_/.test(e.message || '')) {
    return new Error('“About this story” can be saved once the database update (migration 20261101090000) has been applied.');
  }
  if (e?.code === 'PGRST204' && /subtitles_|film_chapters|moments/.test(e.message || '')) {
    return new Error('Subtitles, film chapters and moments can be saved once the database update (migration 20261102140000) has been applied.');
  }
  return error;
};

export const NOTE_MAX = 800;

const noteRow = (note: { en: string | null; ro: string | null }): Record<string, unknown> => {
  const en = note.en?.trim() || null;
  const ro = note.ro?.trim() || null;
  if (en) assertLen(en, NOTE_MAX, 'About this story (English)');
  if (ro) assertLen(ro, NOTE_MAX, 'About this story (Romanian)');
  return { note_en: en, note_ro: ro };
};

/**
 * The same limits as the CHECK constraints of migration 20261102140000, so
 * a bad value fails here with a readable message instead of a constraint
 * name from Postgres.
 */
export const FILM_LIMITS = { CHAPTERS_MAX: 30, CHAPTER_TITLE_MAX: 80, TIME_MAX: 86_400 } as const;
export const MOMENT_LIMITS = { MOMENTS_MAX: 10, WHEN_MAX: 24, LABEL_MAX: 60 } as const;

const filmRow = (film: NonNullable<NewArticleInput['film']>): Record<string, unknown> => {
  if (film.subtitlesEnUrl) assertLen(film.subtitlesEnUrl, ARTICLE_LIMITS.MEDIA_URL_MAX, 'Subtitles (English)');
  if (film.subtitlesRoUrl) assertLen(film.subtitlesRoUrl, ARTICLE_LIMITS.MEDIA_URL_MAX, 'Subtitles (Romanian)');
  const chapters = (film.chapters ?? [])
    .map((c) => ({ t: Math.round(c.t * 10) / 10, en: c.en?.trim() || undefined, ro: c.ro?.trim() || undefined }))
    .filter((c) => c.en || c.ro)
    .sort((a, b) => a.t - b.t);
  if (chapters.length > FILM_LIMITS.CHAPTERS_MAX) throw new Error(`At most ${FILM_LIMITS.CHAPTERS_MAX} film chapters`);
  chapters.forEach((c, i) => {
    if (!(c.t >= 0 && c.t <= FILM_LIMITS.TIME_MAX)) throw new Error(`Film chapter #${i + 1} has an impossible start time`);
    if (c.en) assertLen(c.en, FILM_LIMITS.CHAPTER_TITLE_MAX, `Film chapter #${i + 1} (English)`);
    if (c.ro) assertLen(c.ro, FILM_LIMITS.CHAPTER_TITLE_MAX, `Film chapter #${i + 1} (Romanian)`);
  });
  return {
    subtitles_en_url: film.subtitlesEnUrl || null,
    subtitles_ro_url: film.subtitlesRoUrl || null,
    film_chapters: chapters.length ? chapters : null,
  };
};

const momentsRow = (moments: StoryMoment[] | null): Record<string, unknown> => {
  const clean = (moments ?? [])
    .map((m) => ({
      chapter: m.chapter,
      when_en: m.when_en?.trim() || undefined,
      when_ro: m.when_ro?.trim() || undefined,
      label_en: m.label_en?.trim() || undefined,
      label_ro: m.label_ro?.trim() || undefined,
    }))
    .filter((m) => m.when_en || m.when_ro);
  if (clean.length > MOMENT_LIMITS.MOMENTS_MAX) throw new Error(`At most ${MOMENT_LIMITS.MOMENTS_MAX} moments`);
  clean.forEach((m) => {
    const n = `Moment of chapter ${m.chapter + 1}`;
    if (!Number.isInteger(m.chapter) || m.chapter < 0 || m.chapter > 49) throw new Error(`${n}: unknown chapter`);
    if (m.when_en) assertLen(m.when_en, MOMENT_LIMITS.WHEN_MAX, `${n}, when (English)`);
    if (m.when_ro) assertLen(m.when_ro, MOMENT_LIMITS.WHEN_MAX, `${n}, when (Romanian)`);
    if (m.label_en) assertLen(m.label_en, MOMENT_LIMITS.LABEL_MAX, `${n}, label (English)`);
    if (m.label_ro) assertLen(m.label_ro, MOMENT_LIMITS.LABEL_MAX, `${n}, label (Romanian)`);
  });
  return { moments: clean.length ? clean : null };
};

// Article field caps. The DB has no length constraints, so a malicious or
// buggy client could otherwise insert arbitrarily large content and abuse
// row size / bandwidth. Enforced here so every create-path agrees.
export const ARTICLE_LIMITS = {
  TITLE_MAX: 200,
  // 50k chars per language ≈ ~10k words, generous for any long-form story.
  CONTENT_MAX: 50_000,
  LOCATION_MAX: 100,
  MEDIA_URL_MAX: 2_000,
  MEDIA_URLS_MAX: 30,
  MEDIA_CAPTION_MAX: 500,
} as const;

const assertLen = (value: string, max: number, field: string) => {
  if (value.length > max) {
    throw new Error(`${field} exceeds ${max} characters`);
  }
};

export const createArticle = async (input: NewArticleInput): Promise<{ id: string }> => {
  const titleEn = input.titleEn.trim();
  const titleRo = input.titleRo.trim();
  const location = input.location?.trim() || null;

  if (!titleEn) throw new Error('Title (English) is required');
  if (!titleRo) throw new Error('Title (Romanian) is required');
  if (!input.categoryId) throw new Error('Category is required');
  if (!input.userId) throw new Error('Not authenticated');

  assertLen(titleEn, ARTICLE_LIMITS.TITLE_MAX, 'Title (English)');
  assertLen(titleRo, ARTICLE_LIMITS.TITLE_MAX, 'Title (Romanian)');
  assertLen(input.contentEn, ARTICLE_LIMITS.CONTENT_MAX, 'Content (English)');
  assertLen(input.contentRo, ARTICLE_LIMITS.CONTENT_MAX, 'Content (Romanian)');
  if (location) assertLen(location, ARTICLE_LIMITS.LOCATION_MAX, 'Location');
  if (input.mediaUrl) assertLen(input.mediaUrl, ARTICLE_LIMITS.MEDIA_URL_MAX, 'Media URL');
  if (input.posterUrl) assertLen(input.posterUrl, ARTICLE_LIMITS.MEDIA_URL_MAX, 'Poster URL');

  if (input.mediaUrls) {
    if (input.mediaUrls.length > ARTICLE_LIMITS.MEDIA_URLS_MAX) {
      throw new Error(`Too many gallery images (max ${ARTICLE_LIMITS.MEDIA_URLS_MAX})`);
    }
    input.mediaUrls.forEach((url, i) => assertLen(url, ARTICLE_LIMITS.MEDIA_URL_MAX, `Gallery image #${i + 1}`));
  }
  if (input.mediaCaptions) {
    input.mediaCaptions.forEach((cap, i) => {
      if (cap?.en) assertLen(cap.en, ARTICLE_LIMITS.MEDIA_CAPTION_MAX, `Caption #${i + 1} (English)`);
      if (cap?.ro) assertLen(cap.ro, ARTICLE_LIMITS.MEDIA_CAPTION_MAX, `Caption #${i + 1} (Romanian)`);
    });
  }

  const id = `art_${crypto.randomUUID()}`;

  const row: Record<string, unknown> = {
    id,
    title_en: titleEn,
    title_ro: titleRo,
    content_en: input.contentEn,
    content_ro: input.contentRo,
    category_id: input.categoryId,
    location,
    media_url: input.mediaUrl ?? null,
    poster_url: input.posterUrl ?? null,
    media_urls: input.mediaUrls ?? null,
    media_captions: input.mediaCaptions ?? null,
    user_id: input.userId,
    is_published: input.isPublished,
    type: input.type,
    subtype: input.type === 'text' ? (input.subtype ?? null) : null,
    // created_at is deliberately NOT sent. The column defaults to now(), and
    // updated_at is set by the same default in the same transaction — so
    // letting the server stamp both keeps them on one clock. Sending a
    // client timestamp made created_at lead updated_at by the round-trip
    // latency (~230ms on the row that exposed this), which the article page
    // publishes as an article:modified_time *earlier* than its
    // article:published_time. It also made the archive's sort key
    // client-controlled for no benefit.
    ...(input.placeDate ? placeDateRow(input.placeDate) : {}),
    ...(input.note ? noteRow(input.note) : {}),
    ...(input.film ? filmRow(input.film) : {}),
    ...(input.moments !== undefined ? momentsRow(input.moments) : {}),
  };

  const { error } = await supabase.from('articles').insert(row);
  if (error) throw explainPlaceDateError(error);

  invalidatePublicContentCache();
  return { id };
};

export type UpdateArticleInput = Omit<NewArticleInput, 'userId'> & { id: string };

export const updateArticle = async (input: UpdateArticleInput): Promise<void> => {
  const titleEn = input.titleEn.trim();
  const titleRo = input.titleRo.trim();
  const location = input.location?.trim() || null;

  if (!input.id) throw new Error('Article id is required');
  if (!titleEn) throw new Error('Title (English) is required');
  if (!titleRo) throw new Error('Title (Romanian) is required');
  if (!input.categoryId) throw new Error('Category is required');

  assertLen(titleEn, ARTICLE_LIMITS.TITLE_MAX, 'Title (English)');
  assertLen(titleRo, ARTICLE_LIMITS.TITLE_MAX, 'Title (Romanian)');
  assertLen(input.contentEn, ARTICLE_LIMITS.CONTENT_MAX, 'Content (English)');
  assertLen(input.contentRo, ARTICLE_LIMITS.CONTENT_MAX, 'Content (Romanian)');
  if (location) assertLen(location, ARTICLE_LIMITS.LOCATION_MAX, 'Location');
  if (input.mediaUrl) assertLen(input.mediaUrl, ARTICLE_LIMITS.MEDIA_URL_MAX, 'Media URL');
  if (input.posterUrl) assertLen(input.posterUrl, ARTICLE_LIMITS.MEDIA_URL_MAX, 'Poster URL');

  if (input.mediaUrls) {
    if (input.mediaUrls.length > ARTICLE_LIMITS.MEDIA_URLS_MAX) {
      throw new Error(`Too many gallery images (max ${ARTICLE_LIMITS.MEDIA_URLS_MAX})`);
    }
    input.mediaUrls.forEach((url, i) => assertLen(url, ARTICLE_LIMITS.MEDIA_URL_MAX, `Gallery image #${i + 1}`));
  }
  if (input.mediaCaptions) {
    input.mediaCaptions.forEach((cap, i) => {
      if (cap?.en) assertLen(cap.en, ARTICLE_LIMITS.MEDIA_CAPTION_MAX, `Caption #${i + 1} (English)`);
      if (cap?.ro) assertLen(cap.ro, ARTICLE_LIMITS.MEDIA_CAPTION_MAX, `Caption #${i + 1} (Romanian)`);
    });
  }

  const updates: Record<string, unknown> = {
    title_en: titleEn,
    title_ro: titleRo,
    content_en: input.contentEn,
    content_ro: input.contentRo,
    category_id: input.categoryId,
    location,
    media_url: input.mediaUrl ?? null,
    poster_url: input.posterUrl ?? null,
    media_urls: input.mediaUrls ?? null,
    media_captions: input.mediaCaptions ?? null,
    subtype: input.type === 'text' ? (input.subtype ?? null) : null,
    is_published: input.isPublished,
    ...(input.placeDate ? placeDateRow(input.placeDate) : {}),
    ...(input.note ? noteRow(input.note) : {}),
    ...(input.film ? filmRow(input.film) : {}),
    ...(input.moments !== undefined ? momentsRow(input.moments) : {}),
  };

  const { error } = await supabase.from('articles').update(updates).eq('id', input.id);
  if (error) throw explainPlaceDateError(error);

  invalidatePublicContentCache();
};

export const fetchCategories = async (): Promise<Category[]> => {
  // The footer mounts on every navigation and used to fire a fresh categories
  // query each time even though the home/categories pages had just fetched the
  // same rows seconds earlier. Serve from a short-lived cache instead.
  if (_categoriesCache && Date.now() - _categoriesCache.time < CACHE_TTL) {
    return _categoriesCache.data;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name_en', { ascending: true });
  if (error) throw error;
  const categories = toCamelCaseArray<Category>(data || []);
  _categoriesCache = { data: categories, time: Date.now() };
  return categories;
};

/**
 * Shortest query `searchArticles` will run.
 *
 * Not arbitrary: the article search runs on pg_trgm GIN indexes, and a
 * trigram index can only serve patterns with at least three characters
 * between the wildcards — `%a%` and `%ab%` fall back to a sequential scan
 * across both full content columns of every published article. The search
 * box fires on a 300ms debounce, which means a single keystroke was enough
 * to trigger one. Exported so the UI can explain the threshold instead of
 * showing an inaccurate "no results". search_articles() enforces the same
 * floor server-side.
 */
export const SEARCH_MIN_LENGTH = 3;

/**
 * Accent-insensitive search over published articles.
 *
 * Runs through the `search_articles` RPC (migration
 * 20260813165613_unaccent_search.sql) rather
 * than a PostgREST filter chain, because the match has to fold diacritics on
 * both sides — on a Romanian archive, "Marasesti" must find "Mărășești" —
 * and PostgREST can't call unaccent() inside a filter.
 *
 * Moving into the database also removes a whole class of escaping problems:
 * the term is a bound parameter, so PostgREST's own syntax (commas splitting
 * clauses, parentheses grouping) never sees it, and the function escapes the
 * LIKE metacharacters itself. The RPC returns the card column set, so the
 * content columns it searches are never sent back over the wire.
 */
export const searchArticles = async (query: string, limit = 6): Promise<Article[]> => {
  const q = query.trim();
  if (q.length < SEARCH_MIN_LENGTH) return [];
  const { data, error } = await supabase.rpc('search_articles', {
    p_query: q,
    p_limit: limit,
  });
  if (error) throw error;
  const results = toCamelCaseArray<Article>(data || []);
  return withPlaceAndDate(results);
};

/**
 * Adds each story's place and date (the Atlas columns) to rows that were
 * selected without them. search_articles returns a fixed column set from
 * before the Atlas, and the search results lead with "place · when" like
 * every other story card. One small query for at most a handful of ids; on
 * any failure the rows come back as they were, county and all.
 */
const withPlaceAndDate = async (rows: Article[]): Promise<Article[]> => {
  if (!rows.length || !(await hasPlaceColumns())) return rows;
  try {
    const cards = await fetchArticleCardsByIds(rows.map((r) => r.id));
    const byId = new Map(cards.map((c) => [c.id, c]));
    return rows.map((r) => {
      const c = byId.get(r.id);
      return c
        ? {
            ...r,
            lat: c.lat, lng: c.lng, placeNameEn: c.placeNameEn, placeNameRo: c.placeNameRo,
            yearStart: c.yearStart, yearEnd: c.yearEnd, eraLabelEn: c.eraLabelEn, eraLabelRo: c.eraLabelRo,
            timeless: c.timeless,
          }
        : r;
    });
  } catch {
    return rows;
  }
};

/**
 * PAGINATION_TIEBREAKER
 *
 * Every paged query in this file sorts by `created_at` and then by `id`.
 * `created_at` is not unique — a bulk import or two quick saves can share a
 * timestamp — and Postgres makes no promise about the relative order of tied
 * rows between queries. Without the tiebreaker, a row can appear on two
 * consecutive pages or on neither, which surfaces as a duplicate card or a
 * story that is simply missing from the grid. `id` is the primary key, so it
 * makes the total order deterministic at no meaningful cost.
 */
export const fetchArticlesPage = async (
  page: number,
  pageSize: number,
  categoryId?: string | null
): Promise<{ articles: Article[]; total: number }> => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error, count } = await query.range(start, end);
  if (error) throw error;
  return { articles: toCamelCaseArray<Article>(data || []), total: count ?? 0 };
};

/**
 * Picks a random published article.
 *
 * Only the id is selected — the sole caller navigates to /article/:id, which
 * fetches the row itself. The previous version pulled every column of the
 * chosen row, including both full content columns, and discarded all of it.
 */
export const fetchRandomArticle = async (): Promise<{ id: string } | null> => {
  try {
    const { count } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true);
    if (!count) return null;
    const offset = Math.floor(Math.random() * count);
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .eq('is_published', true)
      // Ordered so the offset maps to a well-defined row. Without it the
      // pick is uniform only over whatever order the planner happened to
      // produce, and an unordered OFFSET is not guaranteed to return a row
      // at all. See PAGINATION_TIEBREAKER.
      .order('id', { ascending: true })
      .range(offset, offset)
      .maybeSingle();
    if (error || !data?.id) return null;
    return { id: data.id };
  } catch {
    return null;
  }
};

/**
 * Fetches any article by ID regardless of published status — for use by
 * admin/writer edit flows that need to load drafts.
 */
export const fetchAnyArticle = async (id: string): Promise<Article | null> => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toCamelCase<Article>(data);
  } catch (error) {
    if (!isAbortError(error)) {
      console.error("Error fetching article:", error);
      throw error;
    }
    return null;
  }
};

export const fetchPublicArticle = async (id: string): Promise<{ article: Article | null, views: number }> => {
  try {
    const articlePromise = supabase.from('articles').select('*').eq('id', id).eq('is_published', true).maybeSingle();
    const viewsPromise = supabase.from('article_views').select('view_count').eq('article_id', id).maybeSingle();

    const [artResult, viewsResult] = await Promise.allSettled([articlePromise, viewsPromise]);

    const articleRes = artResult.status === 'fulfilled' ? artResult.value : { data: null, error: new Error('Article query failed') };
    const viewsRes = viewsResult.status === 'fulfilled' ? viewsResult.value : { data: null, error: new Error('Views query failed') };

    if (articleRes.error) throw articleRes.error;
    if (!articleRes.data) return { article: null, views: 0 };
    if (viewsRes.error) console.warn('Failed to fetch view count:', viewsRes.error);

    return {
      article: toCamelCase<Article>(articleRes.data),
      views: viewsRes.data?.view_count || 0
    };
  } catch (error) {
    if (!isAbortError(error)) {
      console.error("Error fetching article from Supabase:", error);
      throw error;
    }
    return { article: null, views: 0 };
  }
};

/**
 * A story requested at boot, before React gets to the story page.
 *
 * The page is lazy-loaded, and React keeps a lazy page's loading spinner up
 * for at least 300 ms, so the page only asked for its story about 300 ms
 * after its code had arrived, and the cover (the largest thing on screen)
 * waited behind that request. main.tsx now starts the request as soon as the
 * app boots, for the story in the address bar, and the page takes it over
 * when it mounts. Each request is taken once and expires after 30 s, so
 * coming back to the story later always fetches it fresh.
 */
const prefetchedArticles = new Map<string, { at: number; request: ReturnType<typeof fetchPublicArticle> }>();
const PREFETCH_TTL_MS = 30_000;

export const prefetchPublicArticle = (id: string): void => {
  if (prefetchedArticles.has(id)) return;
  const request = fetchPublicArticle(id);
  // The page handles a failure when it takes the request over. This only
  // keeps a failure from being reported as unhandled if the reader leaves first.
  request.catch(() => {});
  prefetchedArticles.set(id, { at: Date.now(), request });
};

export const takePrefetchedArticle = (id: string): ReturnType<typeof fetchPublicArticle> | undefined => {
  const entry = prefetchedArticles.get(id);
  prefetchedArticles.delete(id);
  return entry && Date.now() - entry.at < PREFETCH_TTL_MS ? entry.request : undefined;
};

const COMMENTS_PAGE_SIZE = 25;

/**
 * Fetches comments for an article in pages of `COMMENTS_PAGE_SIZE`.
 * Returns the page of comments plus the total count so the UI can
 * decide whether to show "Load more".
 */
export const fetchComments = async (
  articleId: string,
  page: number = 0
): Promise<{ comments: Comment[]; total: number }> => {
  try {
    const start = page * COMMENTS_PAGE_SIZE;
    const end = start + COMMENTS_PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .eq('article_id', articleId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(start, end);

    if (error) throw error;
    return {
      comments: toCamelCaseArray<Comment>(data || []),
      total: count ?? 0,
    };
  } catch (error) {
    if (!isAbortError(error)) {
      console.error("Error fetching comments from Supabase:", error);
      throw error;
    }
    return { comments: [], total: 0 };
  }
};

/**
 * Re-fetches the first `pageCount` pages of comments as a single query.
 *
 * Used when refreshing after a post/edit/delete: the reader may have paged
 * through several batches, and issuing one request per loaded page turned a
 * single reply into N round-trips. One widened range covers the same rows.
 */
export const fetchCommentsThroughPage = async (
  articleId: string,
  pageCount: number
): Promise<{ comments: Comment[]; total: number }> => {
  const pages = Math.max(1, Math.floor(pageCount));
  try {
    const { data, error, count } = await supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .eq('article_id', articleId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(0, pages * COMMENTS_PAGE_SIZE - 1);

    if (error) throw error;
    return {
      comments: toCamelCaseArray<Comment>(data || []),
      total: count ?? 0,
    };
  } catch (error) {
    if (!isAbortError(error)) {
      console.error("Error refreshing comments from Supabase:", error);
      throw error;
    }
    return { comments: [], total: 0 };
  }
};

export const postComment = async (comment: Omit<Comment, 'id' | 'createdAt' | 'userDisplayName'>) => {
  // user_display_name is set server-side by the set_comment_display_name
  // BEFORE INSERT trigger (migrations 20260507/20260508). Sending one from
  // the client used to look meaningful but was always discarded — strip it
  // from the type so callers don't bother building the value.
  try {
    const { error } = await supabase.from('comments').insert(toSnakeCase({
      id: `cmt_${crypto.randomUUID()}`,
      ...comment
    }));
    return !error;
  } catch (error) {
    console.error("Error posting comment to Supabase:", error);
    return false;
  }
};

export const deleteComment = async (commentId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting comment:", error);
    return false;
  }
};

export const updateComment = async (commentId: string, userId: string, content: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating comment:", error);
    return false;
  }
};

export const incrementView = async (articleId: string): Promise<boolean> => {
  // Deduplicate: one view per article per session
  try {
    const key = `rostory_viewed_${articleId}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage unavailable — proceed anyway
  }

  // Routes through the `increment-view` Edge Function so we get a per-IP
  // rate limit. Calling the RPC directly is no longer permitted — anon
  // and authenticated roles had EXECUTE revoked in migration
  // 20260428000000_lock_increment_article_view.sql.
  try {
    const { error } = await supabase.functions.invoke('increment-view', {
      body: { articleId }
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("Error incrementing view:", error);
    return false;
  }
};

export const toggleFavorite = async (articleId: string): Promise<boolean> => {
  // Single atomic RPC (public.toggle_favorite). Returns true if the favorite
  // was added, false if it was removed. The function derives the user from
  // auth.uid() server-side, runs under the caller's RLS, and does the
  // delete/insert in one transaction — so there's no TOCTOU race and, unlike
  // the previous INSERT-first approach, no 409 Conflict logged in the console
  // on every un-favorite.
  const { data, error } = await supabase.rpc('toggle_favorite', { p_article_id: articleId });
  if (error) {
    console.error("Error toggling favorite in Supabase:", error);
    throw error;
  }
  return data === true;
};

export const fetchUserFavorites = async (userId: string): Promise<Article[]> => {
  try {
    // Single round-trip: embed the article through the favorites FK.
    // `!inner` + the is_published filter hides favorites whose article was
    // unpublished after the favorite was created — clicking such an entry
    // would 404 via fetchPublicArticle. (Previously two sequential queries.)
    const { data, error } = await supabase
      .from('favorites')
      .select('articles!inner(*)')
      .eq('user_id', userId)
      .eq('articles.is_published', true);

    if (error) throw error;
    const rows = (data ?? []) as unknown as { articles: Record<string, unknown> }[];
    return toCamelCaseArray<Article>(rows.map((r) => r.articles));
  } catch (error) {
    if (!isAbortError(error)) {
      console.error("Error fetching user favorites from Supabase:", error);
      throw error;
    }
    return [];
  }
};

/**
 * Admin Actions
 *
 * Edge Function calls can occasionally send a stale/expired access token during
 * session restore/refresh races. We pass an explicit Authorization header and,
 * on a 401 response, refresh the session once and retry.
 */
const getAuthHeaders = async (opts?: { refresh?: boolean }): Promise<Record<string, string>> => {
  if (opts?.refresh) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      throw error;
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return { Authorization: `Bearer ${session.access_token}` };
};

// Supabase function-error shape is internal (not exported by the SDK).
// We probe the small subset we care about — `context` or `response` carrying
// a fetch Response — without binding to a specific type.
type SupabaseFunctionErrorLike = {
  context?: { status?: number; clone?: () => { text: () => Promise<string> } };
  response?: { status?: number; clone?: () => { text: () => Promise<string> } };
};

const getFunctionErrorDebug = async (error: unknown): Promise<{ status?: number; body?: string }> => {
  const e = error as SupabaseFunctionErrorLike | null;
  const response = e?.context ?? e?.response;
  if (!response || typeof response.status !== 'number') {
    return {};
  }

  let body: string | undefined;
  if (typeof response.clone === 'function') {
    try {
      body = await response.clone().text();
    } catch {
      body = undefined;
    }
  }

  return { status: response.status, body };
};

const isFunction401 = (error: unknown): boolean => {
  const e = error as SupabaseFunctionErrorLike | null;
  const response = e?.context ?? e?.response;
  return response?.status === 401;
};

const invokeAdminApi = async <T = unknown>(body: Record<string, unknown>): Promise<T> => {
  let headers = await getAuthHeaders();
  let result = await supabase.functions.invoke('admin-api', { body, headers });

  if (result.error && isFunction401(result.error)) {
    const firstError = await getFunctionErrorDebug(result.error);
    console.warn("admin-api returned 401, attempting session refresh and retry", firstError);

    headers = await getAuthHeaders({ refresh: true });
    result = await supabase.functions.invoke('admin-api', { body, headers });
  }

  if (result.error) {
    const debug = await getFunctionErrorDebug(result.error);
    console.error("admin-api call failed:", { body, ...debug, error: result.error });
    throw result.error;
  }

  return result.data as T;
};

export const fetchAllUsers = async (page: number = 1, perPage: number = 25): Promise<AdminUsersPage> => {
  try {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safePerPage = Number.isFinite(perPage) ? Math.min(100, Math.max(1, Math.floor(perPage))) : 25;
    const data = await invokeAdminApi<Partial<AdminUsersPage>>({
      action: 'getUsers',
      page: safePage,
      perPage: safePerPage,
    });

    // Default emailVerified to `true` when the server omits it. During a
    // deployment window where the edge function still returns the old
    // shape, treating unknown as verified avoids alarming admins with a
    // false "Unverified" badge on every row.
    const rawUsers = Array.isArray(data.users) ? (data.users as Partial<AdminUserSummary>[]) : [];
    const users: AdminUserSummary[] = rawUsers.map((u) => ({
      id: u.id ?? '',
      email: u.email ?? '',
      displayName: u.displayName ?? '',
      avatarUrl: u.avatarUrl ?? '',
      role: (u.role ?? 'reader') as AdminUserSummary['role'],
      createdAt: u.createdAt ?? '',
      emailVerified: u.emailVerified ?? true,
    }));

    return {
      users,
      page: typeof data.page === 'number' ? data.page : safePage,
      perPage: typeof data.perPage === 'number' ? data.perPage : safePerPage,
      total: typeof data.total === 'number' ? data.total : null,
      hasMore: typeof data.hasMore === 'boolean'
        ? data.hasMore
        : users.length === safePerPage,
    };
  } catch (error) {
    console.error("Error fetching users from Supabase:", error);
    throw error;
  }
};

export const deleteUser = async (id: string) => {
  try {
    const data = await invokeAdminApi<{ success?: boolean }>({ action: 'deleteUser', id });
    return !!data?.success;
  } catch (error) {
    console.error("Error deleting user via Supabase:", error);
    return false;
  }
};

/**
 * Storage housekeeping (admin only).
 *
 * Files in the `articles` bucket that no article references — a media
 * upload whose article was never saved, or whose article has since been
 * deleted or re-uploaded. The editors handle the cases they can see, but
 * a tab closed mid-edit skips their cleanup, so the bucket still drifts.
 *
 * Both calls go through admin-api, which runs the detection query with a
 * grace period (`minAgeHours`, default 24) so an in-progress draft's
 * upload is never a candidate.
 */
export type OrphanedMediaFile = {
  name: string;
  bytes: number;
  lastModified: string;
};

/** Buckets the orphan sweeper knows how to scan. Mirrors BUCKET_RPCS in admin-api. */
export type StorageBucket = 'articles' | 'avatars';

export const SWEEPABLE_BUCKETS: readonly StorageBucket[] = ['articles', 'avatars'] as const;

export type OrphanedMediaReport = {
  bucket: StorageBucket;
  minAgeHours: number;
  count: number;
  totalBytes: number;
  files: OrphanedMediaFile[];
};

export type OrphanedMediaPurgeResult = {
  bucket: StorageBucket;
  minAgeHours: number;
  candidates: number;
  removed: number;
  failed: number;
  freedBytes: number;
  totalBytes: number;
};

export const fetchOrphanedMedia = async (
  bucket: StorageBucket = 'articles',
  minAgeHours = 24
): Promise<OrphanedMediaReport> => {
  const data = await invokeAdminApi<Partial<OrphanedMediaReport>>({
    action: 'listOrphanedMedia',
    bucket,
    minAgeHours,
  });
  return {
    bucket: data?.bucket ?? bucket,
    minAgeHours: data?.minAgeHours ?? minAgeHours,
    count: data?.count ?? 0,
    totalBytes: data?.totalBytes ?? 0,
    files: data?.files ?? [],
  };
};

export const purgeOrphanedMedia = async (
  bucket: StorageBucket = 'articles',
  minAgeHours = 24
): Promise<OrphanedMediaPurgeResult> => {
  const data = await invokeAdminApi<Partial<OrphanedMediaPurgeResult>>({
    action: 'purgeOrphanedMedia',
    bucket,
    minAgeHours,
  });
  return {
    bucket: data?.bucket ?? bucket,
    minAgeHours: data?.minAgeHours ?? minAgeHours,
    candidates: data?.candidates ?? 0,
    removed: data?.removed ?? 0,
    failed: data?.failed ?? 0,
    freedBytes: data?.freedBytes ?? 0,
    totalBytes: data?.totalBytes ?? 0,
  };
};

export const deleteOwnAccount = async (): Promise<boolean> => {
  try {
    const data = await invokeAdminApi<{ success?: boolean }>({ action: 'deleteOwnAccount' });
    return !!data?.success;
  } catch (error) {
    console.error("Error deleting own account:", error);
    return false;
  }
};

export type UserDataExport = {
  exportedAt: string;
  account: {
    id: string;
    email?: string;
    createdAt?: string;
    emailConfirmedAt?: string | null;
    lastSignInAt?: string | null;
    role?: string;
  };
  profile: Record<string, unknown> | null;
  articles: Record<string, unknown>[];
  comments: Record<string, unknown>[];
  favorites: Record<string, unknown>[];
  newsletter: Record<string, unknown> | null;
};

export const exportOwnData = async (): Promise<UserDataExport | null> => {
  try {
    return await invokeAdminApi<UserDataExport>({ action: 'exportOwnData' });
  } catch (error) {
    console.error("Error exporting user data:", error);
    return null;
  }
};

export const updateUserRole = async (userId: string, role: string) => {
  try {
    const data = await invokeAdminApi<{ success?: boolean }>({ action: 'updateUserRole', userId, role });
    return !!data?.success;
  } catch (error) {
    console.error("Error updating user role via Supabase:", error);
    return false;
  }
};

type ContactMessageResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export const sendContactMessage = async (
  name: string,
  email: string,
  message: string,
  website: string = "",
  subject?: string
): Promise<ContactMessageResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('contact-email', {
      body: { name, email, message, website, subject }
    });

    if (error) {
      const debug = await getFunctionErrorDebug(error);
      let messageText: string | undefined;
      if (debug.body) {
        try {
          const parsed = JSON.parse(debug.body);
          if (typeof parsed?.error === 'string') {
            messageText = parsed.error;
          }
        } catch {
          messageText = debug.body;
        }
      }
      return { ok: false, status: debug.status, error: messageText };
    }

    if (data?.ok === true) {
      return { ok: true };
    }

    return { ok: false, error: 'Unexpected response from contact function' };
  } catch (error) {
    console.error("Error sending message via Supabase:", error);
    return { ok: false, error: "Request failed" };
  }
};

// ---- Storage ----

/**
 * Best-effort cleanup of a storage object. Used after a user removes media
 * from a draft / replaces an avatar / cancels an upload — without this, the
 * file lingers in the bucket forever.
 *
 * Errors are intentionally swallowed: if the file is already gone or the
 * caller lacks permission, we still want the UI to proceed cleanly.
 */
export const deleteStorageFile = async (bucket: string, path: string): Promise<void> => {
  if (!path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch (error) {
    console.warn(`Failed to delete storage file ${bucket}/${path}:`, error);
  }
};

/**
 * Extracts the in-bucket path from a Supabase public URL of the form
 * `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>`.
 * Returns null for unrecognized URL shapes.
 */
export const extractStoragePath = (publicUrl: string, bucket: string): string | null => {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const tail = publicUrl.slice(idx + marker.length);
  // Strip query / fragment that Supabase sometimes appends for cache-busting.
  const clean = tail.split('?')[0].split('#')[0];
  return clean || null;
};

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'] as const;
const IMAGE_MIME_PREFIXES = ['image/'] as const;
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v'] as const;
const VIDEO_MIME_PREFIXES = ['video/'] as const;

/**
 * Best-effort magic-byte check that the file's *content* matches the kind we
 * expect, not just its (user-controlled) extension and MIME type. Catches
 * honest mistakes like a renamed .exe or a video renamed to .jpg before we
 * spend bandwidth uploading it. Not a security boundary — the client is
 * untrusted; RLS scopes the path and the buckets only ever serve bytes back.
 *
 * Deliberately permissive: unknown-but-plausible container layouts pass
 * rather than blocking a legitimate upload.
 */
const matchesMagicBytes = async (file: File, kind: UploadKind): Promise<boolean> => {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    // Couldn't read the header (transient) — don't block the upload on it.
    return true;
  }
  if (bytes.length < 12) return false;

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  const boxType = ascii(4, 8);   // ISO-BMFF box type (mp4/mov/m4v/avif)
  const brand = ascii(8, 12);    // ftyp major brand

  const isIsoBmff = ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].includes(boxType);
  // avif/avis are the canonical AVIF brands; some encoders emit the generic
  // HEIF brands mif1/msf1 as the major brand with avif only in the (unread)
  // compatible-brands list — accept those too so valid files aren't rejected.
  const isHeifImageBrand =
    boxType === 'ftyp' && ['avif', 'avis', 'mif1', 'msf1'].includes(brand.toLowerCase());

  if (kind === 'image') {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;            // JPEG
    if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return true;                             // PNG
    if (ascii(0, 4) === 'GIF8') return true;                                                 // GIF
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return true;                      // WebP
    if (isHeifImageBrand) return true;                                                       // AVIF/HEIF
    return false;
  }

  // video: WebM (EBML) or an ISO base-media container that isn't a HEIF image.
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true; // WebM
  return isIsoBmff && !isHeifImageBrand;                                                     // MP4/MOV/M4V
};

// Upload ceilings. Exported because the editors render them as guidance next
// to the file picker, and a hardcoded string there is exactly how the UI came
// to promise "500 MB max" for months after the real cap became 150 MB.
// Deriving the label from the constant makes that drift impossible.
//
// These are mirrored by the buckets' own file_size_limit (migration
// 20260818192338), so the limit holds even against a client that skips the
// editor. Change one, change the other.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Deliberately far below what Storage would physically accept. A bucket limit
// is the point past which an upload is rejected; it is not a sensible thing to
// serve. At the old 500 MB this cap let through four films totalling 1.1 GB,
// one of them 397 MB, streamed to phones over mobile data and billed as egress
// on every play. Re-encoded (H.264 CRF 23, 1080p cap, faststart) the same four
// came to 282 MB, the largest 88 MB.
//
// 150 MB leaves comfortable headroom over that 88 MB while making the old
// failure mode impossible. A legitimate film that genuinely exceeds this wants
// re-encoding, not a bigger number. Raising it is a decision about bandwidth
// cost, not a bug fix.
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024; // 150 MB

/** Megabytes, for rendering a cap in the UI. */
export const asMb = (bytes: number): number => Math.round(bytes / (1024 * 1024));

export type UploadKind = 'image' | 'video';

export type UploadUserFileOptions = {
  /** 'articles' | 'avatars' — the storage bucket to write to. */
  bucket: string;
  /** What the file must be — controls extension allowlist + MIME check. */
  kind: UploadKind;
  /** Authenticated user id. RLS requires the path to live under this folder. */
  userId: string;
  /**
   * Optional segment that is prefixed under the user folder, e.g. 'carousels'.
   * Must already be allowed by the storage RLS policy.
   */
  subfolder?: string;
  /** Max bytes — falls back to a kind-specific default if omitted. */
  maxBytes?: number;
};

export type UploadUserFileResult = {
  publicUrl: string;
  /** Path inside the bucket; useful for cleanup on rollback. */
  storagePath: string;
};

/**
 * Validates a user-supplied file against an extension allowlist and MIME
 * prefix, then uploads it to a UUID-named path under the user's folder.
 *
 * Throws Error on validation failure or upload failure. Callers should
 * surface a localized message to the user.
 */
/**
 * Uploads a film's subtitles: WebVTT text already checked and converted by
 * prepareSubtitleFile (lib/subtitles). Same folder scheme as the film itself,
 * stories/<kind>/<user id>/<random id>, which the storage policies for the
 * articles bucket already cover.
 */
export const uploadSubtitleFile = async (vtt: string, userId: string): Promise<UploadUserFileResult> => {
  if (!userId) throw new Error('Not authenticated');
  const path = `stories/subtitles/${userId}/${crypto.randomUUID()}.vtt`;
  const { error } = await supabase.storage
    .from('articles')
    .upload(path, new Blob([vtt], { type: 'text/vtt' }), { contentType: 'text/vtt', upsert: false });
  if (error) {
    // The bucket refuses text/vtt until migration 20261102140000 has run.
    if (/mime|type/i.test(error.message)) {
      throw new Error('Subtitles can be uploaded once the database update (migration 20261102140000) has been applied.');
    }
    throw error;
  }
  const { data } = supabase.storage.from('articles').getPublicUrl(path);
  return { publicUrl: data.publicUrl, storagePath: path };
};

export const uploadUserFile = async (
  file: File,
  opts: UploadUserFileOptions
): Promise<UploadUserFileResult> => {
  const { bucket, kind, userId, subfolder } = opts;
  if (!userId) throw new Error('Not authenticated');

  const allowedExtensions = kind === 'image' ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
  const allowedMime = kind === 'image' ? IMAGE_MIME_PREFIXES : VIDEO_MIME_PREFIXES;
  const maxBytes = opts.maxBytes ?? (kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES);

  if (!file) throw new Error('No file provided');
  if (file.size > maxBytes) {
    throw new Error(`File too large (max ${(maxBytes / (1024 * 1024)).toFixed(0)}MB)`);
  }

  const mimeOk = allowedMime.some((prefix) => file.type.startsWith(prefix));
  if (!mimeOk) throw new Error('Unsupported file type');

  const rawExtension = (file.name.split('.').pop() || '').toLowerCase();
  if (!(allowedExtensions as readonly string[]).includes(rawExtension)) {
    throw new Error('Unsupported file extension');
  }

  // Extension and MIME type both come from the client; also sniff the first
  // bytes so a mislabeled file fails fast instead of uploading.
  if (!(await matchesMagicBytes(file, kind))) {
    throw new Error('File content does not match its type');
  }

  const id = crypto.randomUUID();

  const path = subfolder
    ? `${subfolder}/${userId}/${id}.${rawExtension}`
    : `${userId}/${id}.${rawExtension}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { publicUrl: data.publicUrl, storagePath: path };
};
