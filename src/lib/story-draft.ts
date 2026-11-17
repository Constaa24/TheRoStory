/**
 * Unsaved work in the story editors.
 *
 * The copy: while the form differs from the saved story, the editor keeps a
 * copy of it in this browser's localStorage, so a closed tab, a crash or a
 * stray click away doesn't lose the work; opening the story again offers it
 * back. One copy per person, editor and story. It goes when the story is
 * saved, when it is discarded, when its person signs out, and after 30 days.
 * (Privacy, "Cookies and local storage", says so.)
 *
 * The preview: a tab that shows the story as readers will see it, unsaved
 * changes included. It keeps nothing: it asks the open editor for the story
 * over a BroadcastChannel and the editor answers, and again after each
 * change.
 */
import type { Article } from "@/lib/supabase";

export type StoryKind = "text" | "video" | "carousel";

export const DRAFT_PREFIX = "rostory_story_draft:";
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type StoredDraft<F> = {
  v: 1;
  /** When the copy was last written. */
  savedAt: string;
  /** The saved story's updated_at when these edits began; null for a new story. */
  baseUpdatedAt: string | null;
  form: F;
};

export const draftKey = (userId: string, kind: StoryKind, storyId: string | null): string =>
  `${DRAFT_PREFIX}${userId}:${kind}:${storyId ?? "new"}`;

/** The copy under `key`, or null. A copy that is too old or unreadable is removed. */
export const readDraft = <F>(key: string, now = Date.now()): StoredDraft<F> | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<StoredDraft<F>> | null;
    const at = typeof d?.savedAt === "string" ? Date.parse(d.savedAt) : NaN;
    if (!d || d.v !== 1 || !d.form || typeof d.form !== "object" || Number.isNaN(at) || now - at > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return d as StoredDraft<F>;
  } catch {
    return null;
  }
};

/** False when the browser won't store it (blocked, private, or full). */
export const writeDraft = <F>(key: string, d: StoredDraft<F>): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
};

export const removeDraft = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage blocked: nothing was kept */
  }
};

const draftKeys = (): string[] => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(DRAFT_PREFIX)) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
};

/** Removes every copy older than 30 days, whoever's. */
export const pruneDrafts = (now = Date.now()): void => {
  for (const k of draftKeys()) readDraft(k, now);
};

/** On signing out, that person's copies go too (or everyone's, without an id). */
export const clearStoryDrafts = (userId?: string): void => {
  const mine = userId ? `${DRAFT_PREFIX}${userId}:` : DRAFT_PREFIX;
  for (const k of draftKeys()) if (k.startsWith(mine)) removeDraft(k);
};

/** Whether the story was saved (from anywhere) after the copy's edits began. */
export const savedSince = (d: Pick<StoredDraft<unknown>, "baseUpdatedAt">, updatedAt: string | null | undefined): boolean =>
  !!d.baseUpdatedAt && !!updatedAt && Date.parse(updatedAt) > Date.parse(d.baseUpdatedAt);

// ---------------------------------------------------------------- the preview

export const PREVIEW_CHANNEL = "rostory-story-preview";

export type PreviewMessage =
  /** A preview tab asks for its story. */
  | { type: "want"; key: string }
  /** An editor has opened (or reopened) that story: a waiting preview asks again. */
  | { type: "open"; key: string }
  /** The story as it would be saved; `dirty` when that isn't what is saved yet. */
  | { type: "story"; key: string; article: Article; dirty: boolean }
  /** The editor was closed. */
  | { type: "closed"; key: string };

export const previewKey = (kind: StoryKind, storyId: string | null): string => `${kind}:${storyId ?? "new"}`;

export const previewPath = (kind: StoryKind, storyId: string | null): string =>
  `/admin/preview?story=${encodeURIComponent(previewKey(kind, storyId))}`;

/** Where a preview's story is edited: the way back from the preview tab. */
export const editorPathForKey = (key: string): string => {
  const [kind, id] = key.split(":");
  const base = kind === "video" ? "/admin/video-story" : kind === "carousel" ? "/admin/carousel-story" : "/admin/text-story";
  return !id || id === "new" ? `${base}/create` : `${base}/edit/${encodeURIComponent(id)}`;
};
