import React, { useState } from "react";
import type { Article } from "@/lib/supabase";
import { parseStoryChapters, splitOpening, splitTitle, toRoman, type StoryChapter } from "@/lib/story-facts";
import { Divider, Motif, Rosette } from "@/components/story/Ornaments";

type Lang = "en" | "ro";

/**
 * A chapter body as blocks: paragraphs split on newlines, and a line that
 * starts with "> " lifted out as a pull quote — the same convention the
 * editors have always written to.
 */
const blocksOf = (body: string): { quote: boolean; text: string }[] =>
  body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("> ") ? { quote: true, text: p.replace(/^>\s*/, "") } : { quote: false, text: p }));

const PullQuote: React.FC<{ text: string; language: Lang }> = ({ text, language }) => (
  <figure className="text-center" style={{ margin: "52px 0" }}>
    <Rosette size="sm" />
    <blockquote className="m-0 mt-3.5">
      <p className="sb-h3 m-0" style={{ fontSize: "clamp(26px, 2.6vw, 34px)", lineHeight: 1.25 }}>
        {language === "en" ? `“${text}”` : `„${text}”`}
      </p>
    </blockquote>
  </figure>
);

/** A paragraph that opens with its first words in capitals, as a book's chapters do. */
const OpeningParagraph: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const [open, rest] = splitOpening(text, 4);
  return (
    <p className={className}>
      <span className="sb-incipit">{open}</span>{rest}
    </p>
  );
};

/**
 * An essay: the first chapter opens with a drop cap; each later one with a
 * stitched divider and its numeral (and its title, when the writer gave it
 * one); every chapter's first words are set in capitals.
 */
export const EssayChapters: React.FC<{ chapters: StoryChapter[]; ids: string[]; language: Lang }> = ({ chapters, ids, language }) => (
  <div className="sb-prose">
    {chapters.map((chapter, i) => {
      const blocks = blocksOf(chapter.body);
      const firstText = blocks.findIndex((b) => !b.quote);
      const label = language === "en" ? "Chapter" : "Capitolul";
      return (
        <section key={ids[i]} id={ids[i]} className="scroll-mt-40" aria-label={chapters.length > 1 ? `${label} ${toRoman(i + 1)}` : undefined}>
          {i > 0 || chapter.title ? (
            <div className="sb-chapter-head" style={{ margin: i === 0 ? "0 0 28px" : "64px 0 28px", gap: 10 }}>
              {i > 0 && <Divider style={{ width: 220 }} />}
              <h2 className="m-0 mt-1.5 flex items-baseline gap-3 justify-center flex-wrap">
                <span className="sb-numeral" style={{ fontSize: 34 }}>
                  <span className="sr-only">{label} </span>{toRoman(i + 1)}
                </span>
                {chapter.title && <span className="sb-h3">{chapter.title}</span>}
              </h2>
            </div>
          ) : chapters.length > 1 ? (
            <h2 className="sr-only">{label} I</h2>
          ) : null}
          {blocks.map((b, j) =>
            b.quote ? (
              <PullQuote key={j} text={b.text} language={language} />
            ) : j === firstText ? (
              <OpeningParagraph key={j} text={b.text} className={i === 0 ? "sb-dropcap" : undefined} />
            ) : (
              <p key={j}>{b.text}</p>
            ),
          )}
        </section>
      );
    })}
  </div>
);

/**
 * A short story: scenes, each headed "I · its title", divided by a band of
 * cross-stitch; the story opens with an illuminated initial.
 */
export const StoryScenes: React.FC<{ chapters: StoryChapter[]; ids: string[]; language: Lang }> = ({ chapters, ids, language }) => (
  <div className="sb-prose">
    {chapters.map((chapter, i) => {
      const blocks = blocksOf(chapter.body);
      const firstText = blocks.findIndex((b) => !b.quote);
      return (
        <section key={ids[i]} id={ids[i]} className="scroll-mt-40">
          {i > 0 && <Motif className="mx-auto" style={{ width: 200, margin: "56px auto 40px" }} />}
          {(chapters.length > 1 || chapter.title) && (
            <h2 className="sb-kicker-sm text-center" style={{ marginBottom: 26 }}>
              <span className="sb-numeral">
                <span className="sr-only">{language === "en" ? "Scene " : "Scena "}</span>{toRoman(i + 1)}
              </span>
              {chapter.title && <> · {chapter.title}</>}
            </h2>
          )}
          {blocks.map((b, j) => {
            if (b.quote) return <PullQuote key={j} text={b.text} language={language} />;
            if (j !== firstText) return <p key={j}>{b.text}</p>;
            // A scene that opens on punctuation (a quotation mark, a dash)
            // has no letter to illuminate; it opens like the later scenes.
            if (i > 0 || !/^[\p{L}\p{N}]/u.test(b.text)) return <OpeningParagraph key={j} text={b.text} />;
            // The illuminated initial is drawn, not read: assistive tech gets
            // the opening words whole, the eye gets the initial in its frame.
            const [open, rest] = splitOpening(b.text, 4);
            return (
              <p key={j}>
                <span className="sr-only">{open}</span>
                <span aria-hidden="true">
                  <span className="sb-illum">{open.charAt(0)}</span>
                  <span className="sb-incipit">{open.slice(1)}</span>
                </span>
                {rest}
              </p>
            );
          })}
        </section>
      );
    })}
  </div>
);

