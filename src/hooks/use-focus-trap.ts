import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (root: HTMLElement): HTMLElement[] => {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // Skip elements inside aria-hidden ancestors.
    const closestHidden = el.closest('[aria-hidden="true"]');
    if (closestHidden && closestHidden !== root && root.contains(closestHidden)) return false;
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
  });
};

/**
 * Confines tab focus inside the referenced container while `active` is true.
 * Pairs with manually-implemented modals (where Radix's Dialog isn't used)
 * so keyboard users can't tab past the modal into the page underneath.
 *
 * - Focuses the first focusable element on activation.
 * - Restores focus to the originally-focused element on deactivation.
 * - Cycles Tab / Shift+Tab between first and last focusable elements.
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus inside the trap if it's not already there.
    if (!root.contains(document.activeElement)) {
      const focusables = getFocusable(root);
      (focusables[0] || root).focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = getFocusable(root);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeEl === first || !root.contains(activeEl)) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (activeEl === last || !root.contains(activeEl)) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus only if the previously-focused element is still in the DOM.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, ref]);
}
