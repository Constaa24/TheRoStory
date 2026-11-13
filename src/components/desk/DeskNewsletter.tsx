import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getLocalized, type Article } from "@/lib/supabase";
import { articleCoverUrl, formatArticleDate } from "@/lib/article-utils";
import { storageImage } from "@/lib/image-url";
import { fetchDeskArticles, fetchDeskStats, fetchDispatches, sendDispatch, DISPATCH_LIMITS, type Dispatch } from "@/lib/desk";
import type { DeskConfirm } from "./types";

type Lang = "en" | "ro";
const DRAFT_KEY = "rostory_dispatch_draft";

type Draft = { subject: string; body: string; storyIds: string[] };
const loadDraft = (): Draft => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Partial<Draft> | null;
    return { subject: d?.subject || "", body: d?.body || "", storyIds: Array.isArray(d?.storyIds) ? d!.storyIds!.map(String) : [] };
  } catch {
    return { subject: "", body: "", storyIds: [] };
  }
};

/**
 * The desk's Newsletter (the redesign's AdminApp): write the month's
 * dispatch, choose the stories it points to, see it as readers will, send
 * yourself a test, then send it to every confirmed subscriber. The draft is
 * kept in this browser until it is sent (the privacy policy says so).
 * "Sent" lists how many readers each letter went to; the desk does not
 * ask who opened it.
 */
