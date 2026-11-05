import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  fetchAtlasArticles, fetchArticleExcerptSource, fetchCategories, fetchJourneys, getLocalized,
  type Category, type Journey,
} from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { PageHead } from "@/components/layout/PageHead";
import { LoadError } from "@/components/ui/load-error";
import { isAbortError } from "@/lib/utils";
import { countLabel } from "@/lib/article-utils";
import {
  buildTimeScale, capitalise, centuriesSpanned, compareStories, excerpt as makeExcerpt, filtersActive, formatYear,
  matches, pick, toAtlasStory, xOf, yearOf, COUNTY_GEO, FORMATS, PLAY_DONE,
  type AtlasFilters, type AtlasKind, type AtlasStory,
} from "@/lib/atlas/model";
import AtlasMap, { type AtlasLayers, type AtlasMapHandle } from "@/components/atlas/AtlasMap";
import AtlasTimeline from "@/components/atlas/AtlasTimeline";
import AtlasToolbar, { type FilterKind } from "@/components/atlas/AtlasToolbar";
import AtlasPanel, { CountyCard, StoryCard, CARD_TITLE_ID, type AtlasTab } from "@/components/atlas/AtlasPanel";
import AtlasList from "@/components/atlas/AtlasList";
import { ATLAS_COPY, fill } from "@/components/atlas/copy";
import { useMediaQuery, useReducedMotion } from "@/components/atlas/hooks";
import "@/components/atlas/atlas.css";

/** How long "Play" takes to cross the whole timeline. */
const PLAY_MS = 16_000;
/** How long the end-of-play caption stays before the map returns to normal. */
const PLAY_LINGER_MS = 3_200;

type AtlasData = {
  stories: AtlasStory[];
  journeys: Journey[];
  categories: Category[];
};

type Play = { playing: boolean; year: number | null; pct: number };
const NOT_PLAYING: Play = { playing: false, year: null, pct: 0 };

/**
 * The Atlas: every published story on one map of Romania and one timeline,
 * with theme and format filters, a list view as the map's accessible
 * equivalent, and curated journeys. Replaces the county map at the same
 * address. Its state lives in the query string (?story=…, ?journey=…, the
 * filters), so "Back to the map" from a story lands exactly where the
 * reader left, and any view can be linked to.
 */
