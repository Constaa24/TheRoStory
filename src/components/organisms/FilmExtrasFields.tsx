import React, { useRef } from "react";
import { Check, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { FormBlock } from "@/components/ui/form-field";
import { FILM_LIMITS, type Article, type FilmChapter } from "@/lib/supabase";
import { formatClock, parseClock } from "@/lib/subtitles";

type Lang = "en" | "ro";

/** An uploaded subtitle file: its public URL and, when ours, its storage path. */
export type SubtitleDraft = { url: string; path: string | null; lines?: number };
export type FilmChapterDraft = { time: string; en: string; ro: string };
export type FilmExtrasDraft = {
  subtitles: Record<Lang, SubtitleDraft | null>;
  chapters: FilmChapterDraft[];
};

export const EMPTY_FILM_EXTRAS: FilmExtrasDraft = { subtitles: { en: null, ro: null }, chapters: [] };

export const filmExtrasFromArticle = (
  article: Article,
  pathOf: (url: string) => string | null,
): { draft: FilmExtrasDraft; supported: boolean } => {
  const sub = (url?: string | null): SubtitleDraft | null => (url ? { url, path: pathOf(url) } : null);
  return {
    draft: {
      subtitles: { en: sub(article.subtitlesEnUrl), ro: sub(article.subtitlesRoUrl) },
      chapters: (article.filmChapters ?? []).map((c) => ({ time: formatClock(c.t), en: c.en ?? "", ro: c.ro ?? "" })),
    },
    // The columns came back with the row, so the database has them
    // (migration 20261102140000) and a save may write them, even to clear.
    supported: "subtitlesEnUrl" in article,
  };
};

/** What the snapshot for "unsaved changes" compares: no storage paths. */
export const filmExtrasSnapshot = (d: FilmExtrasDraft) => ({
  en: d.subtitles.en?.url ?? null,
  ro: d.subtitles.ro?.url ?? null,
  chapters: d.chapters,
});

const hasChapterText = (c: FilmChapterDraft) => !!(c.en.trim() || c.ro.trim());

export const filmExtrasErrors = (d: FilmExtrasDraft, language: Lang): string[] => {
  const en = language === "en";
  const errors: string[] = [];
  d.chapters.forEach((c, i) => {
    if (!hasChapterText(c) && !c.time.trim()) return; // an empty row is ignored
    if (parseClock(c.time) === null) {
      errors.push(en ? `Chapter ${i + 1}: write its start as minutes:seconds, like 1:05.` : `Capitolul ${i + 1}: scrie începutul ca minute:secunde, de exemplu 1:05.`);
    } else if (!hasChapterText(c)) {
      errors.push(en ? `Chapter ${i + 1} needs a title.` : `Capitolul ${i + 1} are nevoie de un titlu.`);
    }
  });
  return errors;
};

export const shouldSendFilmExtras = (d: FilmExtrasDraft, supported: boolean): boolean =>
  supported || !!d.subtitles.en || !!d.subtitles.ro || d.chapters.some(hasChapterText);

export const draftToFilm = (d: FilmExtrasDraft): { subtitlesEnUrl: string | null; subtitlesRoUrl: string | null; chapters: FilmChapter[] | null } => {
  const chapters = d.chapters
    .filter(hasChapterText)
    .map((c) => ({ t: parseClock(c.time) ?? 0, en: c.en.trim() || undefined, ro: c.ro.trim() || undefined }));
  return {
    subtitlesEnUrl: d.subtitles.en?.url ?? null,
    subtitlesRoUrl: d.subtitles.ro?.url ?? null,
    chapters: chapters.length ? chapters : null,
  };
};

/**
 * A film's subtitles (one file per language) and chapters. Uploading and
 * removing go through the page, which owns the storage clean-up rules.
 */
export const FilmExtrasFields: React.FC<{
  value: FilmExtrasDraft;
  onChange: (next: FilmExtrasDraft) => void;
  onUpload: (lang: Lang, file: File) => void;
  onRemove: (lang: Lang) => void;
  uploading: Lang | null;
  errors: string[];
  language: Lang;
}> = ({ value, onChange, onUpload, onRemove, uploading, errors, language }) => {
  const en = language === "en";
  const inputs = { en: useRef<HTMLInputElement>(null), ro: useRef<HTMLInputElement>(null) };
  const setChapter = (i: number, patch: Partial<FilmChapterDraft>) =>
    onChange({ ...value, chapters: value.chapters.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const languageName = (l: Lang) => (l === "en" ? (en ? "English" : "Engleză") : (en ? "Romanian" : "Română"));

  return (
    <FormBlock title={en ? "Subtitles and chapters (optional)" : "Subtitrări și capitole (opțional)"}>
      <p className="m-0" style={{ fontSize: 15, color: "var(--text-dim)", lineHeight: 1.55 }}>
        {en
          ? "One subtitle file per language, .srt or .vtt. Whisper, CapCut or Subtitle Edit can make one from the film's narration: check it, then translate it. Viewers can turn subtitles on and off, and the transcript under the film is built from them."
          : "Un fișier de subtitrare pentru fiecare limbă, .srt sau .vtt. Whisper, CapCut sau Subtitle Edit îl pot genera din narațiunea filmului: verifică-l, apoi tradu-l. Cititorii pot porni sau opri subtitrarea, iar transcrierea de sub film se face din ea."}
      </p>

      <div className="grid gap-3">
        {(["en", "ro"] as const).map((l) => {
          const sub = value.subtitles[l];
          return (
            <div key={l} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ border: "1px solid var(--line-soft)", borderRadius: 14 }}>
              <div className="flex items-center gap-2.5 min-w-0">
                {sub ? <Check className="w-4 h-4 shrink-0" style={{ color: "var(--gold)" }} aria-hidden="true" /> : null}
                <span className="font-ui text-[14px] font-semibold">{languageName(l)}</span>
                <span className="font-ui text-[13px] truncate" style={{ color: "var(--text-mute)" }}>
                  {sub
                    ? (sub.lines ? (en ? `${sub.lines} lines` : `${sub.lines} replici`) : (en ? "uploaded" : "încărcată"))
                    : (en ? "no subtitles yet" : "fără subtitrare încă")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={inputs[l]}
                  type="file"
                  accept=".srt,.vtt,text/vtt,application/x-subrip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onUpload(l, file);
                  }}
                />
                <button type="button" className="btn-ed btn-ed-ghost" disabled={uploading !== null} onClick={() => inputs[l].current?.click()}>
                  {uploading === l ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {sub ? (en ? "Replace" : "Înlocuiește") : (en ? "Upload" : "Încarcă")}
                </button>
                {sub && (
                  <button
                    type="button"
                    onClick={() => onRemove(l)}
                    className="grid w-9 h-9 place-items-center rounded-full"
                    style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--danger)" }}
                    aria-label={en ? `Remove the ${languageName(l)} subtitles` : `Elimină subtitrarea în ${languageName(l).toLowerCase()}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-end justify-between gap-3 mt-2">
        <div>
          <p className="font-ui text-[13px] font-semibold m-0">{en ? "Chapters" : "Capitole"}</p>
          <p className="m-0" style={{ fontSize: 14, color: "var(--text-mute)", lineHeight: 1.5 }}>
            {en ? "Where each part of the film starts. They mark the progress bar and head the transcript." : "Unde începe fiecare parte a filmului. Apar pe bara de progres și ca titluri în transcriere."}
          </p>
        </div>
        <button
          type="button"
          className="btn-ed btn-ed-ghost shrink-0"
          disabled={value.chapters.length >= FILM_LIMITS.CHAPTERS_MAX}
          onClick={() => onChange({ ...value, chapters: [...value.chapters, { time: value.chapters.length ? "" : "0:00", en: "", ro: "" }] })}
        >
          <Plus className="w-3.5 h-3.5" />
          {en ? "Add chapter" : "Adaugă capitol"}
        </button>
      </div>

      {value.chapters.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={c.time}
            onChange={(e) => setChapter(i, { time: e.target.value })}
            placeholder="0:00"
            inputMode="numeric"
            aria-label={en ? `Chapter ${i + 1}, starts at (minutes:seconds)` : `Capitolul ${i + 1}, începe la (minute:secunde)`}
            style={{ width: 92, flex: "none", fontVariantNumeric: "tabular-nums" }}
          />
          <input
            type="text"
            value={c.en}
            onChange={(e) => setChapter(i, { en: e.target.value })}
            maxLength={FILM_LIMITS.CHAPTER_TITLE_MAX}
            placeholder={en ? "Title in English" : "Titlu în engleză"}
            aria-label={en ? `Chapter ${i + 1}, English title` : `Capitolul ${i + 1}, titlu în engleză`}
            style={{ flex: "1 1 180px", minWidth: 0 }}
          />
          <input
            type="text"
            value={c.ro}
            onChange={(e) => setChapter(i, { ro: e.target.value })}
            maxLength={FILM_LIMITS.CHAPTER_TITLE_MAX}
            placeholder={en ? "Title in Romanian" : "Titlu în română"}
            aria-label={en ? `Chapter ${i + 1}, Romanian title` : `Capitolul ${i + 1}, titlu în română`}
            style={{ flex: "1 1 180px", minWidth: 0 }}
          />
          <button
            type="button"
            onClick={() => onChange({ ...value, chapters: value.chapters.filter((_, j) => j !== i) })}
            className="grid w-9 h-9 place-items-center rounded-full shrink-0"
            style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--text-mute)" }}
            aria-label={en ? `Remove chapter ${i + 1}` : `Elimină capitolul ${i + 1}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {errors.map((message) => (
        <p key={message} className="sb-error m-0">{message}</p>
      ))}
    </FormBlock>
  );
};
