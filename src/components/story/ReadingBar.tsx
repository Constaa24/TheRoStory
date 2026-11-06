import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
    <nav
      className="sb-chapter-pill no-print min-[1100px]:hidden"
      aria-label={en ? "Chapters" : "Capitole"}
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
    </nav>,
    document.body,
  );
};