const MapPage: React.FC = () => {
  const { language: lang } = useLanguage();
  const copy = ATLAS_COPY[lang];
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const wide = useMediaQuery("(min-width: 1024px)");
  const reduceMotion = useReducedMotion();
  const mapRef = useRef<AtlasMapHandle>(null);

  // ---------------------------------------------------------------- data
  const [data, setData] = useState<AtlasData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setData(null);
    try {
      const [{ articles }, journeys, categories] = await Promise.all([
        fetchAtlasArticles(),
        // A failure in either of these costs a feature, not the page.
        fetchJourneys().catch((e) => { if (!isAbortError(e)) console.error("Error fetching journeys:", e); return [] as Journey[]; }),
        fetchCategories().catch(() => [] as Category[]),
      ]);
      const stories = articles.map(toAtlasStory).sort(compareStories);
      const known = new Set(stories.map((s) => s.id));
      setData({
        stories,
        journeys: journeys
          .map((j) => ({ ...j, stops: j.stops.filter((id) => known.has(id)) }))
          .filter((j) => j.stops.length > 0),
        categories,
      });
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error fetching atlas:", error);
        setLoadFailed(true);
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stories = useMemo(() => data?.stories ?? [], [data]);
  const journeys = useMemo(() => data?.journeys ?? [], [data]);
  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);
  const scale = useMemo(() => buildTimeScale(stories), [stories]);
  const countiesWithStories = useMemo(() => new Set(stories.map((s) => s.county).filter((c): c is string => !!c)), [stories]);
  const unwritten = useMemo(
    () => COUNTY_GEO.map((c) => c.name).filter((n) => !countiesWithStories.has(n)).sort((a, b) => a.localeCompare(b, "ro")),
    [countiesWithStories]
  );
  const categoryById = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c])), [data]);
  const categoryName = useCallback((id: string) => {
    const c = categoryById.get(id);
    return c ? getLocalized(c, "name", lang) : "";
  }, [categoryById, lang]);

  // ---------------------------------------------------------------- state
  const [theme, setTheme] = useState<string | null>(null);
  const [format, setFormat] = useState<AtlasKind | null>(null);
  const [rangeSel, setRangeSel] = useState<[number, number] | null>(null);
  const [showTimeless, setShowTimeless] = useState(true);
  const [layers, setLayers] = useState<AtlasLayers>({ rivers: true, regions: false, unwritten: true });
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [stop, setStop] = useState(0);
  const [tab, setTab] = useState<AtlasTab>("stories");
  const [hover, setHover] = useState<string | null>(null);
  const [play, setPlay] = useState<Play>(NOT_PLAYING);
  const [excerpts, setExcerpts] = useState<Record<string, { en: string; ro: string } | null>>({});
  const [announcement, setAnnouncement] = useState("");

  const filters: AtlasFilters = useMemo(
    () => ({ theme, format, range: rangeSel ?? [scale.start, scale.end], showTimeless }),
    [theme, format, rangeSel, showTimeless, scale]
  );
  const journey = journeys.find((j) => j.id === journeyId) ?? null;
  const stopSet = useMemo(() => (journey ? new Set(journey.stops) : null), [journey]);

  const matched = useMemo(() => new Set(stories.filter((s) => matches(s, filters, scale)).map((s) => s.id)), [stories, filters, scale]);
  // What the map shows: the filters plus the play cursor.
  const shown = useMemo(
    () => (play.year == null ? matched : new Set(stories.filter((s) => matches(s, filters, scale, play.year)).map((s) => s.id))),
    [matched, stories, filters, scale, play.year]
  );
  const list = useMemo(() => stories.filter((s) => matched.has(s.id)), [stories, matched]);
  const matchLine = `${countLabel(list.length, "story", lang)} ${list.length === 1 ? copy.matches1 : copy.matchesN}`;
  const filtersOn = filtersActive(filters, scale);

  // ---------------------------------------------------------------- playback
  const stopPlay = useCallback(() => setPlay((p) => (p.year == null && !p.playing ? p : NOT_PLAYING)), []);
  const datedYears = useMemo(() => [...new Set(stories.filter((s) => s.y0 != null).map((s) => s.y0!))].sort((a, b) => a - b), [stories]);

  // Continuous: the cursor sweeps the axis in PLAY_MS.
  useEffect(() => {
    if (!play.playing || reduceMotion) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setPlay((p) => {
        if (!p.playing) return p;
        const pct = Math.min(100, p.pct + (dt / PLAY_MS) * 100);
        return pct >= 100 ? { playing: false, year: PLAY_DONE, pct: 100 } : { playing: true, year: yearOf(scale, pct), pct };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play.playing, reduceMotion, scale]);

  // Reduced motion: no sweep — step from one story's year to the next.
  useEffect(() => {
    if (!play.playing || !reduceMotion) return;
    const t = window.setTimeout(() => {
      setPlay((p) => {
        if (!p.playing) return p;
        const next = datedYears.find((y) => y > (p.year ?? -Infinity));
        return next == null ? { playing: false, year: PLAY_DONE, pct: 100 } : { playing: true, year: next, pct: xOf(scale, next) };
      });
    }, 900);
    return () => window.clearTimeout(t);
  }, [play.playing, play.year, reduceMotion, datedYears, scale]);

  useEffect(() => {
    if (play.year !== PLAY_DONE || play.playing) return;
    const t = window.setTimeout(() => setPlay(NOT_PLAYING), PLAY_LINGER_MS);
    return () => window.clearTimeout(t);
  }, [play.year, play.playing]);

  const onPlay = () => {
    if (play.playing) { setPlay((p) => ({ ...p, playing: false })); return; }
    setJourneyId(null);
    setSelected(null);
    setSelectedCounty(null);
    setRangeSel(null);
    mapRef.current?.reset();
    setPlay((p) => (p.year == null || p.year === PLAY_DONE ? { playing: true, year: scale.start, pct: 0 } : { ...p, playing: true }));
  };

  const readout = useMemo(() => {
    if (play.year == null) return null;
    if (play.year === PLAY_DONE) return { year: "✦", caption: copy.playEnd };
    let latest: AtlasStory | null = null;
    for (const s of stories) if (s.y0 != null && s.y0 <= play.year && (!latest || s.y0 >= latest.y0!)) latest = s;
    return {
      year: formatYear(Math.round(play.year), lang),
      caption: latest ? `${pick(latest.title, lang)} · ${pick(latest.place, lang)}` : "",
    };
  }, [play.year, stories, copy, lang]);

  // ---------------------------------------------------------------- actions
  const focusCardTitle = useCallback(() => {
    requestAnimationFrame(() => document.getElementById(CARD_TITLE_ID)?.focus({ preventScroll: wide }));
  }, [wide]);

  const selectStory = useCallback((id: string, opts: { fly?: boolean; focus?: boolean } = {}) => {
    const s = byId.get(id);
    if (!s) return;
    stopPlay();
    if (journey && journey.stops.includes(id)) setStop(journey.stops.indexOf(id));
    else {
      setJourneyId(null);
      setTab("stories");
    }
    setSelected(id);
    setSelectedCounty(null);
    if (s.x != null && view === "map" && opts.fly !== false) mapRef.current?.focusStory(s);
    if (opts.focus !== false) focusCardTitle();
  }, [byId, journey, view, stopPlay, focusCardTitle]);

  const selectCounty = useCallback((name: string) => {
    stopPlay();
    setSelectedCounty(name);
    setSelected(null);
    setJourneyId(null);
    setTab("unwritten");
    if (view === "map") mapRef.current?.fitCounty(name);
    focusCardTitle();
  }, [view, stopPlay, focusCardTitle]);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setSelectedCounty(null);
  }, []);

  const goToStop = useCallback((j: Journey, i: number, fitAll = false) => {
    const at = Math.max(0, Math.min(i, j.stops.length - 1));
    const s = byId.get(j.stops[at]);
    if (!s) return;
    setStop(at);
    setSelected(s.id);
    setSelectedCounty(null);
    const placed = j.stops.map((id) => byId.get(id)).filter((x): x is AtlasStory => !!x && x.x != null);
    if (fitAll && placed.length > 1) mapRef.current?.fitPoints(placed.map((x) => [x.x!, x.y!]), 14, 80);
    else if (s.x != null) mapRef.current?.focusStory(s);
    focusCardTitle();
  }, [byId, focusCardTitle]);

  const startJourney = useCallback((id: string, at = 0) => {
    const j = journeys.find((x) => x.id === id);
    if (!j) return;
    stopPlay();
    setJourneyId(id);
    setTab("journeys");
    setView("map");
    setTheme(null);
    setFormat(null);
    setRangeSel(null);
    setShowTimeless(true);
    goToStop(j, at, true);
  }, [journeys, stopPlay, goToStop]);

  const leaveJourney = useCallback(() => {
    setJourneyId(null);
    setSelected(null);
    mapRef.current?.reset();
  }, []);

  const clearFilter = (kind: FilterKind) => {
    stopPlay();
    if (kind === "theme" || kind === "all") setTheme(null);
    if (kind === "format" || kind === "all") setFormat(null);
    if (kind === "range" || kind === "all") setRangeSel(null);
    if (kind === "timeless" || kind === "all") setShowTimeless(true);
  };

  // A story filtered out of view stops being the selection (journey stops
  // stay: a journey resets the filters and shows every stop regardless).
  useEffect(() => {
    if (selected && play.year == null && !matched.has(selected) && !stopSet?.has(selected)) setSelected(null);
  }, [selected, matched, stopSet, play.year]);

  // Say how many stories match whenever the filters change.
  const filterSignature = JSON.stringify([theme, format, rangeSel, showTimeless]);
  const lastSignature = useRef(filterSignature);
  useEffect(() => {
    if (lastSignature.current === filterSignature || !data) return;
    lastSignature.current = filterSignature;
    setAnnouncement("");
    const raf = requestAnimationFrame(() => setAnnouncement(matchLine));
    return () => cancelAnimationFrame(raf);
  }, [filterSignature, matchLine, data]);

  // Escape: close the selection, else leave the journey. A popover that
  // handled Escape itself marks it handled first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (selected || selectedCounty) {
        clearSelection();
        mapRef.current?.focus();
      } else if (journeyId) leaveJourney();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, selectedCounty, journeyId, clearSelection, leaveJourney]);

  // The card's excerpt, fetched for the one story a reader opens.
  const cardStory = selected ? byId.get(selected) : undefined;
  useEffect(() => {
    if (!cardStory || cardStory.id in excerpts) return;
    let cancelled = false;
    fetchArticleExcerptSource(cardStory.id)
      .then((src) => {
        const poem = cardStory.kind === "poem";
        if (!cancelled) setExcerpts((m) => ({ ...m, [cardStory.id]: src && { en: makeExcerpt(src.en, 170, poem), ro: makeExcerpt(src.ro, 170, poem) } }));
      })
      .catch((e) => {
        if (isAbortError(e)) return;
        console.error("Error fetching excerpt:", e);
        if (!cancelled) setExcerpts((m) => ({ ...m, [cardStory.id]: null }));
      });
    return () => { cancelled = true; };
  }, [cardStory, excerpts]);

  // ---------------------------------------------------------------- URL state
  const categoryBySlug = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.slug, c])), [data]);
  const initialised = useRef(false);

  // Restore a linked or returned-to view once the stories are in.
  useEffect(() => {
    if (!data || initialised.current) return;
    initialised.current = true;
    const p = searchParams;
    const themeCat = p.get("theme") ? categoryBySlug.get(p.get("theme")!) : undefined;
    if (themeCat) setTheme(themeCat.id);
    const f = p.get("format");
    if (f && (FORMATS as string[]).includes(f)) setFormat(f as AtlasKind);
    const from = Number(p.get("from"));
    const to = Number(p.get("to"));
    if (p.has("from") && p.has("to") && Number.isFinite(from) && Number.isFinite(to) && from < to) {
      setRangeSel([Math.max(scale.start, from), Math.min(scale.end, to)]);
    }
    if (p.get("timeless") === "0") setShowTimeless(false);
    if (p.get("view") === "list") setView("list");

    const j = p.get("journey") ? data.journeys.find((x) => x.id === p.get("journey")) : undefined;
    const storyId = p.get("story");
    // The old county map was opened with a county in router state; honour
    // that, and ?county= for a county that still has no story.
    const county = p.get("county") || (location.state as { selectedLocation?: string } | null)?.selectedLocation || null;
    requestAnimationFrame(() => {
      if (j) {
        setJourneyId(j.id);
        setTab("journeys");
        const at = Math.max(0, (Number(p.get("stop")) || 1) - 1);
        goToStop(j, at, !p.has("stop"));
      } else if (storyId && byId.has(storyId)) {
        selectStory(storyId, { focus: false });
      } else if (county && COUNTY_GEO.some((c) => c.name === county)) {
        if (countiesWithStories.has(county)) {
          const pts = stories.filter((s) => s.county === county && s.x != null).map((s) => [s.x!, s.y!] as [number, number]);
          mapRef.current?.fitPoints(pts, pts.length > 1 ? 14 : 4, 90);
        } else {
          setSelectedCounty(county);
          setTab("unwritten");
          mapRef.current?.fitCounty(county);
        }
      }
    });
    // Runs once, when the data first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Keep the query string in step, without adding history entries.
  useEffect(() => {
    if (!initialised.current) return;
    const p = new URLSearchParams();
    if (journeyId) {
      p.set("journey", journeyId);
      p.set("stop", String(stop + 1));
    } else if (selected) p.set("story", selected);
    else if (selectedCounty) p.set("county", selectedCounty);
    const themeSlug = theme ? categoryById.get(theme)?.slug : undefined;
    if (themeSlug) p.set("theme", themeSlug);
    if (format) p.set("format", format);
    if (rangeSel) {
      p.set("from", String(rangeSel[0]));
      p.set("to", String(rangeSel[1]));
    }
    if (!showTimeless) p.set("timeless", "0");
    if (view === "list") p.set("view", "list");
    if (p.toString() !== searchParams.toString()) setSearchParams(p, { replace: true, preventScrollReset: true });
  }, [journeyId, stop, selected, selectedCounty, theme, format, rangeSel, showTimeless, view, categoryById, searchParams, setSearchParams]);

  const from = `/map${location.search}`;

  // ---------------------------------------------------------------- render helpers
  const partOf = (id: string) =>
    journeys.filter((j) => j.stops.includes(id)).map((j) => ({ journey: j, at: j.stops.indexOf(id) }));
  const excerptFor = (id: string): string | undefined => {
    if (!(id in excerpts)) return undefined;
    const e = excerpts[id];
    return e ? pick([e.en, e.ro], lang) : "";
  };
  const renderStoryCard = (s: AtlasStory, inPanel: boolean) => (
    <StoryCard
      story={s}
      categoryName={categoryName(s.categoryId)}
      excerpt={excerptFor(s.id)}
      partOf={partOf(s.id)}
      onJourney={startJourney}
      onClose={inPanel ? undefined : clearSelection}
      from={from}
      copy={copy}
      lang={lang}
    />
  );

  const themes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stories) counts.set(s.categoryId, (counts.get(s.categoryId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: categoryName(id), count }))
      .filter((t) => t.name)
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [stories, categoryName, lang]);
  const formatCounts = useMemo(() => {
    const counts: Partial<Record<AtlasKind, number>> = {};
    for (const s of stories) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    return counts;
  }, [stories]);

  const span = centuriesSpanned(stories, lang);
  const headline = span ? capitalise(fill(copy.headline, { span })) : copy.headlinePlain;
  const playLabel = play.playing
    ? copy.pause
    : play.year != null && play.year !== PLAY_DONE
      ? copy.resume
      : span ? fill(copy.play, { span }) : copy.playPlain;
  const dated = stories.filter((s) => s.y0 != null);
  const facts: [string, string][] = [
    [copy.statStories, String(stories.length)],
    [copy.statCounties, `${countiesWithStories.size}/${COUNTY_GEO.length}`],
    ...(dated.length
      ? [[copy.statSpan, `${formatYear(Math.min(...dated.map((s) => s.y0!)), lang)}–${formatYear(Math.max(...dated.map((s) => s.y1!)), lang)}`] as [string, string]]
      : []),
    ...(journeys.length ? [[copy.statJourneys, String(journeys.length)] as [string, string]] : []),
  ];

  const sheetCard = !wide && (selected || selectedCounty)
    ? (selected && byId.has(selected)
        ? renderStoryCard(byId.get(selected)!, false)
        : selectedCounty ? <CountyCard name={selectedCounty} onClose={clearSelection} copy={copy} /> : null)
    : null;

  return (
    <div className="atlas-page screen-anim">
      <PageHead title={copy.pageTitle} description={copy.pageDescription} language={lang} />
      <div className="ed-container">
        <section className="at-intro">
          <div>
            <p className="eyebrow m-0">{copy.eyebrow}</p>
            <h1>{headline}</h1>
            <p className="at-lede">{copy.lede}</p>
          </div>
          {data && (
            <ul className="at-facts">
              {facts.map(([k, v]) => <li key={k}><b>{v}</b><span>{k}</span></li>)}
            </ul>
          )}
        </section>

        {!data && !loadFailed && (
          <div className="at-loading">
            <div className="flex flex-col items-center gap-4">
              <span aria-hidden="true" className="sb-rosette sb-rosette-lg sb-rosette-turn" />
              <p className="font-display italic text-gold">{copy.loading}</p>
            </div>
          </div>
        )}

        {loadFailed && <LoadError onRetry={load} />}

        {data && (
          <>
            <AtlasToolbar
              themes={themes}
              formatCounts={formatCounts}
              total={stories.length}
              filters={filters}
              scale={scale}
              layers={layers}
              view={view}
              onTheme={(id) => { stopPlay(); setTheme(id); }}
              onFormat={(k) => { stopPlay(); setFormat(k); }}
              onLayer={(id) => setLayers((l) => ({ ...l, [id]: !l[id] }))}
              onView={setView}
              onClear={clearFilter}
              copy={copy}
              lang={lang}
            />

            <div className="at-grid">
              <div className="at-plate">
                <AtlasMap
                  ref={mapRef}
                  stories={stories}
                  shown={shown}
                  stops={journey ? journey.stops : null}
                  journeyKey={journeyId}
                  selected={selected}
                  selectedCounty={selectedCounty}
                  hover={hover}
                  onHover={setHover}
                  onSelectStory={(id) => selectStory(id)}
                  onSelectCounty={selectCounty}
                  countiesWithStories={countiesWithStories}
                  layers={layers}
                  copy={copy}
                  lang={lang}
                  playing={play.year != null}
                  readout={readout}
                  reduceMotion={reduceMotion}
                  hidden={view !== "map"}
                />
                {view === "list" && (
                  <AtlasList list={list} scale={scale} selected={selected} onSelect={(id) => selectStory(id)} categoryName={categoryName} copy={copy} lang={lang} />
                )}
                <AtlasTimeline
                  stories={stories}
                  scale={scale}
                  range={filters.range}
                  showTimeless={showTimeless}
                  onRange={(r) => { stopPlay(); setRangeSel(r[0] <= scale.start && r[1] >= scale.end ? null : r); }}
                  onToggleTimeless={() => { stopPlay(); setShowTimeless((v) => !v); }}
                  matched={shown}
                  stops={stopSet}
                  selected={selected}
                  hover={hover}
                  onHover={setHover}
                  onSelect={(id) => selectStory(id)}
                  playing={play.playing}
                  cursorPct={play.year != null && play.year !== PLAY_DONE ? play.pct : null}
                  playLabel={playLabel}
                  onPlay={onPlay}
                  copy={copy}
                  lang={lang}
                />
              </div>

              <AtlasPanel
                tab={tab}
                onTab={setTab}
                wide={wide}
                list={list}
                byId={byId}
                scale={scale}
                matchLine={matchLine}
                filtersOn={filtersOn}
                onClearFilters={() => clearFilter("all")}
                selected={selected}
                selectedCounty={selectedCounty}
                hover={hover}
                onHover={setHover}
                onSelect={(id) => selectStory(id)}
                onSelectCounty={selectCounty}
                onBack={clearSelection}
                unwritten={unwritten}
                journeys={journeys}
                journey={journey}
                stop={stop}
                onStartJourney={startJourney}
                onStop={(i) => journey && goToStop(journey, i)}
                onLeaveJourney={leaveJourney}
                renderStoryCard={renderStoryCard}
                copy={copy}
                lang={lang}
              />
            </div>

            <section className="at-notes" aria-labelledby="at-notes-title">
              <h2 id="at-notes-title">{copy.notesTitle}</h2>
              <p>{copy.notesData}</p>
              <p>{copy.notesPlaces}</p>
            </section>
          </>
        )}
      </div>

      {/* Portalled to <body>: the page wrapper's entrance animation leaves a
          transform on it, and a transformed ancestor turns position:fixed
          into "fixed to that ancestor" — the sheet would sit at the foot of
          the page instead of the foot of the screen. */}
      {sheetCard && createPortal(
        <div className="at-portal">
          <div className="at-sheet" role="dialog" aria-modal="false" aria-labelledby={CARD_TITLE_ID}>
            <div className="at-sheet-grab" aria-hidden="true" />
            {sheetCard}
          </div>
        </div>,
        document.body
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
};

export default MapPage;
