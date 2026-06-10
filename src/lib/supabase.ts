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
};

const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([k, v]) => [v, k])
);

export function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
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

export function toCamelCaseArray<T>(arr: Record<string, unknown>[]): T[] {
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
  createdAt: string;
  updatedAt?: string;
  // UI-only fields for chapter editing (not stored in DB)
  chaptersEn?: string[];
  chaptersRo?: string[];
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
};

/**
 * Fetches only the category_id column for all published articles and returns
 * a map of categoryId → count. Much lighter than fetching full articles.
 */
export const fetchArticleCategoryCounts = async (): Promise<Record<string, number>> => {
  if (_categoryCountsCache && Date.now() - _categoryCountsCache.time < CACHE_TTL) {
    return _categoryCountsCache.data;
  }
  const { data, error } = await supabase
    .from('articles')
    .select('category_id')
    .eq('is_published', true);
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data || []).forEach((row: { category_id: string }) => {
    counts[row.category_id] = (counts[row.category_id] || 0) + 1;
  });
  _categoryCountsCache = { data: counts, time: Date.now() };
  return counts;
};

/**
 * Targeted fetcher for the map view. Pulls only the columns the map actually
 * renders (location, type, thumbnails, title) and only rows that have a
 * `location`. Replaces a full all-articles round-trip that was
 * pulling up to 500 articles just to compute county counts.
 *
 * `content_en` / `content_ro` are intentionally NOT selected — the map side
 * panel renders title + thumbnail only, and pulling content was wasting
 * hundreds of KB per page load.
 */
export const fetchMapArticles = async (): Promise<Article[]> => {
  const { data, error } = await supabase
    .from('articles')
    .select('id, title_en, title_ro, type, subtype, media_url, poster_url, media_urls, location, category_id, user_id, is_published, created_at')
    .eq('is_published', true)
    .not('location', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  return toCamelCaseArray<Article>(data || []);
};

/**
 * Slim columns used by listing surfaces (related-articles strip, future
 * editor previews). Excludes `content_en` / `content_ro` so we don't pull
 * ~10k chars per row when the consumer only renders title + cover.
 */
const ARTICLE_CARD_COLUMNS =
  'id, title_en, title_ro, type, subtype, media_url, poster_url, media_urls, location, category_id, user_id, is_published, created_at';

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
    let sameCategory: Article[] = [];
    if (categoryId) {
      const { data, error } = await supabase
        .from('articles')
        .select(ARTICLE_CARD_COLUMNS)
        .eq('is_published', true)
        .eq('category_id', categoryId)
        .neq('id', excludeId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      sameCategory = toCamelCaseArray<Article>(data || []);
    }

    const remaining = limit - sameCategory.length;
    if (remaining <= 0) return sameCategory;

    // Fill the remainder. Exclude the article itself and (if we have one)
    // the category we already pulled from, so we don't risk dupes.
    let supplementalQuery = supabase
      .from('articles')
      .select(ARTICLE_CARD_COLUMNS)
      .eq('is_published', true)
      .neq('id', excludeId)
      .order('created_at', { ascending: false })
      .limit(remaining);
    if (categoryId) {
      supplementalQuery = supplementalQuery.neq('category_id', categoryId);
    }
    const { data: supplementalData, error: supplementalError } = await supplementalQuery;
    if (supplementalError) throw supplementalError;
    return [...sameCategory, ...toCamelCaseArray<Article>(supplementalData || [])];
  } catch (error) {
    if (!isAbortError(error)) {
      console.error('Error fetching related articles:', error);
    }
    return [];
  }
};

/**
 * Admin/writer dashboard fetcher. Skips the public-content cache (admins
 * always want fresh data) and accepts an optional `ownerId` so writers
 * fetch only their own rows server-side rather than pulling every
 * published article and filtering client-side.
 */
