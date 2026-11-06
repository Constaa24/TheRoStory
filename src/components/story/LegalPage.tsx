import React from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/layout/PageHead";
import { useActiveSection } from "@/hooks/use-active-section";
import { toRoman } from "@/lib/story-facts";
import { Knot, Rosette } from "@/components/story/Ornaments";

/**
 * `id` is an optional stable anchor for sections linked from elsewhere (the
 * footer's "Cookies" link goes to /privacy#cookies). Others are numbered by
 * position, which shifts whenever a section is added.
 */
export type LegalSection = { heading: string; body: string; id?: string };

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
  const ids = sections.map((s, i) => s.id ?? `section-${i + 1}`);
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
    <div className="rs-in">
      <PageHead title={title} description={subtitle} language={language} />

      <header className="ed-container" style={{ paddingTop: "clamp(40px, 6vw, 80px)" }}>
        <nav aria-label={en ? "The fine print" : "Detalii"} className="sb-seg" style={{ marginBottom: 28 }}>
          {docs.map((d) => (
            <Link key={d.key} to={d.to} className="sb-seg-btn" aria-current={d.key === current ? "page" : undefined} style={{ fontWeight: 700 }}>
              {d.label}
            </Link>
          ))}
        </nav>
        <h1 className="rs-display" style={{ margin: "0 0 12px", fontSize: "clamp(48px, 6vw, 88px)", lineHeight: 0.96 }}>{title}</h1>
        <p className="m-0 mb-2 font-display italic" style={{ fontSize: 24, color: "var(--text-dim)" }}>{subtitle}.</p>
        <p className="m-0" style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--text-mute)" }}>
          {en ? `Last updated ${date}` : `Ultima actualizare: ${date}`} · {count}
        </p>
      </header>

      {/* Three lines quoted at a glance, verbatim. */}
      <section className="ed-container" style={{ paddingTop: "clamp(32px, 4vw, 48px)", paddingBottom: "clamp(40px, 5vw, 64px)" }}>
        <ul className="list-none p-0 m-0 grid grid-cols-1 md:grid-cols-3 gap-5">
          {glance.map((g) => (
            <li key={g.from}>
              <figure className="m-0 h-full grid gap-3 content-start" style={{ padding: "24px", border: "1px dashed var(--gold-deep)", borderRadius: 20 }}>
                <Knot />
                <blockquote className="m-0">
                  <p className="font-display italic m-0" style={{ fontSize: 22, lineHeight: 1.3, color: "var(--parchment)" }}>
                    {en ? `“${g.quote}”` : `„${g.quote}”`}
                  </p>
                </blockquote>
                <figcaption style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>{en ? `from “${g.from}”` : `din „${g.from}”`}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <div className="ed-container grid grid-cols-1 xl:grid-cols-[240px_minmax(0,720px)] gap-[clamp(40px,5vw,88px)] items-start">
        <div className="hidden xl:flex xl:sticky flex-col gap-7" style={{ top: 100 }}>
          <nav aria-label={en ? "Contents" : "Cuprins"} className="rs-toc">
            <p className="rs-kicker" style={{ marginBottom: 10 }}>{en ? "Contents" : "Cuprins"}</p>
            {sections.map((s, i) => (
              <a key={ids[i]} href={`#${ids[i]}`} className="rs-toc-link" aria-current={i === active ? "location" : undefined}>{s.heading}</a>
            ))}
          </nav>
          <div className="grid gap-5">{aside}</div>
        </div>

        <div>
          {sections.map((s, i) => (
            <section key={ids[i]} id={ids[i]} style={{ paddingBottom: 36, marginBottom: 36, borderBottom: "1px solid var(--line-soft)", scrollMarginTop: 110 }}>
              <div className="flex items-baseline gap-3.5 mb-3">
                <span aria-hidden="true" className="font-display italic shrink-0" style={{ fontSize: 22, color: "var(--gold)", minWidth: 34 }}>{toRoman(i + 1)}</span>
                <h2 className="rs-display" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: 0, color: i === active ? "var(--gold-2)" : undefined }}>{s.heading}</h2>
              </div>
              <p className="m-0 sm:ml-12" style={{ fontSize: 18, lineHeight: 1.75, color: "var(--text)", textWrap: "pretty" as React.CSSProperties["textWrap"] }}>
                {s.body}
              </p>
            </section>
          ))}
          <div className="flex items-center gap-4">
            <Rosette />
            <p className="m-0 font-display italic" style={{ fontSize: 19, color: "var(--text-dim)" }}>
              {en ? "That’s all of it. Thank you for reading the small print." : "Asta e tot. Mulțumim că ai citit și literele mici."}
            </p>
          </div>
          <div className="grid gap-5 mt-10 xl:hidden">{aside}</div>
        </div>
      </div>
    </div>
  );
};