/** A poem's stanzas: split on blank lines, across all of its chapters. */
const stanzasOf = (content: string): string[][] =>
  parseStoryChapters(content)
    .flatMap((ch) => ch.body.split(/\n\s*\n/))
    .map((stanza) => stanza.split("\n").map((l) => l.replace(/^>\s*/, "").trimEnd()).filter((l) => l.trim()))
    .filter((lines) => lines.length);

export type PoemMode = "both" | "ro" | "en";

/**
 * A poem on its own page, in either language or both side by side — the
 * Romanian original and its English reading, stanza by stanza.
 */
export const PoemPage: React.FC<{ article: Article; language: Lang; footer?: React.ReactNode }> = ({ article, language, footer }) => {
  const en = language === "en";
  const ro = stanzasOf(article.contentRo || "");
  const enStanzas = stanzasOf(article.contentEn || "");
  const bilingual = ro.length > 0 && enStanzas.length > 0 && (article.contentRo || "").trim() !== (article.contentEn || "").trim();

  // Side by side needs the width; a phone starts in the reader's language.
  const [mode, setMode] = useState<PoemMode>(() => {
    if (!bilingual) return language;
    try { return window.matchMedia("(min-width: 768px)").matches ? "both" : language; } catch { return language; }
  });
  const shown: PoemMode = bilingual ? mode : (language === "ro" ? (ro.length ? "ro" : "en") : (enStanzas.length ? "en" : "ro"));

  const titleIn = (l: Lang) => splitTitle(l === "ro" ? article.titleRo : article.titleEn).main;
  const modes: { key: PoemMode; label: string }[] = [
    { key: "both", label: en ? "Side by side" : "Față în față" },
    { key: "ro", label: "Română" },
    { key: "en", label: "English" },
  ];

  return (
    <div className="sb-paper" style={{ borderRadius: 26, padding: "clamp(26px, 5vw, 72px)" }}>
      {bilingual && (
        <div className="flex justify-center mb-10">
          <div className="sb-seg" role="group" aria-label={en ? "Read the poem in" : "Citește poemul în"}>
            {modes.map((m) => (
              <button key={m.key} type="button" className="sb-seg-btn" aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {shown === "both" ? (
        <div>
          <div className="hidden md:grid gap-x-10" style={{ gridTemplateColumns: "40px minmax(0, 1fr) minmax(0, 1fr)" }}>
            <span />
            <p className="sb-kicker-sm" lang="ro" style={{ marginBottom: 26 }}>{titleIn("ro")} · {en ? "in Romanian" : "în română"}</p>
            <p className="sb-kicker-sm" lang="en" style={{ marginBottom: 26 }}>{titleIn("en")} · {en ? "in English" : "în engleză"}</p>
          </div>
          {Array.from({ length: Math.max(ro.length, enStanzas.length) }, (_, i) => (
            <div key={i} className="grid gap-x-6 md:gap-x-10 grid-cols-[32px_minmax(0,1fr)] md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)]" style={{ paddingBottom: 40 }}>
              <span className="sb-numeral" style={{ fontSize: 18, paddingTop: 10 }} aria-hidden="true">{toRoman(i + 1)}</span>
              <div lang="ro">
                {(ro[i] || []).map((l, j) => <p key={j} className="sb-verse">{l}</p>)}
              </div>
              <div lang="en" className="col-start-2 md:col-start-auto mt-5 md:mt-0 pt-5 md:pt-0 md:pl-10 md:-ml-5 border-t md:border-t-0 md:border-l border-dashed" style={{ borderColor: "var(--line)" }}>
                {(enStanzas[i] || []).map((l, j) => <p key={j} className="sb-verse sb-verse-en">{l}</p>)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div lang={shown} className="mx-auto" style={{ maxWidth: 560 }}>
          {bilingual && (
            <p className="sb-kicker-sm text-center" style={{ marginBottom: 26 }}>
              {titleIn(shown)} · {shown === "ro" ? (en ? "in Romanian" : "în română") : (en ? "in English" : "în engleză")}
            </p>
          )}
          {(shown === "ro" ? ro : enStanzas).map((stanza, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: "40px minmax(0, 1fr)", paddingBottom: 40 }}>
              <span className="sb-numeral" style={{ fontSize: 18, paddingTop: 10 }} aria-hidden="true">{toRoman(i + 1)}</span>
              <div>
                {stanza.map((l, j) => <p key={j} className="sb-verse" style={{ fontSize: "min(calc(var(--sb-prose-size, 20px) * 1.4), 5.4vw)" }}>{l}</p>)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sb-chapter-head mt-3" style={{ gap: 10 }}>
        <Rosette />
        {footer}
      </div>
    </div>
  );
};
