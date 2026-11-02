import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { storageImage, storageSrcSet } from "@/lib/image-url";
import { toRoman } from "@/lib/story-facts";
import { Divider } from "@/components/story/Ornaments";

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
    <section id={id} ref={sectionRef} className="ed-container scroll-mt-28" style={{ paddingTop: 64, paddingBottom: 40 }} aria-label={en ? "The frames" : "Cadrele"}>
      <div className="no-print">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
          <p className="sb-kicker" aria-live="polite">
            {en ? "Frame " : "Cadrul "}<span className="sb-numeral">{toRoman(index + 1)}</span>{en ? ` of ${toRoman(total)}` : ` din ${toRoman(total)}`}
          </p>
          {bilingual && (
            <div className="sb-seg" role="group" aria-label={en ? "Caption language" : "Limba legendelor"}>
              {(["en", "ro"] as const).map((l) => (
                <button key={l} type="button" lang={l} className="sb-seg-btn" aria-pressed={capLang === l} onClick={() => setCapLang(l)}>
                  {l === "en" ? "English" : "Română"}
                </button>
              ))}
            </div>
          )}
        </div>

        <figure className="m-0">
          <div
            className="sb-frame aspect-[4/5] sm:aspect-[3/2]"
            style={{ borderRadius: 22, maxHeight: "min(60vh, 660px)", width: "100%", touchAction: "pan-y" }}
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
              sizes="(min-width: 1280px) 1200px, 94vw"
              alt={altOf(frame, index)}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "contain" }}
            />
          </div>
          <figcaption className="grid gap-5 sm:gap-7 items-start mt-7 grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[90px_minmax(0,1fr)_auto]">
            <span className="sb-numeral leading-[0.9] text-[40px] md:text-[54px]" aria-hidden="true">{toRoman(index + 1)}</span>
            <p lang={frame.caption[capLang] ? capLang : capLang === "en" ? "ro" : "en"} className="font-display italic m-0 max-w-[880px]" style={{ fontSize: "clamp(23px, 2.4vw, 34px)", lineHeight: 1.35, color: "var(--parchment)" }}>
              {caption}
            </p>
            <div className="flex items-center gap-2.5 col-span-2 md:col-span-1 justify-end">
              <button
                type="button"
                className="sb-icon-btn"
                style={{ width: 52, height: 52 }}
                aria-label={en ? "Previous frame" : "Cadrul anterior"}
                onClick={() => go(index - 1)}
                disabled={index === 0}
              >
                <ChevronLeft className="sb-ico" />
              </button>
              <button type="button" className="sb-btn" style={{ minHeight: 52 }} onClick={() => go(index + 1)} disabled={index === total - 1}>
                {en ? "Turn the page →" : "Întoarce pagina →"}
              </button>
            </div>
          </figcaption>
        </figure>

        <Divider style={{ marginBlock: "40px 22px" }} />
        <nav aria-label={en ? "All frames" : "Toate cadrele"}>
          <ul className="list-none m-0 p-0 grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(64px, 1fr))` }}>
            {frames.map((f, i) => (
              <li key={`${f.url}-${i}`}>
                <button
                  type="button"
                  className="sb-thumb w-full"
                  aria-label={en ? `Frame ${i + 1}` : `Cadrul ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => go(i)}
                >
                  <img className="sb-thumb-img" src={storageImage(f.url, "thumb")} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <p className="sb-meta text-center mt-3.5">
          {en ? "Arrow keys turn the pages · on a phone, swipe" : "Săgețile întorc paginile · pe telefon, glisează"}
        </p>
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
