import React from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/layout/PageHead";
import { useActiveSection } from "@/hooks/use-active-section";
import { toRoman } from "@/lib/story-facts";
import { cn } from "@/lib/utils";
import { Knot, Rosette, Thread } from "@/components/story/Ornaments";

export type LegalSection = { heading: string; body: string };

/**
 * The fine print, set like the rest of the storybook: a switch between the
 * two documents, three lines quoted at a glance, numbered sections with a
 * contents path beside them, and the reader's controls in the margin.
 *
 * The glance quotes are verbatim excerpts of the sections they name — a
 * summary that paraphrased a legal text could promise something it doesn't.
 */
export const LegalPage: React.FC<{
  language: "en" | "ro";
  current: "privacy" | "terms";
  title: string;
  subtitle: string;
  /** ISO date of the last material revision. */
  lastUpdated: string;
  sections: LegalSection[];
  glance: { quote: string; from: string }[];
  aside: React.ReactNode;
}> = ({ language, current, title, subtitle, lastUpdated, sections, glance, aside }) => {
  const en = language === "en";
  const ids = sections.map((_, i) => `section-${i + 1}`);
  const active = useActiveSection(ids);
  const date = new Intl.DateTimeFormat(en ? "en-GB" : "ro-RO", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${lastUpdated}T12:00:00`));
  const n = sections.length;
  const count = en ? `${n} short sections` : `${n}${n >= 20 ? " de" : ""} secțiuni scurte`;

  const docs = [
    { key: "privacy", to: "/privacy", label: en ? "Privacy Policy" : "Confidențialitate" },
    { key: "terms", to: "/terms", label: en ? "Terms of Service" : "Termeni și condiții" },
  ] as const;

  return (
    <div className="screen-anim">
      <PageHead title={title} description={subtitle} language={language} />

      <header className="ed-container" style={{ paddingTop: "clamp(40px, 6vw, 64px)", paddingBottom: 48 }}>
        <div className="sb-chapter-head" style={{ gap: 18 }}>
          <nav aria-label={en ? "The fine print" : "Detalii"} className="sb-seg">
            {docs.map((d) => (
              <Link key={d.key} to={d.to} className="sb-seg-btn" aria-current={d.key === current ? "page" : undefined}>
                {d.label}
              </Link>
            ))}
          </nav>
          <p className="sb-kicker mt-3">{en ? "The fine print" : "Detaliile"}</p>
          <h1 className="sb-h1">{title}</h1>
          <p className="sb-lede max-w-[560px]">{subtitle}.</p>
          <div className="flex items-center justify-center gap-3.5">
            <Thread className="hidden sm:block" style={{ width: 48 }} />
            <p className="sb-meta">
              {en ? `Last updated ${date}` : `Ultima actualizare: ${date}`} · {count}
            </p>
            <Thread className="hidden sm:block" style={{ width: 48 }} />
          </div>
        </div>
      </header>

      <section className="ed-container" style={{ paddingBottom: 72 }}>
        <ul className="list-none p-0 m-0 mx-auto grid grid-cols-1 md:grid-cols-3 gap-5" style={{ maxWidth: 1100 }}>
          {glance.map((g) => (
            <li key={g.from}>
              <figure className="m-0 h-full grid gap-3 justify-items-center content-start text-center" style={{ padding: "28px 24px", border: "1px dashed var(--gold-deep)", borderRadius: 20 }}>
                <Knot />
                <blockquote className="m-0">
                  <p className="font-display italic m-0" style={{ fontSize: 23, lineHeight: 1.3, color: "var(--parchment)" }}>
                    {en ? `“${g.quote}”` : `„${g.quote}”`}
                  </p>
                </blockquote>
                <figcaption className="sb-meta">{en ? `from “${g.from}”` : `din „${g.from}”`}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <div className="ed-container grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_280px] gap-12 xl:gap-14 items-start" style={{ paddingBottom: "clamp(72px, 9vw, 104px)" }}>
        <aside className="hidden xl:block xl:sticky" style={{ top: 112 }}>
          <p className="sb-kicker-sm mb-4" style={{ color: "var(--text-mute)" }}>{en ? "Contents" : "Cuprins"}</p>
          <ol className="sb-path" style={{ gap: 14 }}>
            {sections.map((s, i) => (
              <li key={ids[i]} className={cn("sb-path-step", i < active && "is-done", i === active && "is-now")}>
                <a href={`#${ids[i]}`} className="sb-path-label" style={{ fontSize: 17 }} aria-current={i === active ? "location" : undefined}>
                  <span className="sb-numeral mr-1.5" style={{ fontSize: 14 }}>{toRoman(i + 1)}</span>
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <div>
          {sections.map((s, i) => (
            <section key={ids[i]} id={ids[i]} className="scroll-mt-28" style={{ paddingBlock: 30, borderBottom: "1px dashed var(--line)" }}>
              <div className="flex items-baseline gap-3.5 mb-3">
                <span className="sb-numeral shrink-0" style={{ fontSize: 22, minWidth: 44 }} aria-hidden="true">{toRoman(i + 1)}</span>
                <h2 className="sb-h3" style={{ fontSize: "clamp(25px, 2.4vw, 30px)" }}>{s.heading}</h2>
              </div>
              <p className="m-0 sm:ml-[58px]" style={{ fontSize: 18.5, lineHeight: 1.78, color: "var(--text)", textWrap: "pretty" as React.CSSProperties["textWrap"] }}>
                {s.body}
              </p>
            </section>
          ))}
          <div className="sb-chapter-head mt-14" style={{ gap: 10 }}>
            <Rosette />
            <p className="sb-kicker-sm" style={{ color: "var(--text-dim)" }}>
              {en ? "That’s all of it. Thank you for reading the small print." : "Asta e tot. Mulțumim că ai citit și literele mici."}
            </p>
          </div>
        </div>

        <aside className="grid gap-5 xl:sticky" style={{ top: 112 }}>
          {aside}
        </aside>
      </div>
    </div>
  );
};
