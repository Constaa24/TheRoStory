import React, { useEffect } from "react";
import { Eye } from "lucide-react";
import type { DraftOffer } from "@/hooks/use-story-draft";
import { previewKey, previewPath, type StoryKind } from "@/lib/story-draft";

type Lang = "en" | "ro";

/**
 * Offers back the unsaved copy an earlier visit left in this browser (see
 * use-story-draft). When the story was saved again after those changes, it
 * says so: saving the copy would replace that newer version.
 */
export const DraftOfferBanner: React.FC<{
  offer: DraftOffer | null;
  language: Lang;
  onRestore: () => void;
  onDiscard: () => void;
}> = ({ offer, language, onRestore, onDiscard }) => {
  if (!offer) return null;
  const en = language === "en";
  const when = new Date(offer.savedAt).toLocaleString(en ? "en-GB" : "ro-RO", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div className="ed-container" style={{ paddingTop: 24 }}>
      <section className="rs-draft-offer" aria-label={en ? "Unsaved changes" : "Modificări nesalvate"}>
        <p className="m-0">
          <strong style={{ color: "var(--parchment)" }}>{en ? `Unsaved changes from ${when}` : `Modificări nesalvate din ${when}`}</strong>
          {en ? ", kept in this browser." : ", păstrate în acest browser."}
          {offer.savedSince && (en
            ? " The story was saved again after them: saving them now would replace that newer version."
            : " Povestea a fost salvată din nou după ele: dacă le salvezi acum, înlocuiesc versiunea mai nouă.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rs-btn" style={{ minHeight: 38, padding: "0 16px", fontSize: 13 }} onClick={onRestore}>
            {en ? "Restore them" : "Restaurează-le"}
          </button>
          <button type="button" className="rs-btn rs-btn-ghost" style={{ minHeight: 38, padding: "0 16px", fontSize: 13 }} onClick={onDiscard}>
            {en ? "Discard" : "Renunță la ele"}
          </button>
        </div>
      </section>
    </div>
  );
};

/**
 * Opens the story as readers will see it, unsaved changes included, in a
 * tab of its own that follows the editor as it changes (pages/StoryPreview).
 * The same tab is reused for the same story.
 */
export const PreviewLink: React.FC<{ kind: StoryKind; storyId: string | null; language: Lang }> = ({ kind, storyId, language }) => {
  const label = language === "en" ? "Preview" : "Previzualizare";
  return (
    <a
      href={previewPath(kind, storyId)}
      target={`rostory-preview-${previewKey(kind, storyId)}`}
      aria-label={`${label} ${language === "en" ? "(opens in a new tab)" : "(se deschide într-o filă nouă)"}`}
      title={label}
      className="font-ui text-[13px] inline-flex items-center gap-1.5 transition-colors hover:text-gold"
      style={{ color: "var(--text-dim)", padding: "10px 14px", fontWeight: 600 }}
    >
      <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
      {/* On a phone the eye alone, so Save keeps its one line. */}
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
};

/**
 * The editors' save bar is fixed to the foot of the screen; while one is
 * open, the back-to-top button waits above it (storybook.css).
 */
export const useSaveBar = () => {
  useEffect(() => {
    document.body.dataset.saveBar = "on";
    return () => { delete document.body.dataset.saveBar; };
  }, []);
};
