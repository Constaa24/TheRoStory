/**
 * The editorial desk's data (the redesign's AdminApp): daily reads, the
 * stories list with its bulk actions, shelves, readers' notes and the
 * dispatch. Everything here runs as the signed-in admin or writer; the
 * database's row-level security decides what each may see and change
 * (migration 20261110120000).
 */
import {
  supabase, toCamelCase, toCamelCaseArray, invalidatePublicContentCache, extractStoragePath, deleteStorageFile,
  invokeAdminFunction, fetchAllRows, type Article, type Comment,
} from "@/lib/supabase";

// Every list on the desk is read through fetchAllRows: PostgREST answers at
// most 1,000 rows whatever .limit() asks for, and says nothing when it stops
// short. The daily reads alone are a row per story per day, so the 60-day
// window passes that with 17 stories read every day.

// ---------------------------------------------------------------- overview

export type DeskStats = { readers: number; readers30d: number; subscribers: number; subscribers30d: number; flagged: number };

/** Counts only admins may see (readers, subscribers, flagged notes). Null for a writer. */
export const fetchDeskStats = async (): Promise<DeskStats | null> => {
  const { data, error } = await supabase.rpc("desk_stats");
  if (error) {
    if (error.code === "42501") return null;
    throw error;
  }
  const d = data as Record<string, number>;
  return { readers: d.readers ?? 0, readers30d: d.readers_30d ?? 0, subscribers: d.subscribers ?? 0, subscribers30d: d.subscribers_30d ?? 0, flagged: d.flagged ?? 0 };
};

export type DailyRead = { articleId: string; day: string; views: number };

/** Reads per story per day, for the last `days` days (Bucharest days, as the database counts them). */
export const fetchDailyReads = async (days: number): Promise<DailyRead[]> => {
  const since = lastDays(days)[0];
  const rows = await fetchAllRows<{ article_id: string; day: string; views: number }>((from, to) =>
    supabase
      .from("article_reads_daily")
      .select("article_id, day, views")
      .gte("day", since)
      .order("day", { ascending: true })
      .order("article_id", { ascending: true })
      .range(from, to)
  );
  return rows.map((r) => ({ articleId: r.article_id, day: r.day, views: r.views }));
};

/**
 * The last `days` calendar days ending today, oldest first, as YYYY-MM-DD in
 * Bucharest. Counted back on the calendar from today's date, not in steps of
 * 24 hours from now: across a clock change those land on the same day twice
 * (or skip one) in the hour after midnight.
 */
// Made once: building an Intl.DateTimeFormat is far slower than using one.
const BUCHAREST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" });

export const lastDays = (days: number, now = new Date()): string[] => {
  const today = BUCHAREST_DAY.format(now);
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m - 1, d - (days - 1 - i))).toISOString().slice(0, 10));
};

// ---------------------------------------------------------------- stories

const DESK_COLUMNS =
  "id, title_en, title_ro, type, subtype, media_url, poster_url, media_urls, location, place_name_en, place_name_ro, category_id, user_id, is_published, publish_at, created_at";

export type StoryStatus = "published" | "scheduled" | "draft";
export const statusOf = (a: Pick<Article, "isPublished" | "publishAt">): StoryStatus =>
  a.isPublished ? "published" : a.publishAt ? "scheduled" : "draft";

/** Every story the desk may see (an admin: all; a writer: their own and the published), newest first. */
export const fetchDeskArticles = async (ownerId?: string): Promise<Article[]> => {
  const rows = await fetchAllRows<Record<string, unknown>>((from, to) => {
    let q = supabase.from("articles").select(DESK_COLUMNS);
    if (ownerId) q = q.eq("user_id", ownerId);
    return q.order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, to);
  });
  return toCamelCaseArray<Article>(rows);
};

/** Lifetime reads for every story that has any. */
export const fetchAllViewCounts = async (): Promise<Record<string, number>> => {
  const rows = await fetchAllRows<{ article_id: string; view_count: number | null }>((from, to) =>
    supabase.from("article_views").select("article_id, view_count").order("article_id", { ascending: true }).range(from, to)
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.article_id] = r.view_count || 0;
  return out;
};

