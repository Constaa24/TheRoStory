import { useEffect } from "react";

/**
 * Warns the user before unloading the page if there are unsaved changes.
 * Pass `enabled = true` whenever the form is dirty; `false` once the
 * user has saved or explicitly discarded.
 *
 * The custom message is ignored by modern browsers (they show their own
 * generic "Leave site?" prompt), but returning a non-empty string is
 * still required to trigger the dialog at all.
 */
export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
