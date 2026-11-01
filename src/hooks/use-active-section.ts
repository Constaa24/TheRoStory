import { useEffect, useState } from "react";

/**
 * Which of the given sections the reader is in: the last one whose top has
 * crossed a line `offset` of the way down the viewport. Drives the chapter
 * path beside a story and the contents beside the legal pages.
 *
 * A throttled scroll listener rather than an IntersectionObserver: "the last
 * section that has started" is a question about every section at once, which
 * an observer answers only per element and only as each crosses.
 */
export const useActiveSection = (ids: string[], offset = 0.35): number => {
  const [active, setActive] = useState(0);
  const key = ids.join("|");

  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * offset;
      let index = 0;
      list.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - line <= 0) index = i;
      });
      setActive(index);
    };
    const schedule = () => { if (!raf) raf = window.requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [key, offset]);

  return active;
};