export const fetchAdminArticles = async (
  ownerId?: string
): Promise<{ categories: Category[]; articles: Article[] }> => {
  let articlesQuery = supabase.from('articles').select('*');
  if (ownerId) articlesQuery = articlesQuery.eq('user_id', ownerId);

  const [categoriesRes, articlesRes] = await Promise.all([
    supabase.from('categories').select('*').order('name_en', { ascending: true }),
    articlesQuery.order('created_at', { ascending: false }).limit(500),
  ]);

  if (categoriesRes.error) throw categoriesRes.error;
  if (articlesRes.error) throw articlesRes.error;

  return {
    categories: toCamelCaseArray<Category>(categoriesRes.data || []),
    articles: toCamelCaseArray<Article>(articlesRes.data || []),
  };
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
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('articles').insert(row);
  if (error) throw error;

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
  };

  const { error } = await supabase.from('articles').update(updates).eq('id', input.id);
  if (error) throw error;

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
 * Sanitize a user-supplied search term for use inside PostgREST `or()` filters.
 *
 * PostgREST parses the string itself (commas separate clauses, parentheses
 * group, colons delimit operators, `*` is a wildcard). It also passes the
 * value through to PostgreSQL `ILIKE`, where `%` and `_` are wildcards and
 * `\` is the escape char.
 *
 * Without escaping, a user typing `a, b` would silently turn one filter into
 * two, and a query containing `(` could break the whole request.
 */
const escapePostgrestLikeTerm = (term: string): string =>
  term
    // ILIKE escape char first, so we don't double-escape the next two
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    // PostgREST OR-filter syntax separators
    .replace(/[,():*]/g, ' ');

export const searchArticles = async (query: string, limit = 6): Promise<Article[]> => {
  if (!query.trim()) return [];
  const q = escapePostgrestLikeTerm(query.trim());
  if (!q.trim()) return [];
  // Card columns only — the search overlay renders title + category +
  // thumbnail, so pulling both full content columns per hit was waste.
  const { data, error } = await supabase
    .from('articles')
    .select(ARTICLE_CARD_COLUMNS)
    .eq('is_published', true)
    .or(
      `title_en.ilike.%${q}%,title_ro.ilike.%${q}%,content_en.ilike.%${q}%,content_ro.ilike.%${q}%,location.ilike.%${q}%`
    )
    .limit(limit);
  if (error) throw error;
  return toCamelCaseArray<Article>(data || []);
};

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
    .order('created_at', { ascending: false });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error, count } = await query.range(start, end);
  if (error) throw error;
  return { articles: toCamelCaseArray<Article>(data || []), total: count ?? 0 };
};

export const fetchRandomArticle = async (): Promise<Article | null> => {
  try {
    const { count } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);
    if (!count) return null;
    const offset = Math.floor(Math.random() * count);
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .range(offset, offset)
      .single();
    if (error || !data) return null;
    return toCamelCase<Article>(data);
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

export const COMMENTS_PAGE_SIZE = 25;

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

export const toggleFavorite = async (userId: string, articleId: string) => {
  // Atomic toggle: try INSERT first; if a row already exists we'd violate
  // the (user_id, article_id) UNIQUE constraint, so DELETE instead. The
  // previous SELECT-then-INSERT/DELETE was a TOCTOU race — two near-
  // simultaneous calls could both see "not favorited" and both attempt
  // INSERT. The useFavorites hook guards against UI double-clicks, but
  // any direct API caller (or future callsite without the guard) hit
  // the race.
  try {
    const { error: insertError } = await supabase
      .from('favorites')
      .insert({ user_id: userId, article_id: articleId });

    if (!insertError) return true; // Added

    // 23505 = unique_violation. Anything else is a real error.
    const isUniqueViolation =
      (insertError as { code?: string })?.code === '23505';
    if (!isUniqueViolation) throw insertError;

    const { error: deleteError } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('article_id', articleId);
    if (deleteError) throw deleteError;
    return false; // Removed
  } catch (error) {
    console.error("Error toggling favorite in Supabase:", error);
    throw error;
  }
};

export const fetchUserFavorites = async (userId: string): Promise<Article[]> => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('article_id')
      .eq('user_id', userId);
    
    if (error) throw error;
    if (!data || data.length === 0) return [];
    
    const articleIds = (data as { article_id: string }[]).map((f) => f.article_id);

    // Hide favorites whose article was unpublished after the favorite was
    // created — clicking such an entry would 404 via fetchPublicArticle.
    const { data: articlesData, error: articlesError } = await supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .in('id', articleIds);

    if (articlesError) throw articlesError;
    return toCamelCaseArray<Article>(articlesData || []);
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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

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
