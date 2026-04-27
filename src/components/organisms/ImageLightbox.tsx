import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LightboxImage {
  url: string;
  caption?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  startIndex: number;
  open: boolean;
  onClose: () => void;
  language: "en" | "ro";
}

/**
 * Full-screen image viewer with keyboard navigation, prev/next arrows,
 * a 1× / 2× zoom toggle, and an optional caption strip at the bottom.
 *
 * Used by carousel articles (and could be reused elsewhere). Renders as
 * a fixed-position overlay on top of any existing modal — uses z-[200]
 * so it sits above the parchment article modal (z-[100]).
 */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  startIndex,
  open,
  onClose,
  language,
}) => {
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);

  // Reset state when reopening
  useEffect(() => {
    if (open) {
      setIndex(startIndex);
      setZoomed(false);
    }
  }, [open, startIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex(i => Math.min(images.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex(i => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, images.length]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || images.length === 0) return null;

  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const labels = {
    close: language === "en" ? "Close" : "Închide",
    prev: language === "en" ? "Previous image" : "Imaginea anterioară",
    next: language === "en" ? "Next image" : "Imaginea următoare",
    zoom: zoomed
      ? (language === "en" ? "Zoom out" : "Micșorează")
      : (language === "en" ? "Zoom in" : "Mărește"),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={language === "en" ? "Image viewer" : "Vizualizator imagini"}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between p-4 text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-sm font-serif italic">
              {index + 1} / {images.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 rounded-full"
                onClick={() => setZoomed(z => !z)}
                aria-label={labels.zoom}
              >
                {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 rounded-full"
                onClick={onClose}
                aria-label={labels.close}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Image area */}
          <div
            className="flex-1 flex items-center justify-center overflow-auto px-4"
            onClick={e => e.stopPropagation()}
          >
            <motion.img
              key={current.url}
              src={current.url}
              alt={current.caption || ""}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, scale: zoomed ? 2 : 1 }}
              transition={{ duration: 0.25 }}
              className={`max-w-full max-h-full object-contain transition-transform ${
                zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
              }`}
              onClick={() => setZoomed(z => !z)}
              draggable={false}
            />
          </div>

          {/* Prev / next arrows — desktop only on the sides */}
          {hasPrev && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setIndex(i => Math.max(0, i - 1)); setZoomed(false); }}
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
              aria-label={labels.prev}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setIndex(i => Math.min(images.length - 1, i + 1)); setZoomed(false); }}
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md"
              aria-label={labels.next}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Bottom area: caption + mobile prev/next */}
          <div
            className="p-4 text-white space-y-3"
            onClick={e => e.stopPropagation()}
          >
            {current.caption && (
              <p className="text-center font-serif italic text-base md:text-lg max-w-3xl mx-auto">
                {current.caption}
              </p>
            )}
            <div className="flex md:hidden items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setIndex(i => Math.max(0, i - 1)); setZoomed(false); }}
                disabled={!hasPrev}
                className="text-white hover:bg-white/10 rounded-full disabled:opacity-30"
                aria-label={labels.prev}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setIndex(i => Math.min(images.length - 1, i + 1)); setZoomed(false); }}
                disabled={!hasNext}
                className="text-white hover:bg-white/10 rounded-full disabled:opacity-30"
                aria-label={labels.next}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
