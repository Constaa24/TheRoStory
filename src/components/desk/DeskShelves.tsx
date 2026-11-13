import React, { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchArticleCategoryCounts, fetchCategories, invalidatePublicContentCache, type Category } from "@/lib/supabase";
import { countLabel } from "@/lib/article-utils";
import { categoryDescription, shelfBlurb } from "@/lib/category-copy";
import { saveShelfOrder, updateShelf, SHELF_DESCRIPTION_MAX } from "@/lib/desk";

type Lang = "en" | "ro";

/**
 * The desk's Shelves (the redesign's AdminApp): the order here is the order
 * on the site, and each shelf's description shows on its page. Adding and
 * deleting shelves stays in the form below this, as before.
 */
export const DeskShelves: React.FC<{ language: Lang; refreshKey?: number; onChanged?: () => void; onDelete?: (id: string) => void }> = ({ language, refreshKey, onChanged, onDelete }) => {
  const en = language === "en";
  const [shelves, setShelves] = useState<Category[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ en: "", ro: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    invalidatePublicContentCache();
    try {
      const [cats, n] = await Promise.all([fetchCategories(), fetchArticleCategoryCounts().catch(() => ({} as Record<string, number>))]);
      setShelves(cats);
      setCounts(n);
    } catch {
      setShelves([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const move = async (i: number, d: -1 | 1) => {
    if (!shelves || busy) return;
    const j = i + d;
    if (j < 0 || j >= shelves.length) return;
    const next = shelves.slice();
    [next[i], next[j]] = [next[j], next[i]];
    const before = shelves;
    setShelves(next);
    setBusy(true);
    try {
      await saveShelfOrder(next.map((c) => c.id));
      onChanged?.();
    } catch {
      setShelves(before);
      toast.error(en ? "The order could not be saved." : "Ordinea nu a putut fi salvată.");
    } finally {
      setBusy(false);
    }
  };

  const save = async (id: string) => {
    setBusy(true);
    try {
      await updateShelf(id, { descriptionEn: draft.en, descriptionRo: draft.ro });
      setEditing(null);
      toast.success(en ? "Saved." : "Salvat.");
      await load();
      onChanged?.();
    } catch {
      toast.error(en ? "The description could not be saved." : "Descrierea nu a putut fi salvată.");
    } finally {
      setBusy(false);
    }
  };

  if (!shelves) return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--text-dim)" }}>{en ? "Gathering the shelves…" : "Adunăm rafturile…"}</p>;

  return (
    <div className="grid grid-cols-1 gap-4">
      <p className="m-0" style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--text-mute)" }}>
        {en ? "Order here is the order on the site. Descriptions show on each shelf page." : "Ordinea de aici e ordinea de pe site. Descrierile apar pe pagina fiecărui raft."}
      </p>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
        {shelves.map((c, i) => {
          const name = en ? c.nameEn : c.nameRo;
          const on = editing === c.id;
          return (
            <div key={c.id} className="rs-desk-card" style={{ padding: 18, borderColor: on ? "var(--gold-deep)" : undefined }}>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="font-display" style={{ fontSize: 24, lineHeight: 1.1, color: "var(--parchment)" }}>{name}</span>
                <span style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>{countLabel(counts[c.id] || 0, "story", language)}</span>
              </div>
              {on ? (
                <div className="grid grid-cols-1 gap-3">
                  {(["en", "ro"] as const).map((l) => (
                    <label key={l} className="rs-field-label grid grid-cols-1 gap-1.5">
                      {l === "en" ? (en ? "Description (English)" : "Descriere (engleză)") : (en ? "Description (Romanian)" : "Descriere (română)")}
                      <textarea
                        rows={3}
                        lang={l}
                        maxLength={SHELF_DESCRIPTION_MAX}
                        placeholder={categoryDescription(c.slug, l === "en" ? c.nameEn : c.nameRo, l)}
                        value={draft[l]}
                        onChange={(e) => setDraft((d) => ({ ...d, [l]: e.target.value }))}
                        className="rs-desk-input"
                        style={{ minHeight: 84, padding: "10px 12px", fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.5, resize: "vertical" }}
                      />
                    </label>
                  ))}
                  <p className="m-0" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
                    {en ? "Left empty, a language keeps the line shown in grey." : "Lăsată goală, o limbă păstrează rândul afișat cu gri."}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="rs-btn" style={{ minHeight: 36, padding: "0 16px", fontSize: 12.5 }} disabled={busy} onClick={() => save(c.id)}>{en ? "Save" : "Salvează"}</button>
                    <button type="button" className="rs-link-quiet" onClick={() => setEditing(null)}>{en ? "Cancel" : "Renunță"}</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="m-0 mb-3" style={{ fontSize: 15, lineHeight: 1.5, color: "var(--text-dim)" }}>{shelfBlurb(c, language)}</p>
                  <div className="flex items-center gap-2">
                    <button type="button" className="rs-btn rs-btn-ghost" style={{ minHeight: 34, padding: "0 14px", fontSize: 12.5 }}
                      onClick={() => { setDraft({ en: c.descriptionEn || "", ro: c.descriptionRo || "" }); setEditing(c.id); }}>
                      {en ? "Edit" : "Editează"}<span className="sr-only"> {name}</span>
                    </button>
                    <button type="button" className="rs-icon-act" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={en ? `Move ${name} up` : `Mută ${name} mai sus`}>↑</button>
                    <button type="button" className="rs-icon-act" disabled={busy || i === shelves.length - 1} onClick={() => move(i, 1)} aria-label={en ? `Move ${name} down` : `Mută ${name} mai jos`}>↓</button>
                    <span className="ml-auto font-mono" style={{ fontSize: 12, color: "var(--text-mute)" }}>{c.slug}</span>
                    {onDelete && (
                      <button type="button" className="rs-icon-act is-danger" onClick={() => onDelete(c.id)} aria-label={en ? `Delete ${name}` : `Șterge ${name}`} title={en ? "Delete" : "Șterge"}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
