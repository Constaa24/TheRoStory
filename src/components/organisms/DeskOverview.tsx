import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, toCamelCase, getLocalized, type Article } from "@/lib/supabase";
import { COUNTY_NAMES } from "@/lib/atlas/projection";
import { formatArticleDate, countLabel } from "@/lib/article-utils";
import { kindWord } from "@/lib/story-facts";
import { isAbortError } from "@/lib/utils";

type Lang = "en" | "ro";

/** Where each kind of story is edited. */
const editorPath = (a: Pick<Article, "id" | "type">) =>
  a.type === "video" ? `/admin/video-story/edit/${a.id}`
    : a.type === "carousel" ? `/admin/carousel-story/edit/${a.id}`
      : `/admin/text-story/edit/${a.id}`;

type Row = Pick<Article, "id" | "titleEn" | "titleRo" | "isPublished" | "location" | "createdAt" | "type" | "subtype" | "mediaUrls" | "mediaUrl">;

/**
 * The editorial desk's front page (the redesign's AdminApp, overview): the
 * archive in four numbers, the most-read stories, the drafts still on the
 * desk, and which counties have no story yet. Everything here is read from
 * the stories and their view counts as they stand; a writer sees their own.
 * (The design's 30-day reads chart needs daily view counts, which the site
 * does not keep yet, so it is left out rather than drawn from nothing.)
 */
export const DeskOverview: React.FC<{ language: Lang; onOpen: (tab: string) => void }> = ({ language, onOpen }) => {
  const en = language === "en";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [views, setViews] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [articles, counts] = await Promise.all([
        supabase.from("articles").select("id, title_en, title_ro, is_published, location, created_at, type, subtype, media_urls, media_url").order("created_at", { ascending: false }).limit(2000),
        supabase.from("article_views").select("article_id, view_count").limit(5000),
      ]);
      if (articles.error) throw articles.error;
      if (cancelled) return;
      setRows(((articles.data || []) as Record<string, unknown>[]).map((r) => toCamelCase<Row>(r)));
      const v: Record<string, number> = {};
      for (const r of (counts.data || []) as { article_id: string; view_count: number | null }[]) v[r.article_id] = r.view_count || 0;
      setViews(v);
    })().catch((error) => {
      if (isAbortError(error)) return;
      console.error("Error loading the desk overview:", error);
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, []);

  const facts = useMemo(() => {
    if (!rows) return null;
    const published = rows.filter((r) => r.isPublished);
    const drafts = rows.filter((r) => !r.isPublished);
    const written = new Set(published.map((r) => r.location).filter((l): l is string => !!l && COUNTY_NAMES.includes(l)));
    const reads = published.reduce((sum, r) => sum + (views[r.id] || 0), 0);
    const top = [...published].sort((a, b) => (views[b.id] || 0) - (views[a.id] || 0)).slice(0, 5);
    const unwritten = COUNTY_NAMES.filter((c) => !written.has(c)).sort((a, b) => a.localeCompare(b, "ro"));
    return { published, drafts, written, reads, top, unwritten };
  }, [rows, views]);

  if (failed) {
    return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--danger)" }}>{en ? "The overview could not be loaded." : "Prezentarea nu a putut fi încărcată."}</p>;
  }
  if (!facts) {
    return <p className="m-0 font-display italic" style={{ fontSize: 20, color: "var(--text-dim)" }}>{en ? "Gathering the numbers…" : "Adunăm cifrele…"}</p>;
  }

  const n = new Intl.NumberFormat(en ? "en-GB" : "ro-RO");
  const kpis: { label: string; value: string; sub: string; tab: string }[] = [
    { label: en ? "Published stories" : "Povești publicate", value: n.format(facts.published.length), sub: en ? "in the archive" : "în arhivă", tab: "articles" },
    { label: en ? "On the desk" : "Pe birou", value: n.format(facts.drafts.length), sub: en ? "drafts not yet published" : "ciorne nepublicate", tab: "articles" },
    { label: en ? "Reads" : "Citiri", value: n.format(facts.reads), sub: en ? "all time, published stories" : "de la început, povești publicate", tab: "articles" },
    { label: en ? "Counties written" : "Județe scrise", value: `${facts.written.size}/${COUNTY_NAMES.length}`, sub: en ? "with at least one story" : "cu cel puțin o poveste", tab: "articles" },
  ];

  return (
    <div className="grid gap-6">
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

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section className="rs-desk-card">
          <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0, marginBottom: 12 }}>{en ? "Most read" : "Cele mai citite"}</h2>
          {facts.top.length === 0 ? (
            <p className="m-0" style={{ color: "var(--text-dim)" }}>{en ? "Nothing published yet." : "Nimic publicat încă."}</p>
          ) : (
            <ol className="list-none m-0 p-0">
              {facts.top.map((r, i) => (
                <li key={r.id}>
                  <Link to={`/article/${r.id}`} className="rs-desk-row">
                    <span className="rs-card-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 min-w-0 font-display" style={{ fontSize: 19, lineHeight: 1.2, color: "var(--parchment)" }}>{getLocalized(r as Article, "title", language)}</span>
                    <span style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 600, color: "var(--text-mute)" }}>{countLabel(views[r.id] || 0, "view", language)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rs-desk-card">
          <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0, marginBottom: 12 }}>{en ? "On the desk" : "Pe birou"}</h2>
          {facts.drafts.length === 0 ? (
            <p className="m-0" style={{ color: "var(--text-dim)" }}>{en ? "No drafts. Everything written is published." : "Nicio ciornă. Tot ce e scris e publicat."}</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {facts.drafts.slice(0, 8).map((r) => (
                <li key={r.id} className="rs-desk-row">
                  <span className="flex-1 min-w-0">
                    <span className="block font-display" style={{ fontSize: 19, lineHeight: 1.2, color: "var(--parchment)" }}>{getLocalized(r as Article, "title", language) || (en ? "Untitled" : "Fără titlu")}</span>
                    <span className="block" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
                      {kindWord(r as Article, language)} · {formatArticleDate(r.createdAt, language, "short")}
                    </span>
                  </span>
                  <Link to={editorPath(r)} className="rs-btn rs-btn-ghost" style={{ minHeight: 36, padding: "0 14px", fontSize: 12.5 }}>{en ? "Edit" : "Editează"}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rs-desk-card">
        <h2 className="rs-display" style={{ fontSize: 26, letterSpacing: 0, marginBottom: 6 }}>{en ? "The map's blank spaces" : "Locurile goale de pe hartă"}</h2>
        <p className="m-0 mb-3" style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--text-mute)" }}>
          {en
            ? `${facts.written.size} of ${COUNTY_NAMES.length} counties have a story; ${facts.unwritten.length} still have none.`
            : `${facts.written.size} din ${COUNTY_NAMES.length} județe au o poveste; ${facts.unwritten.length} încă nu au.`}
        </p>
        <div aria-hidden="true" style={{ height: 6, borderRadius: 6, background: "var(--line-soft)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ height: "100%", width: `${(facts.written.size / COUNTY_NAMES.length) * 100}%`, background: "linear-gradient(90deg, var(--gold-deep), var(--gold))" }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {facts.unwritten.map((c) => (
            <span key={c} style={{ padding: "4px 12px", borderRadius: 999, border: "1px dashed var(--line)", fontFamily: "var(--ui)", fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)" }}>{c}</span>
          ))}
        </div>
      </section>
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
