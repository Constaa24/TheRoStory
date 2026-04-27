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
  mediaUrls?: string[];
  mediaCaptions?: MediaCaption[];
  location?: string;
  createdAt: string;
  // UI-only fields for chapter editing (not stored in DB)
  chaptersEn?: string[];
  chaptersRo?: string[];
};

export type UserRole = {
  id: string;
  userId: string;
  role: 'admin' | 'writer' | 'reader';
};

export type Favorite = {
  id: string;
  userId: string;
  articleId: string;
  createdAt: string;
};

export type Comment = {
  id: string;
  articleId: string;
  userId: string;
  userDisplayName?: string;
  content: string;
  createdAt: string;
};

export type ArticleView = {
  id: string;
  articleId: string;
  viewCount: number;
  updatedAt: string;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  role: 'admin' | 'writer' | 'reader';
  createdAt: string;
};

export type AdminUsersPage = {
  users: AdminUserSummary[];
  page: number;
  perPage: number;
  total: number | null;
  hasMore: boolean;
};

export type ContactMessageResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

// ---- Localization utility ----

export const getLocalized = (obj: Record<string, unknown>, field: string, lang: 'en' | 'ro'): string => {
  const localizedKey = `${field}${lang === 'en' ? 'En' : 'Ro'}`;
  return String(obj[localizedKey] ?? obj[field] ?? '');
};

// ---- Constants and Parsers ----

export const CHAPTER_DELIMITER = "|||CHAPTER|||";

export const parseChapters = (content: string): string[] => {
  if (!content) return ["", "", "", "", ""];
  const chapters = content.split(CHAPTER_DELIMITER);
  while (chapters.length < 5) chapters.push("");
  return chapters.slice(0, 5);
};

// ---- Data Fetching ----

// Simple in-memory cache for public content
const publicContentCache: {
  published: { data: { categories: Category[]; articles: Article[] }; time: number } | null;
  all: { data: { categories: Category[]; articles: Article[] }; time: number } | null;
} = { published: null, all: null };

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Invalidate the public content cache (call after admin creates/edits/deletes content). */
export const invalidatePublicContentCache = () => {
  publicContentCache.published = null;
  publicContentCache.all = null;
  _categoryCountsCache = null;
};

// Lightweight cache for category article counts (category_id column only)
let _categoryCountsCache: { data: Record<string, number>; time: number } | null = null;

/**
 * Fetches only the category_id column for all published articles and returns
 * a map of categoryId → count. Much lighter than fetchPublicContent().
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

export const fetchPublicContent = async (onlyPublished: boolean = true): Promise<{ categories: Category[]; articles: Article[] }> => {
  const cacheKey = onlyPublished ? 'published' : 'all';
  const cached = publicContentCache[cacheKey];
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  try {
    let articlesQuery = supabase.from('articles').select('*');

    if (onlyPublished) {
      articlesQuery = articlesQuery.eq('is_published', true);
    }

    const catsPromise = supabase.from('categories').select('*').order('name_en', { ascending: true });
    const artsPromise = articlesQuery.order('created_at', { ascending: false }).limit(500);

    const [categoriesRes, articlesRes] = await Promise.all([catsPromise, artsPromise]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (articlesRes.error) throw articlesRes.error;

    const result = {
      categories: toCamelCaseArray<Category>(categoriesRes.data || []),
      articles: toCamelCaseArray<Article>(articlesRes.data || [])
    };

    publicContentCache[cacheKey] = { data: result, time: Date.now() };
    return result;
  } catch (error) {
    if (!isAbortError(error)) {
      console.error("Error fetching data from Supabase:", error);
      throw error;
    }
    return { categories: [], articles: [] };
  }
};

/**
 * Unified article creation. All three story types funnel through here:
 * one INSERT shape, one validation pass, UUID-based IDs, and consistent
 * cache invalidation. Replaces three near-identical inserts spread across
 * AdminDashboard / VideoStoryCreate / CarouselStoryCreate.
 */
export type NewArticleInput = {
  type: 'text' | 'video' | 'carousel';
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

export const createArticle = async (input: NewArticleInput): Promise<{ id: string }> => {
  const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? `art_${crypto.randomUUID()}`
    : `art_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const row: Record<string, unknown> = {
    id,
    title_en: input.titleEn.trim(),
    title_ro: input.titleRo.trim(),
    content_en: input.contentEn,
    content_ro: input.contentRo,
    category_id: input.categoryId,
    location: input.location || null,
    media_url: input.mediaUrl ?? null,
    poster_url: input.posterUrl ?? null,
    media_urls: input.mediaUrls ?? null,
    media_captions: input.mediaCaptions ?? null,
    user_id: input.userId,
    is_published: input.isPublished,
    type: input.type,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('articles').insert(row);
  if (error) throw error;

  invalidatePublicContentCache();
  return { id };
};

export const fetchCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name_en', { ascending: true });
  if (error) throw error;
  return toCamelCaseArray<Category>(data || []);
};

export const searchArticles = async (query: string, limit = 6): Promise<Article[]> => {
  if (!query.trim()) return [];
  const q = query.trim();
  const { data, error } = await supabase
    .from('articles')
    .select('*')
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

export const postComment = async (comment: Omit<Comment, 'id' | 'createdAt'>) => {
  try {
    const { error } = await supabase.from('comments').insert(toSnakeCase({
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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

export const fetchArticleViews = async (articleId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('article_views')
      .select('view_count')
      .eq('article_id', articleId)
      .maybeSingle();
    if (error) throw error;
    return data?.view_count || 0;
  } catch (error) {
    console.warn('Failed to fetch article views:', error);
    return 0;
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

  try {
    const { error } = await supabase.rpc('increment_article_view', {
      p_article_id: articleId
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("Error incrementing view in Supabase:", error);
    return false;
  }
};

export const toggleFavorite = async (userId: string, articleId: string) => {
  try {
    const { data, error: selectError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .maybeSingle();

    if (selectError) throw selectError;

    if (data) {
      const { error: deleteError } = await supabase.from('favorites').delete().eq('id', data.id);
      if (deleteError) throw deleteError;
      return false; // Removed
    } else {
      const { error: insertError } = await supabase.from('favorites').insert({ user_id: userId, article_id: articleId });
      if (insertError) throw insertError;
      return true; // Added
    }
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
    
    const { data: articlesData, error: articlesError } = await supabase
      .from('articles')
      .select('*')
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

export const isArticleFavorited = async (userId: string, articleId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error("Error checking favorite status in Supabase:", error);
    throw error;
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

const getFunctionErrorDebug = async (error: any): Promise<{ status?: number; body?: string }> => {
  const response = error?.context ?? error?.response;
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

const isFunction401 = (error: any): boolean => {
  const response = error?.context ?? error?.response;
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

    return {
      users: Array.isArray(data.users) ? (data.users as AdminUserSummary[]) : [],
      page: typeof data.page === 'number' ? data.page : safePage,
      perPage: typeof data.perPage === 'number' ? data.perPage : safePerPage,
      total: typeof data.total === 'number' ? data.total : null,
      hasMore: typeof data.hasMore === 'boolean'
        ? data.hasMore
        : Array.isArray(data.users) && data.users.length === safePerPage,
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

export const sendContactMessage = async (
  name: string,
  email: string,
  message: string,
  website: string = ""
): Promise<ContactMessageResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('contact-email', {
      body: { name, email, message, website }
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

export const uploadFile = async (
  bucket: string,
  path: string,
  file: File
): Promise<string> => {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
};
