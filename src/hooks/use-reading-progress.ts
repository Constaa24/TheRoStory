import { useEffect, useState, RefObject } from "react";

/**
 * Tracks how far the user has scrolled inside a scrollable container,
 * returning a number from 0 to 1. Used to drive the article reading
 * progress bar.
 */
export function useReadingProgress(scrollRef: RefObject<HTMLElement>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) {
        setProgress(0);
        return;
      }
      setProgress(Math.min(1, Math.max(0, el.scrollTop / max)));
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollRef]);

  return progress;
}

/**
 * Estimates reading time in minutes for a given body of text.
 * Uses 200 words-per-minute, which is the standard average for
 * English/Romanian editorial reading.
 */
export function getReadingTimeMinutes(text: string): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
