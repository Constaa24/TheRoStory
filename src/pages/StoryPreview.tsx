import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Article } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { EditorialArticle } from "@/components/organisms/EditorialArticle";
import { PageHead } from "@/components/layout/PageHead";
import { editorPathForKey, PREVIEW_CHANNEL, type PreviewMessage } from "@/lib/story-draft";

type Phase = "waiting" | "live" | "closed" | "none";

/**
 * The editors' Preview (/admin/preview?story=<kind>:<id|new>): the story
 * page as readers will see it, unsaved changes included. It keeps nothing of
 * its own: it asks the open editor for the story over a BroadcastChannel,
 * and the editor answers, and again after each change (use-story-draft).
 * With no editor open for that story, it says so.
 */
const StoryPreview: React.FC = () => {
  const [params] = useSearchParams();
  const key = params.get("story") || "";
  const { language } = useLanguage();
  const navigate = useNavigate();
  const en = language === "en";
  const [shown, setShown] = useState<{ article: Article; dirty: boolean } | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");

  useEffect(() => {
    if (!key || typeof BroadcastChannel === "undefined") {
      setPhase("none");
      return;
    }
    const ch = new BroadcastChannel(PREVIEW_CHANNEL);
    const ask = () => { try { ch.postMessage({ type: "want", key } satisfies PreviewMessage); } catch { /* closed */ } };
    ch.onmessage = (e: MessageEvent<PreviewMessage>) => {
      const m = e.data;
      if (!m || m.key !== key) return;
      if (m.type === "story") {
        setShown({ article: m.article, dirty: m.dirty });
        setPhase("live");
      } else if (m.type === "closed") {
        setPhase((p) => (p === "live" ? "closed" : p));
      } else if (m.type === "open") {
        ask();
      }
    };
    ask();
    const timer = window.setTimeout(() => setPhase((p) => (p === "waiting" ? "none" : p)), 2500);
    return () => {
      window.clearTimeout(timer);
      ch.close();
    };
  }, [key]);

  // This tab was opened from the editor, so closing it goes back there; if
  // the browser won't let a page close its tab, open the editor here instead.
  const back = () => {
    window.close();
    window.setTimeout(() => navigate(editorPathForKey(key)), 150);
  };

  const a = shown?.article;
  const when = (iso: string) => new Date(iso).toLocaleString(en ? "en-GB" : "ro-RO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const status = !a ? "" : a.isPublished
    ? (en ? "Published" : "Publicată")
    : a.publishAt
      ? (en ? `Scheduled for ${when(a.publishAt)}` : `Programată pentru ${when(a.publishAt)}`)
      : (en ? "A draft: only the editors can see it" : "Ciornă: o văd doar editorii");
  const version = shown?.dirty
    ? (en ? "with your unsaved changes" : "cu modificările tale nesalvate")
    : (en ? "as saved" : "așa cum e salvată");

  return (
    <>
      <PageHead
        title={en ? "Preview" : "Previzualizare"}
        description={en ? "Editorial dashboard — story preview." : "Panou editorial — previzualizarea poveștii."}
        language={language}
      >
        <meta name="robots" content="noindex, nofollow" />
      </PageHead>

      <div className="rs-preview-bar no-print" role="region" aria-label={en ? "Preview" : "Previzualizare"}>
        <div className="ed-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2" style={{ paddingTop: 10, paddingBottom: 10 }}>
          <p className="m-0" aria-live="polite">
            <strong style={{ color: "var(--gold-2)" }}>{en ? "Preview" : "Previzualizare"}</strong>
            {a && <> · {status} · {version}</>}
            {phase === "closed" && (en ? " · The editor is closed: this is the last version it showed." : " · Editorul e închis: aceasta e ultima versiune pe care a arătat-o.")}
          </p>
          {key && (
            <button type="button" className="rs-btn rs-btn-ghost" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5 }} onClick={back}>
              {en ? "Back to the editor" : "Înapoi la editor"}
            </button>
          )}
        </div>
      </div>

      {a ? (
        <EditorialArticle article={a} preview />
      ) : (
        <div className="ed-container text-center" style={{ padding: "96px 0" }}>
          <p className="m-0 font-display italic" style={{ fontSize: 26, color: phase === "none" ? "var(--text)" : "var(--gold)" }}>
            {phase === "none"
              ? (en ? "Nothing to preview." : "Nimic de previzualizat.")
              : (en ? "Opening the preview…" : "Se deschide previzualizarea…")}
          </p>
          {phase === "none" && (
            <p className="mx-auto mt-3 max-w-[520px]" style={{ color: "var(--text-dim)" }}>
              {en
                ? "Open Preview from a story's editor and keep the editor open: the preview follows your changes as you make them."
                : "Deschide Previzualizarea din editorul unei povești și ține editorul deschis: previzualizarea îți urmează modificările pe măsură ce le faci."}
            </p>
          )}
        </div>
      )}
    </>
  );
};

export default StoryPreview;
