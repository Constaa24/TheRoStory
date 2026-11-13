import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { fetchCategories, getLocalized, type Article, type Category } from "@/lib/supabase";
import { articleCoverUrl, formatArticleDate, joinMeta } from "@/lib/article-utils";
import { storageImage } from "@/lib/image-url";
import { FORMATS, kindName, kindOf, type AtlasKind } from "@/lib/atlas/model";
import { isAbortError } from "@/lib/utils";
import {
  deleteArticleWithMedia, fetchAllViewCounts, fetchDeskArticles, setArticlesPublished, statusOf, type StoryStatus,
} from "@/lib/desk";
import { editorPath } from "@/components/organisms/DeskOverview";
import type { DeskConfirm } from "./types";

type Lang = "en" | "ro";
type Filter = "all" | StoryStatus;

const STATUS_LABEL: Record<Lang, Record<Filter, string>> = {
  en: { all: "All", published: "Published", scheduled: "Scheduled", draft: "Draft" },
  ro: { all: "Toate", published: "Publicate", scheduled: "Programate", draft: "Ciorne" },
};
const STATUS_ONE: Record<Lang, Record<StoryStatus, string>> = {
  en: { published: "Published", scheduled: "Scheduled", draft: "Draft" },
  ro: { published: "Publicată", scheduled: "Programată", draft: "Ciornă" },
};

/** Lowercase and without diacritics, so "brasov" finds "Brașov". */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The desk's Stories (the redesign's AdminApp): every story, searched by
 * title, place or county, filtered by status and kind, with its reads, and
 * selected in bulk to publish, move back to drafts or delete. Publishing is
 * an admin's; a writer sees their own stories and can delete them.
 */
