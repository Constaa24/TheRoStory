import React, { useCallback, useEffect, useRef, useState } from "react";
import { storageImage, storageSrcSet } from "@/lib/image-url";
import { toRoman } from "@/lib/story-facts";

type Lang = "en" | "ro";
export type Frame = { url: string; caption: { en: string; ro: string } };

const isTyping = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
};

/**
 * A visual essay as a picture book: one frame at a time, its caption beside
 * it, the arrows (or arrow keys, or a swipe) to turn the page, and every
 * frame in a strip underneath. Captions can be read in either language.
 *
 * The frame keeps a fixed shape and letterboxes the picture rather than
 * cropping it — these pictures are the story, and a crop changes what they
 * say. Printing gets every frame, one after another.
 */
export const PictureBook: React.FC<{ frames: Frame[]; title: string; language: Lang; id?: string }> = ({ frames, title, language, id = "frames" }) => {
  const en = language === "en";
  const [index, setIndex] = useState(0);
  const [capLang, setCapLang] = useState<Lang>(language);
  const sectionRef = useRef<HTMLElement>(null);
  const touchX = useRef<number | null>(null);
  const total = frames.length;
  const bilingual = frames.some((f) => f.caption.en) && frames.some((f) => f.caption.ro);

  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(total - 1, next))), [total]);

  // Arrow keys turn the pages while the book is on screen, unless the reader
  // is typing somewhere (a note to the writers, the search).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const box = sectionRef.current?.getBoundingClientRect();
      if (!box || box.bottom < 0 || box.top > window.innerHeight) return;
      e.preventDefault();
      setIndex((i) => Math.max(0, Math.min(total - 1, i + (e.key === "ArrowRight" ? 1 : -1))));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [total]);

  // Fetch the next page before it is turned to.
  useEffect(() => {
    const next = frames[index + 1];
    if (next) new Image().src = storageImage(next.url, "feature") || next.url;
  }, [index, frames]);

  if (!total) return null;
  const frame = frames[index];
  const captionOf = (f: Frame, l: Lang) => f.caption[l] || f.caption[l === "en" ? "ro" : "en"];
  const caption = captionOf(frame, capLang);
  const altOf = (f: Frame, i: number) =>
    captionOf(f, language) || (en ? `${title} — frame ${i + 1} of ${total}` : `${title} — cadrul ${i + 1} din ${total}`);

  return (
    <section id={id} ref={sectionRef} className="ed-container scroll-mt-28" aria-roledescription="carousel" aria-label={title}>
      <div className="no-print grid grid-cols-1 min-[1000px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-[clamp(24px,4vw,56px)] items-center">
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "4 / 3", borderRadius: "50% 50% 14px 14px / 18% 18% 14px 14px", background: "var(--paper)", border: "1px solid var(--line)", touchAction: "pan-y" }}
          onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            const end = e.changedTouches[0]?.clientX;
            if (start == null || end == null || Math.abs(end - start) < 50) return;
            go(index + (end < start ? 1 : -1));
          }}
        >
          <img
            key={frame.url}
            src={storageImage(frame.url, "feature")}
            srcSet={storageSrcSet(frame.url, ["card", "feature"])}
            sizes="(min-width: 1000px) 60vw, 94vw"
            alt={altOf(frame, index)}
            className="absolute inset-0 w-full h-full rs-in"
            style={{ objectFit: "contain" }}
          />
          <span className="rs-card-kind" style={{ left: "50%", top: 20, bottom: "auto", transform: "translateX(-50%)", fontWeight: 700 }}>
            {en ? `Frame ${index + 1} of ${total}` : `Cadrul ${index + 1} din ${total}`}
          </span>
        </div>

        <div className="flex flex-col gap-6">
          <span aria-hidden="true" className="font-display italic" style={{ fontSize: 64, lineHeight: 1, color: "var(--gold)" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <p
            aria-live="polite"
            lang={frame.caption[capLang] ? capLang : capLang === "en" ? "ro" : "en"}
            className="m-0"
            // A long caption (a paragraph, not a line) steps down a size so it
            // doesn't fill the screen beside its picture.
            style={{ fontFamily: "var(--display)", fontSize: caption.length > 180 ? "clamp(20px, 1.7vw, 24px)" : "clamp(26px, 2.6vw, 34px)", lineHeight: caption.length > 180 ? 1.4 : 1.28, color: "var(--parchment)", textWrap: "pretty" }}
          >
            {caption}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="rs-round" aria-label={en ? "Previous frame" : "Cadrul anterior"} onClick={() => go(index - 1)} disabled={index === 0}>←</button>
            <button type="button" className="rs-round is-gold" aria-label={en ? "Next frame" : "Cadrul următor"} onClick={() => go(index + 1)} disabled={index === total - 1}>→</button>
            <div role="group" aria-label={en ? "All frames" : "Toate cadrele"} className="flex flex-wrap ml-1">
              {frames.map((f, i) => (
                <button
                  key={`${f.url}-${i}`}
                  type="button"
                  className="rs-diamond"
                  aria-label={en ? `Frame ${i + 1} of ${total}` : `Cadrul ${i + 1} din ${total}`}
                  aria-current={i === index ? "step" : undefined}
                  onClick={() => go(i)}
                />
              ))}
            </div>
          </div>
          {bilingual && (
            <div className="sb-seg self-start" role="group" aria-label={en ? "Caption language" : "Limba legendelor"}>
              {(["en", "ro"] as const).map((l) => (
                <button key={l} type="button" lang={l} className="sb-seg-btn" aria-pressed={capLang === l} onClick={() => setCapLang(l)}>
                  {l === "en" ? "English" : "Română"}
                </button>
              ))}
            </div>
          )}
          <p className="m-0" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
            {en ? "Use ← and → to move between frames; on a phone, swipe." : "Folosește ← și → pentru a trece de la un cadru la altul; pe telefon, glisează."}
          </p>
        </div>
      </div>

      {/* On paper, the whole book. */}
      <ol className="hidden print:block list-none m-0 p-0">
        {frames.map((f, i) => (
          <li key={`${f.url}-print-${i}`} style={{ breakInside: "avoid", marginBottom: 24 }}>
            <figure className="m-0">
              <img src={storageImage(f.url, "feature")} alt={altOf(f, i)} style={{ width: "100%", height: "auto" }} />
              {captionOf(f, language) && <figcaption style={{ marginTop: 8 }}>{toRoman(i + 1)}. {captionOf(f, language)}</figcaption>}
            </figure>
          </li>
        ))}
      </ol>
    </section>
  );
};
