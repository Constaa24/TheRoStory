import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Article, FilmChapter } from "@/lib/supabase";
import { cueAt, formatClock, parseVtt, type Cue } from "@/lib/subtitles";

type Lang = "en" | "ro";

/** A loaded subtitle file: its cues, and a blob: URL for the <track>. */
export type LoadedSubtitles = { cues: Cue[]; src: string };

/**
 * Fetches a film's subtitle files and parses them. The page draws captions
 * itself from the cues (styled, and lifted above the controls); the blob:
 * URL feeds a <track> that only shows when the video goes full screen,
 * where a page overlay can't follow. A blob: URL rather than the storage
 * URL keeps the <video> free of crossorigin, which would change how the
 * film itself is fetched.
 */
export const useFilmSubtitles = (article: Article): Partial<Record<Lang, LoadedSubtitles>> => {
  const en = article.subtitlesEnUrl || null;
  const ro = article.subtitlesRoUrl || null;
  const [loaded, setLoaded] = useState<Partial<Record<Lang, LoadedSubtitles>>>({});
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    setLoaded({});
    (Object.entries({ en, ro }) as [Lang, string | null][]).forEach(async ([lang, url]) => {
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const cues = parseVtt(text);
        if (!cues.length || cancelled) return;
        const src = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
        created.push(src);
        setLoaded((prev) => ({ ...prev, [lang]: { cues, src } }));
      } catch (error) {
        // The film still plays; it just has no subtitles in this language.
        console.warn(`Subtitles (${lang}) could not be loaded:`, error);
      }
    });
    return () => {
      cancelled = true;
      created.forEach((src) => URL.revokeObjectURL(src));
    };
  }, [en, ro]);
  return loaded;
};

/**
 * Index of the cue on screen. Read on every animation frame while playing
 * (timeupdate alone fires only ~4 times a second, so captions would lag a
 * quarter of a second), but React only re-renders when the cue changes.
 */
export const useActiveCue = (videoRef: React.RefObject<HTMLVideoElement | null>, cues: Cue[]): number => {
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !cues.length) {
      setIndex(-1);
      return;
    }
    let frame = 0;
    const read = () => {
      const i = cueAt(cues, v.currentTime);
      setIndex((prev) => (prev === i ? prev : i));
    };
    const loop = () => {
      read();
      if (!v.paused && !v.ended) frame = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    read();
    v.addEventListener("play", start);
    v.addEventListener("seeked", read);
    v.addEventListener("timeupdate", read);
    return () => {
      cancelAnimationFrame(frame);
      v.removeEventListener("play", start);
      v.removeEventListener("seeked", read);
      v.removeEventListener("timeupdate", read);
    };
  }, [videoRef, cues]);
  return index;
};

/** The chapter playing at `time`: the last one that has started. */
export const chapterIndexAt = (chapters: FilmChapter[], time: number): number => {
  let found = -1;
  chapters.forEach((c, i) => {
    if (c.t <= time) found = i;
  });
  return found;
};

export const chapterTitle = (c: FilmChapter | undefined, language: Lang): string =>
  (c && (language === "en" ? c.en || c.ro : c.ro || c.en)) || "";

/** Captions drawn by the page, above the controls when they're showing. */
export const CaptionOverlay: React.FC<{ cue: Cue | undefined; lifted: boolean; lang: Lang }> = ({ cue, lifted, lang }) =>
  cue ? (
    <div className="sb-caption" style={{ bottom: lifted ? 78 : 22 }} lang={lang} aria-hidden="true">
      <span>{cue.text}</span>
    </div>
  ) : null;

type Group = { chapter?: FilmChapter; paragraphs: { cue: Cue; index: number }[][] };

/** Cues under their chapters, split into paragraphs at pauses and new speakers. */
const groupCues = (cues: Cue[], chapters: FilmChapter[]): Group[] => {
  const groups: Group[] = chapters.length && chapters[0].t > 0 ? [{ paragraphs: [] }] : [];
  chapters.forEach((chapter) => groups.push({ chapter, paragraphs: [] }));
  if (!groups.length) groups.push({ paragraphs: [] });
  const offset = chapters.length && chapters[0].t > 0 ? 1 : 0;
  cues.forEach((cue, index) => {
    const g = groups[Math.max(0, chapterIndexAt(chapters, cue.start) + offset)] ?? groups[0];
    const paragraph = g.paragraphs[g.paragraphs.length - 1];
    const previous = paragraph?.[paragraph.length - 1]?.cue;
    if (!paragraph || !previous || cue.start - previous.end > 2 || cue.speaker !== previous.speaker) g.paragraphs.push([{ cue, index }]);
    else paragraph.push({ cue, index });
  });
  return groups.filter((g) => g.chapter || g.paragraphs.length);
};