export const DeskStories: React.FC<{ language: Lang; isAdmin: boolean; ownerId?: string; confirm: DeskConfirm }> = ({ language, isAdmin, ownerId, confirm }) => {
  const en = language === "en";
  const [rows, setRows] = useState<Article[] | null>(null);
  const [views, setViews] = useState<Record<string, number>>({});
  const [shelves, setShelves] = useState<Map<string, Category>>(new Map());
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Filter>("all");
  const [kind, setKind] = useState<AtlasKind | "">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [articles, counts, cats] = await Promise.all([
        fetchDeskArticles(ownerId),
        fetchAllViewCounts().catch(() => ({} as Record<string, number>)),
        fetchCategories().catch(() => [] as Category[]),
      ]);
      setRows(articles);
      setViews(counts);
      setShelves(new Map(cats.map((c) => [c.id, c])));
      setFailed(false);
    } catch (error) {
      if (!isAbortError(error)) console.error("Error loading the stories:", error);
      setFailed(true);
    }
  }, [ownerId]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, published: 0, scheduled: 0, draft: 0 };
    for (const r of rows ?? []) { c.all += 1; c[statusOf(r)] += 1; }
    return c;
  }, [rows]);

  const list = useMemo(() => {
    const needle = fold(q.trim());
    return (rows ?? []).filter((r) =>
      (status === "all" || statusOf(r) === status)
      && (!kind || kindOf(r) === kind)
      && (!needle || fold([r.titleEn, r.titleRo, r.placeNameEn, r.placeNameRo, r.location].filter(Boolean).join(" ")).includes(needle)));
  }, [rows, q, status, kind]);

  // A filter that hides a selected story also drops it from the selection,
  // so a bulk action never reaches a row the admin can't see.
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(list.map((r) => r.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [list]);

  const allOn = list.length > 0 && list.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const publish = async (ids: string[], published: boolean) => {
    setBusy(true);
    try {
      await setArticlesPublished(ids, published);
      toast.success(published
        ? (en ? (ids.length === 1 ? "Published." : `${ids.length} stories published.`) : (ids.length === 1 ? "Publicată." : `${ids.length} povești publicate.`))
        : (en ? (ids.length === 1 ? "Moved to drafts." : `${ids.length} stories moved to drafts.`) : (ids.length === 1 ? "Mutată la ciorne." : `${ids.length} povești mutate la ciorne.`)));
      setSelected(new Set());
      await load();
    } catch {
      toast.error(en ? "The change could not be saved." : "Schimbarea nu a putut fi salvată.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (ids: string[]) => confirm({
    title: en ? (ids.length === 1 ? "Delete this story?" : `Delete ${ids.length} stories?`) : (ids.length === 1 ? "Ștergi această poveste?" : `Ștergi ${ids.length} povești?`),
    description: en
      ? "Readers' notes and favourites for these stories are removed too, and their pictures and films. This cannot be undone."
      : "Notele și favoritele cititorilor pentru aceste povești sunt șterse și ele, împreună cu imaginile și filmele lor. Nu poate fi anulat.",
    confirmLabel: en ? "Delete" : "Șterge",
    onConfirm: async () => {
      let failedN = 0;
      for (const id of ids) {
        try { await deleteArticleWithMedia(id); } catch { failedN += 1; }
      }
      if (failedN) toast.error(en ? `${failedN} could not be deleted.` : `${failedN} nu au putut fi șterse.`);
      else toast.success(en ? (ids.length === 1 ? "Deleted." : `${ids.length} stories deleted.`) : (ids.length === 1 ? "Ștearsă." : `${ids.length} povești șterse.`));
      setSelected(new Set());
      await load();
    },
  });

  if (failed) return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--danger)" }}>{en ? "The stories could not be loaded." : "Poveștile nu au putut fi încărcate."}</p>;
  if (!rows) return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--text-dim)" }}>{en ? "Gathering the stories…" : "Adunăm poveștile…"}</p>;

  const ids = [...selected];
  const n = new Intl.NumberFormat(en ? "en-GB" : "ro-RO");

  // What a row shows, in the table and in the phone's cards alike.
  const factsOf = (r: Article) => {
    const st = statusOf(r);
    const where = (language === "ro" ? r.placeNameRo || r.placeNameEn : r.placeNameEn || r.placeNameRo) || r.location;
    const date = st === "scheduled" && r.publishAt ? r.publishAt : r.createdAt;
    const shelf = shelves.get(r.categoryId);
    return {
      st,
      cover: articleCoverUrl(r),
      title: getLocalized(r, "title", language) || (en ? "Untitled" : "Fără titlu"),
      meta: joinMeta([where, (st === "scheduled" ? (en ? "goes out " : "apare pe ") : "") + formatArticleDate(date, language, "short")]),
      shelfName: shelf ? getLocalized(shelf, "name", language) : null,
      reads: views[r.id] || 0,
    };
  };
  const thumb = (cover: string | null | undefined) => (
    <span className="rs-desk-thumb">{cover && <img src={storageImage(cover, "thumb")} alt="" loading="lazy" className="rs-desk-thumb-img" />}</span>
  );
  const actions = (r: Article, title: string, st: StoryStatus) => (
    <div className="flex justify-end gap-1.5">
      {st === "published" && (
        <Link to={`/article/${r.id}`} className="rs-icon-act" aria-label={en ? `View ${title}` : `Vezi ${title}`} title={en ? "View" : "Vezi"}><Eye className="w-4 h-4" /></Link>
      )}
      <Link to={editorPath(r)} className="rs-icon-act" aria-label={en ? `Edit ${title}` : `Editează ${title}`} title={en ? "Edit" : "Editează"}><Pencil className="w-4 h-4" /></Link>
      {isAdmin && (
        <button type="button" className="rs-icon-act" disabled={busy} onClick={() => publish([r.id], !r.isPublished)}
          aria-label={r.isPublished ? (en ? `Move ${title} to drafts` : `Mută ${title} la ciorne`) : (en ? `Publish ${title}` : `Publică ${title}`)}
          title={r.isPublished ? (en ? "Move to drafts" : "Mută la ciorne") : (en ? "Publish" : "Publică")}>
          {r.isPublished ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
        </button>
      )}
      <button type="button" className="rs-icon-act is-danger" onClick={() => remove([r.id])} aria-label={en ? `Delete ${title}` : `Șterge ${title}`} title={en ? "Delete" : "Șterge"}><Trash2 className="w-4 h-4" /></button>
    </div>
  );
  const selectAll = (on: boolean) => setSelected(on ? new Set(list.map((r) => r.id)) : new Set());
  const none = (
    <p className="m-0 text-center font-display italic" style={{ padding: 36, fontSize: 20, color: "var(--text-dim)" }}>{en ? "No stories match." : "Nicio poveste nu se potrivește."}</p>
  );

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={en ? "Search titles, places, counties…" : "Caută titluri, locuri, județe…"}
          aria-label={en ? "Search the stories" : "Caută în povești"}
          className="rs-desk-input"
          style={{ flex: "1 1 260px" }}
        />
        <div role="group" aria-label={en ? "Status" : "Stare"} className="flex flex-wrap gap-2">
          {(["all", "published", "scheduled", "draft"] as const).map((k) => (
            <button key={k} type="button" className="rs-chip" aria-pressed={status === k} onClick={() => setStatus(k)}>
              {STATUS_LABEL[language][k]}<span className="rs-chip-n">{counts[k]}</span>
            </button>
          ))}
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as AtlasKind | "")} aria-label={en ? "Kind" : "Tip"} className="rs-desk-input" style={{ flex: "0 0 auto", width: "auto" }}>
          <option value="">{en ? "All kinds" : "Toate tipurile"}</option>
          {FORMATS.map((k) => <option key={k} value={k}>{kindName(k, language)}</option>)}
        </select>
      </div>

      {ids.length > 0 && (
        <div className="rs-bulk" role="region" aria-label={en ? "Selected stories" : "Povești selectate"}>
          <span style={{ fontFamily: "var(--ui)", fontSize: 13, fontWeight: 700, color: "var(--parchment)" }}>{en ? `${ids.length} selected` : `${ids.length} selectate`}</span>
          {isAdmin && (
            <>
              <button type="button" className="rs-btn" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5 }} disabled={busy} onClick={() => publish(ids, true)}>{en ? "Publish" : "Publică"}</button>
              <button type="button" className="rs-btn rs-btn-ghost" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5 }} disabled={busy} onClick={() => publish(ids, false)}>{en ? "Move to drafts" : "Mută la ciorne"}</button>
            </>
          )}
          <button type="button" className="rs-btn rs-btn-ghost rs-btn-danger" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5 }} disabled={busy} onClick={() => remove(ids)}>{en ? "Delete" : "Șterge"}</button>
          <button type="button" className="rs-link-quiet ml-auto" onClick={() => setSelected(new Set())}>{en ? "Clear selection" : "Anulează selecția"}</button>
        </div>
      )}

      {/* Phones: a card per story, everything in view without a sideways
          scroll. The table below takes over from 768px. */}
      <div className="md:hidden grid grid-cols-1 gap-2.5">
        {list.length > 0 && (
          <label className="flex items-center gap-2.5 m-0" style={{ fontFamily: "var(--ui)", fontSize: 13, fontWeight: 700, color: "var(--text-dim)" }}>
            <input type="checkbox" checked={allOn} onChange={(e) => selectAll(e.target.checked)} className="rs-check" />
            {en ? `Select all ${list.length}` : `Selectează toate ${list.length}`}
          </label>
        )}
        {list.map((r) => {
          const f = factsOf(r);
          return (
            <article key={r.id} className={selected.has(r.id) ? "rs-desk-card is-selected" : "rs-desk-card"} style={{ padding: 14 }}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={f.title} className="rs-check shrink-0" style={{ marginTop: 14 }} />
                <Link to={editorPath(r)} className="flex items-start gap-3 min-w-0 flex-1">
                  {thumb(f.cover)}
                  <span className="min-w-0">
                    <span className="block font-display" style={{ fontSize: 18, lineHeight: 1.2, color: "var(--parchment)", overflowWrap: "anywhere" }}>{f.title}</span>
                    <span className="block mt-0.5" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>{f.meta}</span>
                  </span>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 mt-3">
                <span className={`rs-status is-${f.st}`}>{STATUS_ONE[language][f.st]}</span>
                <span className="rs-desk-dim">
                  {joinMeta([
                    kindName(kindOf(r), language),
                    f.st === "published" ? (en ? `${n.format(f.reads)} ${f.reads === 1 ? "read" : "reads"}` : `${n.format(f.reads)} ${f.reads === 1 ? "citire" : "citiri"}`) : null,
                  ])}
                </span>
                <div className="ml-auto">{actions(r, f.title, f.st)}</div>
              </div>
            </article>
          );
        })}
        {list.length === 0 && none}
      </div>

      <div className="rs-desk-card hidden md:block" style={{ padding: 0, overflow: "hidden" }}>
        <div className="relative overflow-x-auto">
          <table className="rs-desk-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => selectAll(e.target.checked)}
                    aria-label={en ? "Select all" : "Selectează tot"}
                    className="rs-check"
                  />
                </th>
                <th>{en ? "Story" : "Poveste"}</th>
                <th>{en ? "Kind" : "Tip"}</th>
                <th>{en ? "Shelf" : "Raft"}</th>
                <th>{en ? "Status" : "Stare"}</th>
                <th style={{ textAlign: "right" }}>{en ? "Reads" : "Citiri"}</th>
                <th><span className="sr-only">{en ? "Actions" : "Acțiuni"}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const f = factsOf(r);
                return (
                  <tr key={r.id} className={selected.has(r.id) ? "is-selected" : undefined}>
                    <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={f.title} className="rs-check" /></td>
                    <td>
                      <Link to={editorPath(r)} className="flex items-center gap-3 min-w-0">
                        {thumb(f.cover)}
                        <span className="min-w-0">
                          <span className="block font-display truncate" style={{ fontSize: 18, lineHeight: 1.2, color: "var(--parchment)", maxWidth: 340 }}>{f.title}</span>
                          <span className="block" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>{f.meta}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="rs-desk-dim">{kindName(kindOf(r), language)}</td>
                    <td className="rs-desk-dim">{f.shelfName ?? "—"}</td>
                    <td><span className={`rs-status is-${f.st}`}>{STATUS_ONE[language][f.st]}</span></td>
                    <td className="rs-desk-dim" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.st === "published" ? n.format(f.reads) : "—"}</td>
                    <td>{actions(r, f.title, f.st)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && none}
      </div>
    </div>
  );
};
