import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type React from 'react';

/** Live result of a media query. */
export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );

export const useReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)');

/**
 * A button-and-popover pair. Opening moves focus to the pressed option (or
 * the first one); Escape, a click outside, or focus leaving closes it.
 * Because opening one popover moves focus out of any other, at most one is
 * ever open. Escape is marked handled (preventDefault) so the page's own
 * Escape — which clears the selection — leaves it alone.
 */
export const usePopover = () => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const pop = popRef.current;
    if (pop) {
      // Keep the popover on screen: a dropdown near the right edge of a
      // phone shifts left instead of overflowing the page.
      pop.style.left = '';
      if (!pop.dataset.anchor) {
        const over = pop.getBoundingClientRect().right - (document.documentElement.clientWidth - 12);
        if (over > 0) pop.style.left = `${-over}px`;
      }
      const first = pop.querySelector<HTMLElement>('[aria-pressed="true"]') ?? pop.querySelector<HTMLElement>('button');
      first?.focus({ preventScroll: true });
    }
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Escape' || !open) return;
      e.preventDefault();
      close(true);
    },
    [open, close]
  );

  return { open, toggle: () => setOpen((o) => !o), close, btnRef, popRef, onKeyDown };
};
