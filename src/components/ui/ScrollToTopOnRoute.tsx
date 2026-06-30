import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Per-session cache of scroll positions, keyed by history entry. Lets us
// restore the reader's place on Back/Forward (e.g. article → back to a scrolled
// list) while still resetting to the top for forward navigations.
const scrollPositions = new Map<string, number>();

export default function ScrollToTopOnRoute() {
  const { pathname, key } = useLocation();
  const navigationType = useNavigationType(); // "POP" | "PUSH" | "REPLACE"

  // Take over scroll handling from the browser so its (unreliable, for an SPA)
  // native restoration doesn't fight ours.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Continuously record the scroll position for the current history entry.
  useEffect(() => {
    const onScroll = () => { scrollPositions.set(key, window.scrollY); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key]);

  // Keyed on pathname only — so same-path query changes (e.g. the home grid's
  // ?page=N, which manages its own scroll) don't reset position. `key` and
  // `navigationType` are read from the closure at the moment pathname changes.
  useEffect(() => {
    if (navigationType === "POP") {
      // Restore the saved position. Some routes load content asynchronously, so
      // the page may not be tall enough to scroll to yet — re-apply over a few
      // frames until the layout settles. Bail the moment the user scrolls.
      const saved = scrollPositions.get(key) ?? 0;
      let cancelled = false;
      const stop = () => { cancelled = true; };
      const timers = [0, 60, 150, 300, 500].map((delay) =>
        window.setTimeout(() => { if (!cancelled) window.scrollTo(0, saved); }, delay)
      );
      window.addEventListener("wheel", stop, { passive: true, once: true });
      window.addEventListener("touchmove", stop, { passive: true, once: true });
      return () => {
        timers.forEach(window.clearTimeout);
        window.removeEventListener("wheel", stop);
        window.removeEventListener("touchmove", stop);
      };
    }
    // PUSH / REPLACE → a fresh navigation starts at the top.
    window.scrollTo(0, 0);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