/** Publish (clearing any schedule) or move back to drafts. Admins only; the database enforces it. */
export const setArticlesPublished = async (ids: string[], published: boolean): Promise<void> => {
  if (!ids.length) return;
  const { error } = await supabase.from("articles").update({ is_published: published, publish_at: null }).in("id", ids);
  if (error) throw error;
  invalidatePublicContentCache();
};

/**
 * Deletes a story and then, best effort, its files in storage (cover,
 * poster, frames, film, subtitles), which don't go with the row. The row is
 * read whole first: the list holds only some columns.
 */
export const deleteArticleWithMedia = async (id: string): Promise<void> => {
  const { data: row } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
  const a = row ? toCamelCase<Article>(row as Record<string, unknown>) : null;
  const paths = a
    ? [a.mediaUrl, a.posterUrl, ...(a.mediaUrls ?? []), a.subtitlesEnUrl, a.subtitlesRoUrl]
        .map((url) => (url ? extractStoragePath(url, "articles") : null))
        .filter((p): p is string => !!p)
    : [];
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw error;
  invalidatePublicContentCache();
  for (const p of paths) void deleteStorageFile("articles", p);
};

// ---------------------------------------------------------------- shelves

export const SHELF_DESCRIPTION_MAX = 600;

export const updateShelf = async (id: string, patch: { descriptionEn?: string | null; descriptionRo?: string | null }): Promise<void> => {
  const row: Record<string, string | null> = {};
  if (patch.descriptionEn !== undefined) row.description_en = patch.descriptionEn?.trim() || null;
  if (patch.descriptionRo !== undefined) row.description_ro = patch.descriptionRo?.trim() || null;
  const { error } = await supabase.from("categories").update(row).eq("id", id);
  if (error) throw error;
  invalidatePublicContentCache();
};

/**
 * Saves the site's shelf order: each shelf's place in `ids`, in one
 * statement (set_shelf_order, migration 20261117120000), so a failure leaves
 * the old order whole rather than half of each. Before that migration runs,
 * one update per shelf, as it always was.
 */
