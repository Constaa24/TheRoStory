import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toRoman } from "@/lib/story-facts";

type Lang = "en" | "ro";
export type TextSize = "sm" | "md" | "lg";

const TEXT_SIZE_KEY = "rostory_text_size";
const SIZES: TextSize[] = ["sm", "md", "lg"];

/** Prose sizes per setting: desktop, then phone. */
const PROSE_PX: Record<TextSize, [number, number]> = { sm: [18, 17], md: [20, 19], lg: [23, 21] };

/** The reader's text size, remembered on this device. */
export const useTextSize = () => {
  const [size, setSizeState] = useState<TextSize>(() => {
    try {
      const saved = window.localStorage.getItem(TEXT_SIZE_KEY);
      return SIZES.includes(saved as TextSize) ? (saved as TextSize) : "md";
    } catch {
      return "md";
    }
  });
  const setSize = useCallback((next: TextSize) => {
    setSizeState(next);
    try { window.localStorage.setItem(TEXT_SIZE_KEY, next); } catch { /* storage blocked: keep it for this visit */ }
  }, []);
  const style = {
    "--sb-prose-size": `${PROSE_PX[size][0]}px`,
    "--sb-prose-size-sm": `${PROSE_PX[size][1]}px`,
  } as React.CSSProperties;
  return { size, setSize, style };
};

export type ChapterMark = { id: string; label: string };

/**
 * The bar that stays under the navigation while a story is read: the way
 * back, the thread of the story with a knot for each chapter, the text size,
 * and the other language. On a phone it folds to four small buttons.
 *
 * The thread's gold fill follows the scroll through a CSS custom property
 * written straight to the element — as React state, every scroll event would
 * re-render the story beneath it.
 */
