import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getLocalized, type Article } from "@/lib/supabase";
import { COUNTY_NAMES } from "@/lib/atlas/projection";
import { formatArticleDate, countLabel } from "@/lib/article-utils";
import { kindWord } from "@/lib/story-facts";
import { isAbortError } from "@/lib/utils";
import {
  fetchAllViewCounts, fetchDailyReads, fetchDeskArticles, fetchDeskStats, lastDays, statusOf,
  type DailyRead, type DeskStats,
} from "@/lib/desk";

type Lang = "en" | "ro";

/** Where each kind of story is edited. */
export const editorPath = (a: Pick<Article, "id" | "type">) =>
  a.type === "video" ? `/admin/video-story/edit/${a.id}`
    : a.type === "carousel" ? `/admin/carousel-story/edit/${a.id}`
      : `/admin/text-story/edit/${a.id}`;

const DAYS = 30;

/**
 * The editorial desk's front page (the redesign's AdminApp, overview): four
 * numbers, reads per day over the last thirty days, the month's most-read
 * stories, what is still on the desk, and which counties have no story yet.
 * An admin's numbers are the readers, subscribers and flagged notes; a
 * writer, who can't see those, gets the archive's own. Daily reads are
 * counted from the day the desk migration (20261110120000) went live; until
 * there are thirty days of them the chart says where they begin.
 */
