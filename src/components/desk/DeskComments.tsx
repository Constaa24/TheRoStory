import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatArticleDate } from "@/lib/article-utils";
import { clearNoteFlags, deleteNote, fetchDeskNotes, groupNotes, setNoteHidden, type DeskNote } from "@/lib/desk";
import type { DeskConfirm } from "./types";

type Lang = "en" | "ro";
type Tab = "flagged" | "visible" | "hidden";

/**
 * The desk's Comments (the redesign's AdminApp). Notes appear on the site
 * as soon as they are posted (the owner's choice), so the design's
 * "Waiting" tab is "Flagged": notes a reader has asked the editors to look
 * at. A note can be kept (its flags cleared), hidden (then only its writer
 * and the editors see it), shown again, or deleted.
 */
export const DeskComments: React.FC<{ language: Lang; confirm: DeskConfirm; onChanged?: () => void }> = ({ language, confirm, onChanged }) => {
  const en = language === "en";
  const [notes, setNotes] = useState<DeskNote[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setNotes(await fetchDeskNotes());
      setFailed(false);
    } catch (error) {
      console.error("Error loading the notes:", error);
      setFailed(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => groupNotes(notes ?? []), [notes]);
  // Opens on what needs a look, if anything does.
  const current: Tab = tab ?? (groups.flagged.length ? "flagged" : "visible");

  const act = async (id: string, fn: () => Promise<void>, done: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(done);
      await load();
      onChanged?.();
    } catch {
      toast.error(en ? "That could not be done." : "Nu s-a putut face.");
    } finally {
      setBusy(null);
    }
  };

  if (failed) return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--danger)" }}>{en ? "The notes could not be loaded." : "Notele nu au putut fi încărcate."}</p>;
  if (!notes) return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--text-dim)" }}>{en ? "Gathering the notes…" : "Adunăm notele…"}</p>;

  const tabs: [Tab, string][] = [["flagged", en ? "Flagged" : "Semnalate"], ["visible", en ? "On the site" : "Pe site"], ["hidden", en ? "Hidden" : "Ascunse"]];
  const rows = groups[current];
  const small = { minHeight: 34, padding: "0 14px", fontSize: 12.5 } as const;

  return (
    <div className="grid grid-cols-1 gap-5">
      <div role="group" aria-label={en ? "Which notes" : "Care note"} className="sb-seg self-start" style={{ justifySelf: "start" }}>
        {tabs.map(([k, label]) => (
          <button key={k} type="button" className="sb-seg-btn" aria-pressed={current === k} onClick={() => setTab(k)}>{label} · {groups[k].length}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3">
        {rows.map((c) => {
          const story = (en ? c.storyTitleEn : c.storyTitleRo) || c.storyTitleEn;
          return (
            <article key={c.id} className="rs-desk-card grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]" style={{ padding: "18px 20px", borderColor: c.flags > 0 && !c.hiddenAt ? "color-mix(in oklab, var(--danger) 45%, transparent)" : undefined }}>
              <div className="min-w-0">
                <p className="m-0 mb-1" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
                  <strong style={{ color: "var(--parchment)" }}>{c.userDisplayName || (en ? "A reader" : "Un cititor")}</strong>
                  {" · "}{formatArticleDate(c.createdAt, language, "short")}{" · "}{en ? "on" : "la"}{" "}
                  <Link to={`/article/${c.articleId}`} className="rs-underline">{story}</Link>
                  {c.flags > 0 && (
                    <>{" · "}<span style={{ color: "var(--danger)", fontWeight: 700 }}>{en ? (c.flags === 1 ? "Flagged by a reader" : `Flagged by ${c.flags} readers`) : (c.flags === 1 ? "Semnalat de un cititor" : `Semnalat de ${c.flags} cititori`)}</span></>
                  )}
                </p>
                <p className="m-0" style={{ fontSize: 16, lineHeight: 1.55, color: "var(--text)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.content}</p>
              </div>
              <div className="flex sm:flex-col flex-wrap gap-1.5">
                {c.flags > 0 && !c.hiddenAt && (
                  <button type="button" className="rs-btn" style={small} disabled={busy === c.id} onClick={() => act(c.id, () => clearNoteFlags(c.id), en ? "Kept. Flags cleared." : "Păstrată. Semnalările au fost șterse.")}>{en ? "Keep" : "Păstrează"}</button>
                )}
                {c.hiddenAt
                  ? <button type="button" className="rs-btn rs-btn-ghost" style={small} disabled={busy === c.id} onClick={() => act(c.id, () => setNoteHidden(c.id, false), en ? "Back on the site." : "Din nou pe site.")}>{en ? "Show again" : "Arată din nou"}</button>
                  : <button type="button" className="rs-btn rs-btn-ghost" style={small} disabled={busy === c.id} onClick={() => act(c.id, () => setNoteHidden(c.id, true), en ? "Hidden." : "Ascunsă.")}>{en ? "Hide" : "Ascunde"}</button>}
                <button type="button" className="rs-btn rs-btn-ghost rs-btn-danger" style={small} disabled={busy === c.id}
                  onClick={() => confirm({
                    title: en ? "Delete this note?" : "Ștergi această notă?",
                    description: en ? "It is removed for good. To take it off the site but keep it, hide it instead." : "Este ștearsă definitiv. Ca să o scoți de pe site dar să o păstrezi, ascunde-o.",
                    confirmLabel: en ? "Delete" : "Șterge",
                    onConfirm: () => act(c.id, () => deleteNote(c.id), en ? "Deleted." : "Ștearsă."),
                  })}>
                  {en ? "Delete" : "Șterge"}
                </button>
              </div>
            </article>
          );
        })}
        {rows.length === 0 && (
          <p className="m-0 text-center font-display italic" style={{ padding: 36, border: "1px dashed var(--line)", borderRadius: 20, fontSize: 20, color: "var(--text-dim)" }}>
            {en ? "Nothing here. The desk is clear." : "Nimic aici. Biroul e liber."}
          </p>
        )}
      </div>
    </div>
  );
};
