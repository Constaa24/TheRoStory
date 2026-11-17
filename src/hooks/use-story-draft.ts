import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/supabase";
import {
  draftKey, previewKey, pruneDrafts, readDraft, removeDraft, savedSince, writeDraft,
  PREVIEW_CHANNEL, type PreviewMessage, type StoryKind,
} from "@/lib/story-draft";

const WRITE_DELAY_MS = 600;
const PREVIEW_DELAY_MS = 250;

export type DraftOffer = { savedAt: string; savedSince: boolean };

/**
 * An editor's unsaved copy and its preview (see lib/story-draft).
 *
 * Once the story is in the form (`ready`), a copy left from an earlier visit
 * is offered back, unless it says nothing the form doesn't. From then on the
 * copy follows the form while it differs from the saved story, and is
 * written at once when the tab is hidden or closed. While an offer waits for
 * an answer nothing is written, so the older copy is never lost unasked.
 *
 * The editor calls `clear()` after a save or a deliberate "leave without
 * saving", and `flush()` as it unmounts: true means a copy was kept, so the
 * files it points to must stay.
 */
export function useStoryDraft<F>(o: {
  userId: string | undefined;
  kind: StoryKind;
  /** The story's id; null for a new one. */
  storyId: string | null;
  ready: boolean;
  form: F;
  /** JSON.stringify(form), as the editor already computes it. */
  snapshot: string;
  /** The form differs from the saved story. */
  dirty: boolean;
  /** The saved story's updated_at; null for a new story. */
  updatedAt: string | null;
  /** The story as it would read once saved, for the preview. */
  buildPreview: () => Article;
  onRestore: (form: F) => void;
}) {
  const key = o.userId ? draftKey(o.userId, o.kind, o.storyId) : null;
  const pKey = previewKey(o.kind, o.storyId);
  const [offer, setOffer] = useState<(DraftOffer & { form: F }) | null>(null);

  const latest = useRef(o);
  latest.current = o;
  const keyRef = useRef(key);
  keyRef.current = key;
  const offerRef = useRef(offer);
  offerRef.current = offer;
  const checked = useRef(false);
  const cleared = useRef(false);
  const base = useRef<string | null>(null);
  const sendRef = useRef<(() => void) | null>(null);
  const wanted = useRef(false);

  /** Writes the copy, or removes it when there is nothing unsaved. True if a copy is kept. */
  const write = useCallback((): boolean => {
    const k = keyRef.current;
    if (!k || cleared.current || !checked.current || offerRef.current) return false;
    const { dirty, form } = latest.current;
    if (!dirty) {
      removeDraft(k);
      return false;
    }
    return writeDraft<F>(k, { v: 1, savedAt: new Date().toISOString(), baseUpdatedAt: base.current, form });
  }, []);

  // A copy from an earlier visit, offered once the story is in the form.
  useEffect(() => {
    if (!o.ready || !key || checked.current) return;
    checked.current = true;
    base.current = latest.current.updatedAt;
    pruneDrafts();
    const d = readDraft<F>(key);
    if (!d) return;
    if (JSON.stringify(d.form) === latest.current.snapshot) {
      removeDraft(key);
      return;
    }
    setOffer({ savedAt: d.savedAt, savedSince: savedSince(d, latest.current.updatedAt), form: d.form });
  }, [o.ready, key]);

  // The copy follows the form...
  useEffect(() => {
    if (!o.ready || offer) return;
    const t = window.setTimeout(write, WRITE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [o.ready, o.snapshot, offer, write]);

  // ...and is written at once when the tab is hidden or closed, where a
  // timer may never get to run.
  useEffect(() => {
    const onPageHide = () => { write(); };
    const onHidden = () => { if (document.visibilityState === "hidden") write(); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [write]);

  // The preview tab asks for the story; the editor answers, and says when it closes.
  useEffect(() => {
    if (!o.ready || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(PREVIEW_CHANNEL);
    const post = (m: PreviewMessage) => { try { ch.postMessage(m); } catch { /* closed, or not cloneable */ } };
    const send = () => {
      let article: Article;
      try {
        article = latest.current.buildPreview();
      } catch {
        // Half-typed coordinates or years don't make a story yet: the
        // preview keeps the last version that did.
        return;
      }
      post({ type: "story", key: pKey, article, dirty: latest.current.dirty });
    };
    sendRef.current = send;
    ch.onmessage = (e: MessageEvent<PreviewMessage>) => {
      if (e.data?.type === "want" && e.data.key === pKey) {
        wanted.current = true;
        send();
      }
    };
    post({ type: "open", key: pKey });
    // A closed tab, a reload or a full navigation never unmounts anything:
    // say so on the way out too. (After a reload the editor says "open"
    // again, and a waiting preview asks again.)
    const onPageHide = () => post({ type: "closed", key: pKey });
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      sendRef.current = null;
      post({ type: "closed", key: pKey });
      ch.close();
    };
  }, [o.ready, pKey]);

  // ...and again after each change, once a preview has asked.
  useEffect(() => {
    if (!o.ready || !wanted.current) return;
    const t = window.setTimeout(() => sendRef.current?.(), PREVIEW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [o.ready, o.snapshot]);

  const restore = useCallback(() => {
    const kept = offerRef.current;
    if (!kept) return;
    latest.current.onRestore(kept.form);
    setOffer(null);
  }, []);

  const dismiss = useCallback(() => {
    if (keyRef.current) removeDraft(keyRef.current);
    setOffer(null);
  }, []);

  const clear = useCallback(() => {
    cleared.current = true;
    if (keyRef.current) removeDraft(keyRef.current);
  }, []);

  return {
    offer: offer ? { savedAt: offer.savedAt, savedSince: offer.savedSince } : null,
    restore,
    dismiss,
    clear,
    flush: write,
  };
}
