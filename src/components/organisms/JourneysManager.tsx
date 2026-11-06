import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Edit, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteJourney, fetchAdminJourneys, fetchAtlasArticles, saveJourney, JOURNEY_ID_PATTERN, JOURNEY_LIMITS,
  type Article, type Journey,
} from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { LoadError } from "@/components/ui/load-error";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isAbortError } from "@/lib/utils";

const EMPTY: Journey = { id: "", titleEn: "", titleRo: "", introEn: "", introRo: "", sortOrder: 0, isPublished: false, stops: [] };

/** "Power and stone, 1977–1989" → "power-and-stone-1977-1989" */
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, JOURNEY_LIMITS.ID_MAX);

const label = "font-ui text-[13px] font-bold text-[color:var(--text-dim)]";

/**
 * The dashboard's Journeys tab: curated walks through published stories,
 * shown on the Atlas. Admin-only (RLS enforces it; the tab is hidden from
 * writers too).
 */
export const JourneysManager: React.FC = () => {
  const { language } = useLanguage();
  const en = language === "en";
  const [journeys, setJourneys] = useState<Journey[] | null | undefined>(undefined);
  const [stories, setStories] = useState<Article[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<Journey | null>(null);
  const [originalId, setOriginalId] = useState<string | undefined>(undefined);
  const [idTouched, setIdTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Journey | null>(null);
  const [addStop, setAddStop] = useState("");

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const [js, { articles }] = await Promise.all([fetchAdminJourneys(), fetchAtlasArticles()]);
      setJourneys(js);
      setStories(articles.slice().sort((a, b) => a.titleEn.localeCompare(b.titleEn)));
    } catch (e) {
      if (!isAbortError(e)) {
        console.error("Error loading journeys:", e);
        setLoadFailed(true);
      }
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const storyById = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);
  const title = (id: string) => {
    const s = storyById.get(id);
    return s ? (en ? s.titleEn : s.titleRo) : (en ? "(unpublished or deleted story)" : "(poveste nepublicată sau ștearsă)");
  };

  const startNew = () => {
    setDraft({ ...EMPTY, sortOrder: (journeys?.length ?? 0) + 1 });
    setOriginalId(undefined);
    setIdTouched(false);
    setAddStop("");
  };
  const startEdit = (j: Journey) => {
    setDraft({ ...j, stops: j.stops.slice() });
    setOriginalId(j.id);
    setIdTouched(true);
    setAddStop("");
  };
  const set = (patch: Partial<Journey>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const move = (i: number, by: number) =>
    setDraft((d) => {
      if (!d) return d;
      const stops = d.stops.slice();
      const [s] = stops.splice(i, 1);
      stops.splice(i + by, 0, s);
      return { ...d, stops };
    });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveJourney(draft, originalId);
      toast.success(en ? "Journey saved" : "Traseu salvat");
      setDraft(null);
      await load();
    } catch (e) {
      console.error("Error saving journey:", e);
      const code = (e as { code?: string } | null)?.code;
      toast.error(code === "23505"
        ? (en ? "A journey with that id already exists" : "Există deja un traseu cu acest id")
        : e instanceof Error ? e.message : (en ? "Could not save the journey" : "Traseul nu a putut fi salvat"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteJourney(pendingDelete.id);
      toast.success(en ? "Journey deleted" : "Traseu șters");
      if (draft && originalId === pendingDelete.id) setDraft(null);
      await load();
    } catch (e) {
      console.error("Error deleting journey:", e);
      toast.error(en ? "Could not delete the journey" : "Traseul nu a putut fi șters");
    } finally {
      setPendingDelete(null);
    }
  };

  if (loadFailed) return <LoadError onRetry={load} />;
  if (journeys === undefined) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--gold)" }} /></div>;
  }
  if (journeys === null) {
    return (
      <Card className="rs-desk-card shadow-none">
        <p className="m-0" style={{ fontSize: 16, lineHeight: 1.6, color: "var(--text-dim)" }}>
          {en
            ? "Journeys need the Atlas database update. Apply migration 20261031120000_atlas_places_dates_and_journeys.sql, then reload this tab."
            : "Traseele au nevoie de actualizarea bazei de date pentru Atlas. Aplică migrarea 20261031120000_atlas_places_dates_and_journeys.sql, apoi reîncarcă această filă."}
        </p>
      </Card>
    );
  }

  const idValid = !!draft && JOURNEY_ID_PATTERN.test(draft.id);
  const available = stories.filter((s) => !draft?.stops.includes(s.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 sm:gap-8 items-start">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{en ? "Journeys" : "Trasee"}</h2>
          <Button onClick={startNew} className="rounded-full" size="sm"><Plus className="h-4 w-4 mr-1" />{en ? "New journey" : "Traseu nou"}</Button>
        </div>
        <p className="m-0" style={{ fontSize: 16, lineHeight: 1.6, color: "var(--text-dim)" }}>
          {en
            ? "Curated walks through published stories, shown on the Atlas in this order. Only published journeys appear there."
            : "Trasee curate prin poveștile publicate, afișate pe Atlas în această ordine. Doar traseele publicate apar acolo."}
        </p>
        {journeys.length === 0 && <p className="font-display italic py-6" style={{ fontSize: 20, color: "var(--text-dim)" }}>{en ? "No journeys yet." : "Încă nu există trasee."}</p>}
        {journeys.map((j) => (
          <Card key={j.id} className="rs-desk-card shadow-none p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[20px] leading-tight truncate" style={{ color: "var(--parchment)" }}>{en ? j.titleEn : j.titleRo}</p>
                <p className="font-ui text-[12px] mt-1.5" style={{ color: "var(--text-mute)" }}>
                  <span className="font-mono">{j.id}</span> · {j.stops.length} {en ? (j.stops.length === 1 ? "stop" : "stops") : (j.stops.length === 1 ? "oprire" : "opriri")} · {j.isPublished ? (en ? "Published" : "Publicat") : (en ? "Draft" : "Ciornă")}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(j)} aria-label={en ? `Edit ${j.titleEn}` : `Editează ${j.titleRo}`}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setPendingDelete(j)} aria-label={en ? `Delete ${j.titleEn}` : `Șterge ${j.titleRo}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {draft && (
        <Card className="rs-desk-card shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="rs-display" style={{ fontSize: 26, letterSpacing: 0 }}>{originalId ? (en ? "Edit journey" : "Editează traseul") : (en ? "New journey" : "Traseu nou")}</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDraft(null)} aria-label={en ? "Close" : "Închide"}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="jr-title-en" className={label}>{en ? "Title (English)" : "Titlu (engleză)"}</label>
              <Input id="jr-title-en" value={draft.titleEn} maxLength={JOURNEY_LIMITS.TITLE_MAX}
                onChange={(e) => set({ titleEn: e.target.value, ...(idTouched ? {} : { id: slugify(e.target.value) }) })} />
            </div>
            <div className="space-y-2">
              <label htmlFor="jr-title-ro" className={label}>{en ? "Title (Romanian)" : "Titlu (română)"}</label>
              <Input id="jr-title-ro" value={draft.titleRo} maxLength={JOURNEY_LIMITS.TITLE_MAX} onChange={(e) => set({ titleRo: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="jr-id" className={label}>{en ? "Link id" : "Id pentru link"}</label>
            <Input id="jr-id" value={draft.id} maxLength={JOURNEY_LIMITS.ID_MAX} className="font-mono"
              onChange={(e) => { setIdTouched(true); set({ id: e.target.value.toLowerCase() }); }} aria-invalid={!!draft.id && !idValid} />
            <p className="text-xs text-muted-foreground">
              {draft.id && !idValid
                ? (en ? "Lowercase letters, digits and single hyphens only." : "Doar litere mici, cifre și cratime simple.")
                : `/map?journey=${draft.id || "…"}`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="jr-intro-en" className={label}>{en ? "Intro (English)" : "Introducere (engleză)"}</label>
              <Textarea id="jr-intro-en" rows={3} value={draft.introEn} maxLength={JOURNEY_LIMITS.INTRO_MAX} onChange={(e) => set({ introEn: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label htmlFor="jr-intro-ro" className={label}>{en ? "Intro (Romanian)" : "Introducere (română)"}</label>
              <Textarea id="jr-intro-ro" rows={3} value={draft.introRo} maxLength={JOURNEY_LIMITS.INTRO_MAX} onChange={(e) => set({ introRo: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <p className={label}>{en ? "Stops, in walking order" : "Opriri, în ordinea parcurgerii"}</p>
            {draft.stops.length === 0 && <p className="text-sm text-muted-foreground">{en ? "Add at least two stories." : "Adaugă cel puțin două povești."}</p>}
            <ol className="space-y-1">
              {draft.stops.map((id, i) => (
                <li key={id} className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ border: "1px solid var(--line-soft)", background: "var(--paper)" }}>
                  <span className="font-ui text-[12px] font-bold w-5" style={{ color: "var(--gold)" }}>{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate font-display text-[17px]">{title(id)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={en ? "Move up" : "Mută mai sus"}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === draft.stops.length - 1} onClick={() => move(i, 1)} aria-label={en ? "Move down" : "Mută mai jos"}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => set({ stops: draft.stops.filter((s) => s !== id) })} aria-label={en ? "Remove stop" : "Elimină oprirea"}><X className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <label htmlFor="jr-add" className="sr-only">{en ? "Story to add" : "Poveste de adăugat"}</label>
              <select
                id="jr-add"
                value={addStop}
                onChange={(e) => setAddStop(e.target.value)}
                className="flex-1 min-w-0 h-10 rounded-xl px-3 font-serif text-[15px]"
              >
                <option value="">{en ? "Choose a published story…" : "Alege o poveste publicată…"}</option>
                {available.map((s) => <option key={s.id} value={s.id}>{en ? s.titleEn : s.titleRo}</option>)}
              </select>
              <Button variant="outline" size="sm" disabled={!addStop || draft.stops.length >= JOURNEY_LIMITS.STOPS_MAX}
                onClick={() => { set({ stops: [...draft.stops, addStop] }); setAddStop(""); }}>
                <Plus className="h-4 w-4 mr-1" />{en ? "Add" : "Adaugă"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <label htmlFor="jr-order" className={label}>{en ? "Position in the list" : "Poziția în listă"}</label>
              <Input id="jr-order" type="number" min={0} max={999} value={draft.sortOrder}
                onChange={(e) => set({ sortOrder: Math.max(0, Math.min(999, Math.trunc(Number(e.target.value) || 0))) })} />
            </div>
            <label className="flex items-center gap-2 font-ui text-[13px] font-semibold cursor-pointer h-11">
              <input type="checkbox" checked={draft.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} className="h-4 w-4 accent-[color:var(--gold)]" />
              {en ? "Published on the Atlas" : "Publicat pe Atlas"}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>{en ? "Cancel" : "Anulează"}</Button>
            <Button onClick={save} className="rounded-full" disabled={saving || !idValid || !draft.titleEn.trim() || !draft.titleRo.trim() || draft.stops.length < 2}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {en ? "Save journey" : "Salvează traseul"}
            </Button>
          </div>
        </Card>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{en ? "Delete this journey?" : "Ștergi acest traseu?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (en
                ? `“${pendingDelete.titleEn}” will disappear from the Atlas. The stories themselves are not affected.`
                : `„${pendingDelete.titleRo}” va dispărea de pe Atlas. Poveștile în sine nu sunt afectate.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{en ? "Cancel" : "Anulează"}</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete}>{en ? "Delete" : "Șterge"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