export const saveShelfOrder = async (ids: string[]): Promise<void> => {
  const { error } = await supabase.rpc("set_shelf_order", { p_ids: ids });
  if (error) {
    const missing = error.code === "PGRST202" || error.code === "42883";
    if (!missing) throw error;
    const results = await Promise.all(ids.map((id, i) => supabase.from("categories").update({ sort_order: i + 1 }).eq("id", id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }
  invalidatePublicContentCache();
};

// ---------------------------------------------------------------- readers' notes

export type DeskNote = Comment & { flags: number; storyTitleEn: string; storyTitleRo: string };

/**
 * The Comments section's three tabs: flagged (on the site, most flags
 * first), everything on the site, and the hidden. A hidden note is never
 * "flagged": its flags wait in case it is shown again.
 */
export const groupNotes = <T extends Pick<DeskNote, "hiddenAt" | "flags">>(notes: T[]) => ({
  flagged: notes.filter((c) => !c.hiddenAt && c.flags > 0).sort((a, b) => b.flags - a.flags),
  visible: notes.filter((c) => !c.hiddenAt),
  hidden: notes.filter((c) => !!c.hiddenAt),
});

/** Every note (an admin sees hidden ones too), flagged first, then newest. */
export const fetchDeskNotes = async (): Promise<DeskNote[]> => {
  type NoteRow = Record<string, unknown> & { articles?: { title_en?: string; title_ro?: string } | null };
  const [notes, flags] = await Promise.all([
    fetchAllRows<NoteRow>((from, to) =>
      supabase.from("comments").select("*, articles(title_en, title_ro)").order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, to)
    ),
    fetchAllRows<{ comment_id: string }>((from, to) =>
      supabase.from("comment_flags").select("comment_id").order("comment_id", { ascending: true }).order("user_id", { ascending: true }).range(from, to)
    ),
  ]);
  const count = new Map<string, number>();
  for (const f of flags) count.set(f.comment_id, (count.get(f.comment_id) || 0) + 1);
  return notes.map((r) => {
    const { articles, ...rest } = r;
    const c = toCamelCase<Comment>(rest);
    return { ...c, flags: count.get(c.id) || 0, storyTitleEn: articles?.title_en || "", storyTitleRo: articles?.title_ro || "" };
  });
};

/** Hide a note (only its writer and admins see it) or bring it back. */
export const setNoteHidden = async (id: string, hidden: boolean): Promise<void> => {
  const { error } = await supabase.from("comments").update({ hidden_at: hidden ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw error;
};

/** Clear a note's flags: the editors have looked and are keeping it. */
export const clearNoteFlags = async (id: string): Promise<void> => {
  const { error } = await supabase.from("comment_flags").delete().eq("comment_id", id);
  if (error) throw error;
};

export const deleteNote = async (id: string): Promise<void> => {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
};

/** A reader flags a note for the editors. True if flagged (or already was). */
export const flagNote = async (commentId: string): Promise<boolean> => {
  const { error } = await supabase.from("comment_flags").insert({ comment_id: commentId });
  if (!error || error.code === "23505") return true;
  console.error("Error flagging a note:", error);
  return false;
};

/** Which of these notes the signed-in reader has already flagged. */
export const fetchMyFlags = async (commentIds: string[]): Promise<Set<string>> => {
  if (!commentIds.length) return new Set();
  const { data, error } = await supabase.from("comment_flags").select("comment_id").in("comment_id", commentIds);
  if (error) return new Set();
  return new Set(((data || []) as { comment_id: string }[]).map((r) => r.comment_id));
};

/** How many notes each reader has left. */
export const fetchNoteCounts = async (): Promise<Record<string, number>> => {
  const rows = await fetchAllRows<{ user_id: string }>((from, to) =>
    supabase.from("comments").select("user_id").order("id", { ascending: true }).range(from, to)
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.user_id] = (out[r.user_id] || 0) + 1;
  return out;
};

// ---------------------------------------------------------------- the dispatch

export type Dispatch = { id: string; subject: string; storyIds: string[]; recipients: number; sentAt: string };

export const fetchDispatches = async (): Promise<Dispatch[]> => {
  // recipients > 0: a send in progress holds a row with none yet (the
  // dispatch function's guard against sending twice), which isn't a letter.
  const { data, error } = await supabase.from("newsletter_dispatches").select("id, subject, story_ids, recipients, sent_at").gt("recipients", 0).order("sent_at", { ascending: false }).limit(50);
  if (error) throw error;
  return ((data || []) as { id: string; subject: string; story_ids: string[]; recipients: number; sent_at: string }[])
    .map((r) => ({ id: r.id, subject: r.subject, storyIds: r.story_ids || [], recipients: r.recipients, sentAt: r.sent_at }));
};

export const DISPATCH_LIMITS = { SUBJECT_MAX: 200, BODY_MAX: 20000, STORIES_MAX: 12 } as const;

/**
 * Sends the dispatch: "test" to the signed-in admin only, "send" to every
 * confirmed subscriber. Resolves with the server's own words on failure.
 */
export const sendDispatch = async (
  action: "test" | "send",
  letter: { subject: string; body: string; storyIds: string[] },
): Promise<{ ok: true; recipients?: number; missing?: number; to?: string } | { ok: false; error: string }> => {
  try {
    const data = await invokeAdminFunction<{ ok?: boolean; recipients?: number; missing?: number; to?: string }>("newsletter-dispatch", { action, ...letter });
    return { ok: true, recipients: data?.recipients, missing: data?.missing, to: data?.to };
  } catch (error) {
    const response = (error as { context?: Response } | null)?.context;
    let message = "";
    try { message = response ? ((await response.clone().json()) as { error?: string }).error || "" : ""; } catch { /* not JSON */ }
    return { ok: false, error: message };
  }
};