export const ReadingBar: React.FC<{
  language: Lang;
  onBack: () => void;
  chapters: ChapterMark[];
  active: number;
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  onOtherLanguage: () => void;
  saved: boolean;
  onSave: (e: React.MouseEvent) => void;
}> = ({ language, onBack, chapters, active, textSize, onTextSize, onOtherLanguage, saved, onSave }) => {
  const en = language === "en";
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const write = () => {
      frame = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0;
      barRef.current?.style.setProperty("--read-progress", `${pct}%`);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(write); };
    window.addEventListener("scroll", onScroll, { passive: true });
    write();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const knots = chapters.length > 1 ? chapters : [];
  const sizeLabel = (s: TextSize) =>
    en ? { sm: "Smaller text", md: "Medium text", lg: "Larger text" }[s] : { sm: "Text mai mic", md: "Text mediu", lg: "Text mai mare" }[s];
  const otherLabel = en ? "Citește în română" : "Read in English";

  return (
    <div ref={barRef} className="sb-reading-bar no-print">
      <div className="ed-container flex items-center gap-4 md:gap-7" style={{ minHeight: 60 }}>
        <button type="button" onClick={onBack} className="sb-btn-word shrink-0" style={{ fontSize: 18 }}>
          ← <span className="hidden sm:inline">{en ? "Back to the stories" : "Înapoi la povești"}</span>
          <span className="sm:hidden">{en ? "Stories" : "Povești"}</span>
        </button>

        <div aria-hidden="true" className="relative flex-1 min-w-0 hidden md:flex items-center" style={{ height: 12 }}>
          <span className="sb-thread absolute left-0 right-0" style={{ opacity: 0.35 }} />
          <span className="absolute left-0" style={{ width: "var(--read-progress, 0%)", height: 2, background: "var(--gold)" }} />
          {knots.map((c, i) => (
            <span
              key={c.id}
              className="sb-knot absolute"
              style={{
                left: `calc(${(i / (knots.length - 1)) * 100}% - ${i === knots.length - 1 ? 9 : 0}px)`,
                width: 9, height: 9,
                background: i <= active ? "var(--gold)" : "var(--ink)",
                opacity: i <= active + 1 ? 1 : 0.6,
              }}
            />
          ))}
        </div>
        <span className="flex-1 md:hidden" />

        <div className="flex items-center gap-2 shrink-0">
          <div className="sb-seg hidden md:inline-flex" role="group" aria-label={en ? "Text size" : "Mărimea textului"}>
            {SIZES.map((s, i) => (
              <button
                key={s}
                type="button"
                className="sb-seg-btn"
                aria-pressed={textSize === s}
                aria-label={sizeLabel(s)}
                onClick={() => onTextSize(s)}
                style={{ fontSize: [12, 15, 18][i], padding: "6px 12px", minHeight: 32 }}
              >
                A
              </button>
            ))}
          </div>
          {/* Phone: one button steps through the three sizes. */}
          <button
            type="button"
            className="sb-icon-btn md:hidden font-display"
            style={{ width: 40, height: 40, fontSize: 19 }}
            aria-label={`${en ? "Text size" : "Mărimea textului"}: ${sizeLabel(textSize)}`}
            onClick={() => onTextSize(SIZES[(SIZES.indexOf(textSize) + 1) % SIZES.length])}
          >
            Aa
          </button>
          <button type="button" lang={en ? "ro" : "en"} onClick={onOtherLanguage} className="sb-btn sb-btn-ghost hidden md:inline-flex" style={{ minHeight: 40, padding: "8px 16px" }}>
            {otherLabel}
          </button>
          <button
            type="button"
            lang={en ? "ro" : "en"}
            onClick={onOtherLanguage}
            className="sb-icon-btn md:hidden font-ui font-bold"
            style={{ width: 40, height: 40, fontSize: 12 }}
            aria-label={otherLabel}
          >
            {en ? "RO" : "EN"}
          </button>
          <button
            type="button"
            onClick={onSave}
            aria-pressed={saved}
            aria-label={en ? "Save to your shelf" : "Păstrează pe raftul tău"}
            className="sb-icon-btn md:hidden"
            style={{ width: 40, height: 40, color: saved ? "var(--gold)" : undefined }}
          >
            <Heart className={cn("sb-ico", saved && "fill-current")} />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * On a phone, where there is no room for the chapter path, a pill floats at
 * the foot of the screen while the story is being read: which chapter, how
 * far, and a menu to jump. Portalled to <body> — the page sits inside a
 * transformed .screen-anim, which would otherwise pin "fixed" to it.
 */
export const ChapterPill: React.FC<{
  language: Lang;
  chapters: ChapterMark[];
  active: number;
  /** The element that marks where the story ends; the pill hides past it. */
  endId: string;
}> = ({ language, chapters, active, endId }) => {
  const en = language === "en";
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const firstId = chapters[0]?.id;

  useEffect(() => {
    if (!firstId) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const first = document.getElementById(firstId)?.getBoundingClientRect().top ?? Infinity;
      const end = document.getElementById(endId)?.getBoundingClientRect().top ?? Infinity;
      setVisible(first < window.innerHeight * 0.5 && end > window.innerHeight * 0.6);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [firstId, endId]);

  useEffect(() => { if (!visible) setOpen(false); }, [visible]);

  // The site's floating "scroll to top" button lives in the same corner; the
  // stylesheet lifts it above the pill, and out of the way of the open menu.
  useEffect(() => {
    const body = document.body;
    if (visible && chapters.length > 1) body.dataset.chapterPill = open ? "open" : "on";
    else delete body.dataset.chapterPill;
    return () => { delete body.dataset.chapterPill; };
  }, [visible, open, chapters.length]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (chapters.length < 2 || typeof document === "undefined") return null;
  const total = toRoman(chapters.length);

  return createPortal(
    <div
      className="sb-chapter-pill no-print xl:hidden"
      data-visible={visible}
      aria-hidden={!visible}
      inert={!visible}
    >
      {open && (
        <ol id="sb-chapter-menu" className="sb-path sb-chapter-menu">
          {chapters.map((c, i) => (
            <li key={c.id} className={cn("sb-path-step", i < active && "is-done", i === active && "is-now")}>
              <a href={`#${c.id}`} className="sb-path-label" onClick={() => setOpen(false)}>
                <span className="sb-numeral mr-1.5" style={{ fontSize: 14 }}>{toRoman(i + 1)}</span>
                {c.label}
              </a>
            </li>
          ))}
        </ol>
      )}
      <div className="sb-chapter-pill-bar">
        <span className="sb-numeral" style={{ fontSize: 18 }} aria-hidden="true">{toRoman(active + 1)}</span>
        <span className="flex flex-col gap-1 min-w-0">
          <span className="sb-meta" style={{ color: "var(--text-dim)" }}>
            {en ? `Chapter ${toRoman(active + 1)} of ${total}` : `Capitolul ${toRoman(active + 1)} din ${total}`}
          </span>
          <span aria-hidden="true" className="relative" style={{ height: 3, borderRadius: 3, background: "var(--line)" }}>
            <span className="absolute left-0 top-0 bottom-0" style={{ width: `${((active + 1) / chapters.length) * 100}%`, borderRadius: 3, background: "var(--gold)" }} />
          </span>
        </span>
        <button
          type="button"
          className="sb-btn-word"
          style={{ fontSize: 17, padding: 0 }}
          aria-expanded={open}
          aria-controls="sb-chapter-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {en ? "Chapters" : "Capitole"} {open ? "▴" : "▾"}
        </button>
      </div>
    </div>,
    document.body,
  );
};