export const DeskOverview: React.FC<{ language: Lang; ownerId?: string; onOpen: (tab: string) => void }> = ({ language, ownerId, onOpen }) => {
  const en = language === "en";
  const [rows, setRows] = useState<Article[] | null>(null);
  const [views, setViews] = useState<Record<string, number>>({});
  const [daily, setDaily] = useState<DailyRead[]>([]);
  const [stats, setStats] = useState<DeskStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [articles, counts, reads, deskStats] = await Promise.all([
        fetchDeskArticles(ownerId),
        fetchAllViewCounts().catch(() => ({} as Record<string, number>)),
        fetchDailyReads(DAYS * 2).catch(() => [] as DailyRead[]),
        fetchDeskStats().catch(() => null),
      ]);
      if (cancelled) return;
      setRows(articles);
      setViews(counts);
      setDaily(reads);
      setStats(deskStats);
    })().catch((error) => {
      if (isAbortError(error)) return;
      console.error("Error loading the desk overview:", error);
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, [ownerId]);

  const facts = useMemo(() => {
    if (!rows) return null;
    const published = rows.filter((r) => r.isPublished);
    const waiting = rows.filter((r) => !r.isPublished);
    const written = new Set(published.map((r) => r.location).filter((l): l is string => !!l && COUNTY_NAMES.includes(l)));
    const unwritten = COUNTY_NAMES.filter((c) => !written.has(c)).sort((a, b) => a.localeCompare(b, "ro"));
    const days = lastDays(DAYS);
    const previous = lastDays(DAYS * 2).slice(0, DAYS);
    const perDay = new Map<string, number>();
    const perStory = new Map<string, number>();
    for (const r of daily) {
      perDay.set(r.day, (perDay.get(r.day) || 0) + r.views);
      if (r.day >= days[0]) perStory.set(r.articleId, (perStory.get(r.articleId) || 0) + r.views);
    }
    const bars = days.map((d) => ({ day: d, views: perDay.get(d) || 0 }));
    const reads30 = bars.reduce((sum, b) => sum + b.views, 0);
    const readsBefore = previous.reduce((sum, d) => sum + (perDay.get(d) || 0), 0);
    const firstDay = [...perDay.keys()].sort()[0] ?? null;
    // The month's most read, from the daily counts; all-time totals until
    // there are any.
    const monthly = perStory.size > 0;
    const top = published
      .map((r) => ({ r, reads: monthly ? perStory.get(r.id) || 0 : views[r.id] || 0 }))
      .filter((x) => x.reads > 0)
      .sort((a, b) => b.reads - a.reads)
      .slice(0, 5);
    return { published, waiting, written, unwritten, bars, reads30, readsBefore, firstDay, top, monthly };
  }, [rows, views, daily]);

  if (failed) {
    return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--danger)" }}>{en ? "The overview could not be loaded." : "Prezentarea nu a putut fi încărcată."}</p>;
  }
  if (!facts) {
    return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--text-dim)" }}>{en ? "Gathering the numbers…" : "Adunăm cifrele…"}</p>;
  }

  const n = new Intl.NumberFormat(en ? "en-GB" : "ro-RO");
  const pct = facts.readsBefore > 0 ? Math.round((Math.abs(facts.reads30 - facts.readsBefore) / facts.readsBefore) * 100) : 0;
  const change = facts.readsBefore > 0
    ? `${facts.reads30 >= facts.readsBefore ? "+" : "−"}${pct}% ${en ? "on the 30 days before" : "față de cele 30 de zile dinainte"}`
    : (en ? "counted day by day" : "numărate zi de zi");
  const kpis: { label: string; value: string; sub: string; tab: string }[] = stats
    ? [
        { label: en ? "Reads · 30 days" : "Citiri · 30 de zile", value: n.format(facts.reads30), sub: change, tab: "articles" },
        { label: en ? "Readers" : "Cititori", value: n.format(stats.readers), sub: en ? `+${n.format(stats.readers30d)} in 30 days` : `+${n.format(stats.readers30d)} în 30 de zile`, tab: "users" },
        { label: en ? "Subscribers" : "Abonați", value: n.format(stats.subscribers), sub: en ? `+${n.format(stats.subscribers30d)} in 30 days` : `+${n.format(stats.subscribers30d)} în 30 de zile`, tab: "newsletter" },
        { label: en ? "Flagged notes" : "Note semnalate", value: n.format(stats.flagged), sub: stats.flagged ? (en ? "waiting for a look" : "așteaptă o privire") : (en ? "the desk is clear" : "biroul e liber"), tab: "comments" },
      ]
    : [
        { label: en ? "Reads · 30 days" : "Citiri · 30 de zile", value: n.format(facts.reads30), sub: change, tab: "articles" },
        { label: en ? "Published stories" : "Povești publicate", value: n.format(facts.published.length), sub: en ? "in the archive" : "în arhivă", tab: "articles" },
        { label: en ? "On the desk" : "Pe birou", value: n.format(facts.waiting.length), sub: en ? "drafts and scheduled" : "ciorne și programate", tab: "articles" },
        { label: en ? "Counties written" : "Județe scrise", value: `${facts.written.size}/${COUNTY_NAMES.length}`, sub: en ? "with at least one story" : "cu cel puțin o poveste", tab: "articles" },
      ];

  const max = Math.max(1, ...facts.bars.map((b) => b.views));
  const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(en ? "en-GB" : "ro-RO", { day: "numeric", month: "short" });
  const best = facts.bars.reduce((a, b) => (b.views > a.views ? b : a), facts.bars[0]);
  const chartLabel = en
    ? `Reads per day over the last 30 days: ${n.format(facts.reads30)} in all${best.views ? `, the most on ${dayName(best.day)} (${n.format(best.views)})` : ""}.`
    : `Citiri pe zi în ultimele 30 de zile: ${n.format(facts.reads30)} în total${best.views ? `, cele mai multe pe ${dayName(best.day)} (${n.format(best.views)})` : ""}.`;
  const partial = !facts.firstDay || facts.firstDay > facts.bars[0].day;

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Two by two until there is room for all four in a row: never a lone card. */}
      <div className="grid gap-3 sm:gap-6 grid-cols-2 min-[1240px]:grid-cols-4">
        {kpis.map((k) => (
          <button key={k.label} type="button" className="rs-kpi" onClick={() => onOpen(k.tab)}>
            <span className="rs-kpi-label">{k.label}</span>
            <span className="rs-kpi-value">{k.value}</span>
            <span className="rs-kpi-sub">{k.sub}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        <section className="rs-desk-card">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0 }}>{en ? "Reads per day" : "Citiri pe zi"}</h2>
            <span style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 600, color: "var(--text-mute)" }}>{en ? "Last 30 days" : "Ultimele 30 de zile"}</span>
          </div>
          <div className="rs-bars" role="img" aria-label={chartLabel}>
            {facts.bars.map((b, i) => (
              <span
                key={b.day}
                className={i === facts.bars.length - 1 ? "rs-bar is-today" : "rs-bar"}
                style={{ height: `${Math.max(b.views ? 4 : 1.5, (b.views / max) * 100)}%` }}
                title={`${dayName(b.day)} · ${countLabel(b.views, "view", language)}`}
              />
            ))}
          </div>
          <div className="flex justify-between pt-2" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
            <span>{en ? "30 days ago" : "acum 30 de zile"}</span>
            <span>{en ? "Today" : "Azi"}</span>
          </div>
          {partial && (
            <p className="m-0 mt-3" style={{ fontFamily: "var(--ui)", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-mute)" }}>
              {facts.firstDay
                ? (en ? `Reads are counted day by day since ${dayName(facts.firstDay)}; earlier days have no daily count.` : `Citirile sunt numărate zi de zi din ${dayName(facts.firstDay)}; zilele dinainte nu au o numărătoare zilnică.`)
                : (en ? "Reads are counted day by day from today; the chart fills in from here." : "Citirile sunt numărate zi de zi de azi; graficul se umple de aici.")}
            </p>
          )}
        </section>

        <section className="rs-desk-card">
          <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0, marginBottom: 12 }}>
            {facts.monthly ? (en ? "Most read this month" : "Cele mai citite luna aceasta") : (en ? "Most read" : "Cele mai citite")}
          </h2>
          {facts.top.length === 0 ? (
            <p className="m-0" style={{ color: "var(--text-dim)" }}>{en ? "No reads yet." : "Încă nicio citire."}</p>
          ) : (
            <ol className="list-none m-0 p-0">
              {facts.top.map(({ r, reads }, i) => (
                <li key={r.id}>
                  <Link to={editorPath(r)} className="rs-desk-row">
                    <span className="rs-card-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 min-w-0 font-display truncate" style={{ fontSize: 19, lineHeight: 1.2, color: "var(--parchment)" }}>{getLocalized(r, "title", language)}</span>
                    <span style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 600, color: "var(--text-mute)", fontVariantNumeric: "tabular-nums" }}>{n.format(reads)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-2 items-start">
        <section className="rs-desk-card">
          <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0, marginBottom: 12 }}>{en ? "On the desk" : "Pe birou"}</h2>
          {facts.waiting.length === 0 ? (
            <p className="m-0" style={{ color: "var(--text-dim)" }}>{en ? "Nothing waiting. Everything written is published." : "Nimic în așteptare. Tot ce e scris e publicat."}</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {facts.waiting.slice(0, 8).map((r) => {
                const st = statusOf(r);
                return (
                  <li key={r.id} className="rs-desk-row">
                    <span className="flex-1 min-w-0">
                      <span className="block font-display truncate" style={{ fontSize: 19, lineHeight: 1.2, color: "var(--parchment)" }}>{getLocalized(r, "title", language) || (en ? "Untitled" : "Fără titlu")}</span>
                      <span className="block" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
                        {kindWord(r, language)} · {st === "scheduled" && r.publishAt
                          ? (en ? `goes out ${formatArticleDate(r.publishAt, language, "short")}` : `apare pe ${formatArticleDate(r.publishAt, language, "short")}`)
                          : formatArticleDate(r.createdAt, language, "short")}
                      </span>
                    </span>
                    <span className={`rs-status is-${st}`}>{st === "scheduled" ? (en ? "Scheduled" : "Programată") : (en ? "Draft" : "Ciornă")}</span>
                    <Link to={editorPath(r)} className="rs-btn rs-btn-ghost" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5 }}>{en ? "Edit" : "Editează"}</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rs-desk-card">
          <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0, marginBottom: 6 }}>{en ? "Map coverage" : "Acoperirea hărții"}</h2>
          <p className="m-0 mb-3" style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--text-mute)" }}>
            {en
              ? `${facts.written.size} of ${COUNTY_NAMES.length} counties have a story. ${facts.unwritten.length} to go.`
              : `${facts.written.size} din ${COUNTY_NAMES.length} județe au o poveste. Mai sunt ${facts.unwritten.length}.`}
          </p>
          <div aria-hidden="true" style={{ height: 8, borderRadius: 8, background: "var(--line-soft)", overflow: "hidden", marginBottom: 16 }}>
            <div style={{ height: "100%", width: `${(facts.written.size / COUNTY_NAMES.length) * 100}%`, background: "linear-gradient(90deg, var(--gold-deep), var(--gold))" }} />
          </div>
          <div className="flex flex-wrap gap-2">
            {facts.unwritten.map((c) => (
              <span key={c} style={{ padding: "4px 12px", borderRadius: 999, border: "1px dashed var(--line)", fontFamily: "var(--ui)", fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)" }}>{c}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

/**
 * "+ New story": the three kinds a story can be, each opening its editor.
 * A disclosure rather than a menu role, so it is a plain list of buttons to
 * screen readers and the keyboard, closed again by Escape or a click away.
 */
export const NewStoryMenu: React.FC<{ language: Lang; onPick: (path: string) => void }> = ({ language, onPick }) => {
  const en = language === "en";
  const [open, setOpen] = useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const kinds = [
    { path: "/admin/text-story/create", label: en ? "Written story" : "Poveste scrisă", sub: en ? "An essay, a short story or a poem" : "Un eseu, o povestire sau un poem" },
    { path: "/admin/video-story/create", label: en ? "Film" : "Film", sub: en ? "A video with subtitles and chapters" : "Un video cu subtitrare și capitole" },
    { path: "/admin/carousel-story/create", label: en ? "Visual essay" : "Eseu vizual", sub: en ? "Frames with captions" : "Cadre cu legende" },
  ];
  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="rs-btn" aria-expanded={open} aria-controls="new-story-kinds" onClick={() => setOpen((o) => !o)}>
        + {en ? "New story" : "Poveste nouă"}
      </button>
      {open && (
        <ul id="new-story-kinds" className="rs-pop rs-in list-none m-0 p-2 absolute right-0 z-30" style={{ top: "calc(100% + 10px)", width: 300 }}>
          {kinds.map((k) => (
            <li key={k.path}>
              <button type="button" className="rs-desk-kind" onClick={() => { setOpen(false); onPick(k.path); }}>
                <span className="block font-display" style={{ fontSize: 21, color: "var(--parchment)" }}>{k.label}</span>
                <span className="block" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>{k.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
