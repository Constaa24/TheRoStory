import React from "react";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

/**
 * Failure state for a page whose data did not load.
 *
 * Categories, CategoryDetail and Map used to catch a fetch error, log it, and
 * render their empty grid — which looks exactly like "there is nothing here".
 * A reader hitting a transient Supabase blip was told, in effect, that the
 * archive was empty. This says what happened and offers the retry.
 *
 * Deliberately not Profile's shadcn <Card>: these three pages are in the
 * editorial language (.ed-container, .btn-ed, the gold/parchment tokens), and
 * a card from the admin surface would read as a different site. Shared rather
 * than copied three times, because the thing this whole audit kept finding was
 * the same value drifting between the places that duplicated it.
 */
export const LoadError: React.FC<{
  /** Optional override; defaults to a generic "could not load" line. */
  message?: string;
  /** Re-runs the page's loader. Omit to render the message alone. */
  onRetry?: () => void;
}> = ({ message, onRetry }) => {
  const { language } = useLanguage();

  const text =
    message ??
    (language === "en"
      ? "We could not load this right now. It is usually a passing connection problem."
      : "Nu am putut încărca acest conținut acum. De obicei este o problemă temporară de conexiune.");

  return (
    <div
      role="alert"
      className="py-20 text-center flex flex-col items-center gap-6"
    >
      <AlertCircle className="w-8 h-8" style={{ color: "var(--oxblood-2)" }} aria-hidden="true" />
      <p
        className="font-display italic m-0 max-w-[460px]"
        style={{ fontSize: 22, lineHeight: 1.35, color: "var(--parchment)" }}
      >
        {text}
      </p>
      {onRetry && (
        <button className="btn-ed btn-ed-ghost" onClick={onRetry}>
          {language === "en" ? "Try again" : "Încearcă din nou"}
        </button>
      )}
    </div>
  );
};