export const DeskNewsletter: React.FC<{ language: Lang; confirm: DeskConfirm }> = ({ language, confirm }) => {
  const en = language === "en";
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [stories, setStories] = useState<Article[]>([]);
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [history, setHistory] = useState<Dispatch[]>([]);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDeskArticles().then((rows) => { if (!cancelled) setStories(rows.filter((r) => r.isPublished).slice(0, 16)); }).catch(() => {});
    fetchDeskStats().then((s) => { if (!cancelled) setSubscribers(s?.subscribers ?? null); }).catch(() => {});
    fetchDispatches().then((d) => { if (!cancelled) setHistory(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage blocked: the draft lives for this visit */ }
  }, [draft]);

  const ready = draft.subject.trim().length > 0 && draft.body.trim().length > 0;
  const picked = draft.storyIds.map((id) => stories.find((s) => s.id === id)).filter((s): s is Article => !!s);
  const toggle = (id: string) => setDraft((d) => ({
    ...d,
    storyIds: d.storyIds.includes(id) ? d.storyIds.filter((x) => x !== id) : d.storyIds.length < DISPATCH_LIMITS.STORIES_MAX ? [...d.storyIds, id] : d.storyIds,
  }));
  const letter = { subject: draft.subject.trim(), body: draft.body, storyIds: picked.map((s) => s.id) };
  const fallback = en ? "It could not be sent. Try again in a minute." : "Nu a putut fi trimis. Încearcă din nou peste un minut.";

  const test = async () => {
    setBusy("test");
    const r = await sendDispatch("test", letter);
    setBusy(null);
    if (r.ok) toast.success(en ? `Test sent to ${r.to}.` : `Test trimis la ${r.to}.`);
    else toast.error(r.error || fallback);
  };

  const send = () => confirm({
    title: en ? "Send the dispatch?" : "Trimiți buletinul?",
    description: en
      ? `It goes to ${subscribers ?? "all"} confirmed ${subscribers === 1 ? "subscriber" : "subscribers"} right away, and cannot be called back.`
      : `Pleacă imediat la ${subscribers ?? "toți"} ${subscribers === 1 ? "abonat confirmat" : "abonații confirmați"} și nu mai poate fi oprit.`,
    confirmLabel: en ? "Send now" : "Trimite acum",
    tone: "gold",
    onConfirm: async () => {
      setBusy("send");
      const r = await sendDispatch("send", letter);
      setBusy(null);
      if (!r.ok) { toast.error(r.error || fallback); return; }
      toast.success(en ? `Dispatch sent to ${r.recipients} ${r.recipients === 1 ? "reader" : "readers"}.` : `Buletin trimis la ${r.recipients} ${r.recipients === 1 ? "cititor" : "cititori"}.`);
      // Confirmed here, but with no contact on Resend's side: they didn't get it.
      if (r.missing) {
        toast.warning(en
          ? `${r.missing} confirmed ${r.missing === 1 ? "subscriber is" : "subscribers are"} missing from Resend and did not get it.`
          : `${r.missing} ${r.missing === 1 ? "abonat confirmat lipsește" : "abonați confirmați lipsesc"} din Resend și nu ${r.missing === 1 ? "l-a primit" : "l-au primit"}.`);
      }
      setDraft({ subject: "", body: "", storyIds: [] });
      fetchDispatches().then(setHistory).catch(() => {});
    },
  });

  return (
    <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
      <section className="rs-desk-card grid grid-cols-1 gap-4">
        <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0 }}>{en ? "Compose the dispatch" : "Scrie buletinul"}</h2>
        <label className="rs-field-label grid grid-cols-1 gap-1.5">
          {en ? "Subject" : "Subiect"}
          <input type="text" maxLength={DISPATCH_LIMITS.SUBJECT_MAX} value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} className="rs-desk-input" style={{ fontFamily: "var(--serif)", fontSize: 17 }} />
        </label>
        <label className="rs-field-label grid grid-cols-1 gap-1.5">
          {en ? "Letter" : "Scrisoare"}
          <textarea rows={10} maxLength={DISPATCH_LIMITS.BODY_MAX} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            placeholder={en ? "Dear reader,\n\nA blank line starts a new paragraph." : "Dragă cititorule,\n\nUn rând gol începe un paragraf nou."}
            className="rs-desk-input" style={{ minHeight: 220, padding: 12, fontFamily: "var(--serif)", fontSize: 16, lineHeight: 1.6, resize: "vertical" }} />
        </label>
        <div>
          <p className="rs-field-label m-0 mb-2">{en ? "Stories to include" : "Povești incluse"}</p>
          <div className="flex flex-wrap gap-2">
            {stories.map((s) => {
              const title = getLocalized(s, "title", language);
              // A long title is cut short on a narrow screen rather than
              // pushing the page wider than it; the tooltip has it whole.
              return (
                <button key={s.id} type="button" className="rs-chip" style={{ minHeight: 34, fontSize: 12.5, maxWidth: "100%" }} title={title} aria-pressed={draft.storyIds.includes(s.id)} onClick={() => toggle(s.id)}>
                  <span className="truncate min-w-0">{title}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2.5">
          <button type="button" className="rs-btn rs-btn-ghost" style={{ minHeight: 42 }} disabled={!ready || !!busy} onClick={test}>
            {busy === "test" ? (en ? "Sending…" : "Se trimite…") : (en ? "Send a test to me" : "Trimite-mi un test")}
          </button>
          <button type="button" className="rs-btn" style={{ minHeight: 42 }} disabled={!ready || !!busy || subscribers === 0} onClick={send}>
            {busy === "send"
              ? (en ? "Sending…" : "Se trimite…")
              : subscribers == null ? (en ? "Send to subscribers" : "Trimite abonaților")
                : (en ? `Send to ${subscribers} ${subscribers === 1 ? "reader" : "readers"}` : `Trimite la ${subscribers} ${subscribers === 1 ? "cititor" : "cititori"}`)}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5">
        <section style={{ padding: 24, border: "1.5px dashed var(--gold-deep)", borderRadius: 22, background: "var(--paper)" }} aria-label={en ? "Preview" : "Previzualizare"}>
          <p className="rs-eyebrow" style={{ marginBottom: 6 }}>{en ? "Preview" : "Previzualizare"}</p>
          <h3 className="rs-display" style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: 0, marginBottom: 10 }}>{draft.subject || (en ? "Your subject" : "Subiectul tău")}</h3>
          <p className="m-0 mb-3.5" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{draft.body || (en ? "Your letter appears here as you write it." : "Scrisoarea ta apare aici pe măsură ce o scrii.")}</p>
          {picked.map((s) => {
            const cover = articleCoverUrl(s);
            return (
              <div key={s.id} className="flex items-center gap-3" style={{ padding: "8px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span className="rs-desk-thumb">{cover && <img src={storageImage(cover, "thumb")} alt="" loading="lazy" className="rs-desk-thumb-img" />}</span>
                <span className="font-display" style={{ fontSize: 18, lineHeight: 1.2, color: "var(--parchment)" }}>{getLocalized(s, "title", language)}</span>
              </div>
            );
          })}
        </section>
        <section className="rs-desk-card">
          <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0, marginBottom: 10 }}>{en ? "Sent" : "Trimise"}</h2>
          {history.length === 0 ? (
            <p className="m-0" style={{ color: "var(--text-dim)" }}>{en ? "Nothing sent from the desk yet." : "Încă nimic trimis de la birou."}</p>
          ) : history.map((h) => (
            <div key={h.id} className="flex justify-between gap-3" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)", fontFamily: "var(--ui)", fontSize: 13 }}>
              <span style={{ color: "var(--text)" }}>{h.subject}</span>
              <span className="shrink-0" style={{ color: "var(--text-mute)" }}>
                {formatArticleDate(h.sentAt, language, "short")} · {en ? `${h.recipients} ${h.recipients === 1 ? "reader" : "readers"}` : `${h.recipients} ${h.recipients === 1 ? "cititor" : "cititori"}`}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
