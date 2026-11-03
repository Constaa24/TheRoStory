import React from "react";
import type { StoryMoment } from "@/lib/supabase";

type Lang = "en" | "ro";

/**
 * "The story in moments" (the redesign canvas's short-story header): the
 * dates an author gave their chapters, threaded together under the title,
 * each a link to its chapter. Drawn only with two or more, since one date is
 * no timeline. A year reads the same in both languages, so a moment with a
 * date in only one language still shows; its words don't, as they would be
 * in the wrong language.
 */
export const MomentsStrip: React.FC<{
  moments?: StoryMoment[] | null;
  chapterIds: string[];
  language: Lang;
}> = ({ moments, chapterIds, language }) => {
  const en = language === "en";
  const items = (moments ?? [])
    .filter((m) => m.chapter >= 0 && m.chapter < chapterIds.length)
    .map((m) => ({
      id: chapterIds[m.chapter],
      chapter: m.chapter,
      when: (en ? m.when_en || m.when_ro : m.when_ro || m.when_en)?.trim() || "",
      label: (en ? m.label_en : m.label_ro)?.trim() || "",
    }))
    .filter((m) => m.when)
    .sort((a, b) => a.chapter - b.chapter);
  if (items.length < 2) return null;

  return (
    <nav className="ed-container no-print" aria-label={en ? "The story in moments" : "Povestea în momente"} style={{ paddingBottom: "clamp(40px, 6vw, 64px)" }}>
      <ol
        className="sb-moments"
        data-many={items.length > 3 ? "" : undefined}
        style={{ "--n": items.length } as React.CSSProperties}
      >
        {items.map((m) => (
          <li key={m.id}>
            <a href={`#${m.id}`} className="sb-moment">
              <span className="sb-knot" aria-hidden="true" />
              <span className="sb-numeral">{m.when}</span>
              {m.label && <span className="sb-kicker-sm">{m.label}</span>}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
};