/**
 * "Read along": the film's words under the player, grouped by chapter, with
 * the line being spoken highlighted. Clicking a line plays from there; each
 * chapter heading is a button, so keyboards can jump too. Closed until
 * asked for, but always in the page, for search engines and for print.
 */
export const ReadAlong: React.FC<{
  cues: Cue[];
  chapters: FilmChapter[];
  active: number;
  playing: boolean;
  onSeek: (time: number) => void;
  subLang: Lang;
  languages: Lang[];
  onSubLang: (lang: Lang) => void;
  language: Lang;
}> = ({ cues, chapters, active, playing, onSeek, subLang, languages, onSubLang, language }) => {
  const en = language === "en";
  const [open, setOpen] = useState(false);
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const lastManualScroll = useRef(0);
  const groups = useMemo(() => groupCues(cues, chapters), [cues, chapters]);
  const hasWords = cues.length > 0;

  // Keep the spoken line in view while the film plays, inside the panel
  // only (never scrolling the page), and not while the reader is scrolling
  // the transcript themselves.
  useEffect(() => {
    const list = listRef.current;
    if (!open || !playing || active < 0 || !list) return;
    if (Date.now() - lastManualScroll.current < 4000) return;
    const line = list.querySelector<HTMLElement>(`[data-cue="${active}"]`);
    if (!line) return;
    const target = line.offsetTop - list.clientHeight / 3;
    list.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [active, open, playing]);

  const markManual = () => { lastManualScroll.current = Date.now(); };

  return (
    <div className="sb-readalong">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="sb-btn-word inline-flex items-center gap-2"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          style={{ fontSize: 20 }}
        >
          {hasWords ? (en ? "Read along" : "Citește odată cu filmul") : (en ? "Chapters" : "Capitole")}
          <ChevronDown className="w-4 h-4 transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden="true" />
        </button>
        {hasWords && languages.length > 1 && (
          <div className="sb-seg" role="group" aria-label={en ? "Subtitle language" : "Limba subtitrării"}>
            {languages.map((l) => (
              <button key={l} type="button" aria-pressed={subLang === l} className="sb-seg-btn" onClick={() => onSubLang(l)}>
                {l === "en" ? "English" : "Română"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        id={id}
        ref={listRef}
        hidden={!open}
        className="sb-readalong-list"
        lang={subLang}
        onWheel={markManual}
        onTouchMove={markManual}
        onKeyDown={markManual}
      >
        {hasWords && (
          <p className="sb-meta m-0 mb-4">
            {en ? "Select a line to play the film from there." : "Alege o replică pentru a porni filmul de acolo."}
          </p>
        )}
        {groups.map((g, gi) => (
          <section key={gi}>
            {g.chapter && (
              <h3 className="m-0">
                <button type="button" className="sb-readalong-chapter" onClick={() => onSeek(g.chapter!.t)}>
                  <span className="sb-numeral" style={{ fontVariantNumeric: "tabular-nums" }}>{formatClock(g.chapter.t)}</span>
                  <span>{chapterTitle(g.chapter, language)}</span>
                </button>
              </h3>
            )}
            {g.paragraphs.map((paragraph, pi) => (
              <p key={pi} className="sb-readalong-p">
                {paragraph[0].cue.speaker && <span className="sb-cue-speaker">{paragraph[0].cue.speaker} </span>}
                {paragraph.map(({ cue, index }) => (
                  <React.Fragment key={index}>
                    <span
                      data-cue={index}
                      className={index === active ? "sb-cue is-active" : "sb-cue"}
                      onClick={() => onSeek(cue.start)}
                      title={formatClock(cue.start)}
                    >
                      {cue.text.replace(/\n/g, " ")}
                    </span>{" "}
                  </React.Fragment>
                ))}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
};
