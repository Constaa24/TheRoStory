import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as topojson from "topojson-client";
import * as d3 from "d3-geo";
import countiesTopoData from "@/lib/counties_topo";
import { fetchMapArticles, Article, getLocalized } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { StoryThumbnail } from "@/components/ui/story-thumbnail";
import { X, MapPin, ChevronRight, Maximize2, Minimize2, RotateCcw, ArrowLeft } from "lucide-react";
import { cn, isAbortError } from "@/lib/utils";
import { PageHead } from "@/components/layout/PageHead";
import { articleCoverUrl } from "@/lib/article-utils";
import { getArticleKindLabel } from "@/components/organisms/EditorialArticle";

// Choropleth tiers — counties get progressively warmer as story density grows.
// Mapped to direct gold/oxblood opacities to fit the editorial palette.
const STORY_DENSITY_TIERS: Array<{
  min: number;
  max: number;
  label: string;
  fillOpacity: number;
  hoverOpacity: number;
}> = [
  { min: 1, max: 2, label: "1–2", fillOpacity: 0.18, hoverOpacity: 0.32 },
  { min: 3, max: 5, label: "3–5", fillOpacity: 0.34, hoverOpacity: 0.5 },
  { min: 6, max: 10, label: "6–10", fillOpacity: 0.55, hoverOpacity: 0.7 },
  { min: 11, max: Infinity, label: "11+", fillOpacity: 0.78, hoverOpacity: 0.9 },
];

const tierForCount = (count: number) => {
  if (count <= 0) return null;
  return STORY_DENSITY_TIERS.find((t) => count >= t.min && count <= t.max) ?? STORY_DENSITY_TIERS[STORY_DENSITY_TIERS.length - 1];
};

const MAP_VIEW_W = 800;
const MAP_VIEW_H = 600;
const ZOOM_SCALE = 2.2;

const MapPage: React.FC = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoverCounty, setHoverCounty] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  type CountyPath = { id: string; name: string; d: string; lx: number; ly: number };
  const { paths } = useMemo<{ paths: CountyPath[] }>(() => {
    const geojson = topojson.feature(countiesTopoData, countiesTopoData.objects["romania.counties"]);
    const features = "features" in geojson ? geojson.features : [geojson];
    const projection = d3.geoMercator().fitSize([MAP_VIEW_W, MAP_VIEW_H], geojson);
    const pathGenerator = d3.geoPath().projection(projection);

    const countyPaths: CountyPath[] = features.map((feature) => {
      let name: string = feature.properties?.name ?? "";
      if (name === "SatuMare") name = "Satu Mare";
      const centroid = pathGenerator.centroid(feature);
      return { id: name, name, d: pathGenerator(feature) || "", lx: centroid[0], ly: centroid[1] };
    });
    return { paths: countyPaths };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchMapArticles()
      .then((data) => { if (!cancelled) setArticles(data || []); })
      .catch((error) => { if (!isAbortError(error)) console.error("Error fetching data:", error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    const state = location.state as { selectedLocation?: string } | null;
    if (state?.selectedLocation) {
      setSelectedLocation(state.selectedLocation);
      setIsZoomed(true);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storiesPerLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach(art => {
      if (art.location) counts[art.location] = (counts[art.location] || 0) + 1;
    });
    return counts;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (!selectedLocation) return [];
    return articles.filter(art => art.location === selectedLocation);
  }, [selectedLocation, articles]);

  const allLocationsByCount = useMemo(() => {
    return Object.entries(storiesPerLocation)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [storiesPerLocation]);

  const handleLocationClick = useCallback((loc: string) => {
    if (selectedLocation === loc) {
      setSelectedLocation(null);
      setIsZoomed(false);
    } else {
      setSelectedLocation(loc);
      setIsZoomed(true);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (!selectedLocation) return;
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) return;
    const id = window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => window.clearTimeout(id);
  }, [selectedLocation]);

  const closeList = useCallback(() => { setSelectedLocation(null); setIsZoomed(false); }, []);

  const selectedPath = useMemo(() => paths.find(p => p.id === selectedLocation), [selectedLocation, paths]);

  useEffect(() => {
    if (!isAnimating) return;
    const id = window.setTimeout(() => setIsAnimating(false), 1800);
    return () => window.clearTimeout(id);
  }, [isAnimating]);

  const mapTitle = language === 'en' ? "Story Map" : "Harta Poveștilor";
  const mapDescription = language === 'en'
    ? "Explore Romania's rich cultural heritage through location-based storytelling — click any county to discover its stories."
    : "Explorează bogatul patrimoniu cultural al României prin povești bazate pe locație — apasă orice județ pentru a-i descoperi poveștile.";

  return (
    <div className="screen-anim pb-20">
      <PageHead title={mapTitle} description={mapDescription} language={language} />

      {/* PAGE HERO */}
      <section style={{ padding: '80px 0 56px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr] gap-14 items-end">
            <div>
              <div className="eyebrow mb-4">{language === 'en' ? 'Cartography of memory' : 'Cartografia memoriei'}</div>
              <h1
                className="font-display italic font-medium m-0"
                style={{
                  fontSize: 'clamp(56px, 8vw, 120px)',
                  lineHeight: 0.95,
                  letterSpacing: '-0.01em',
                  color: 'var(--parchment)',
                  textWrap: 'balance' as React.CSSProperties['textWrap'],
                  whiteSpace: 'pre-line',
                }}
              >
                {language === 'en' ? 'Find a story\non the map.' : 'Găsește o poveste\npe hartă.'}
              </h1>
              <p className="mt-7 max-w-[540px]" style={{ fontSize: 19, color: 'var(--text-dim)', lineHeight: 1.55 }}>
                {language === 'en'
                  ? 'Each pin is a place. Each place is a story still being told. Pan the country, follow the rivers, and pick a thread to pull.'
                  : 'Fiecare loc este o poveste încă spusă. Plimbă-te prin țară, urmează râurile, alege un fir.'}
              </p>
            </div>
            <div className="hidden lg:block">
              <div className="grid grid-cols-3 gap-4">
                <Stat value={Object.keys(storiesPerLocation).length} label={language === 'en' ? 'Active regions' : 'Regiuni active'} />
                <Stat value={articles.filter(a => a.location).length} label={language === 'en' ? 'Pinned stories' : 'Povești fixate'} />
                <Stat value={paths.length} label={language === 'en' ? 'Counties' : 'Județe'} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAP GRID */}
      <section style={{ padding: '60px 0 120px' }}>
        <div className="ed-container">
          {isLoading && (
            <div className="flex h-[40vh] items-center justify-center">
              <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="h-10 w-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
                <p className="font-display italic text-gold">{t("common.loading")}</p>
              </div>
            </div>
          )}

          {!isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 items-start">
              <div className="lg:sticky lg:top-24">
                <div
                  className="relative overflow-hidden p-3 sm:p-6 sm:pb-14"
                  style={{
                    background: 'radial-gradient(ellipse at 50% 40%, rgba(var(--line-rgb), 0.06), transparent 60%), var(--ink-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 4,
                    aspectRatio: '4/3',
                  }}
                >
                  {/* Compass — decorative, hidden on phones where it would overlap the map */}
                  <div className="hidden sm:flex absolute top-6 right-7 flex-col items-center gap-1.5 font-ui text-[10px] uppercase" style={{ letterSpacing: '0.2em', color: 'var(--text-mute)' }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="14" stroke="var(--line)" />
                      <path d="M16 4 L19 16 L16 28 L13 16 Z" fill="var(--gold)" opacity=".4" />
                      <path d="M16 4 L19 16 L16 16 Z" fill="var(--gold)" />
                    </svg>
                    <span>N</span>
                  </div>

                  {/* Coords (decorative) — hidden on phones */}
                  <div className="hidden sm:block absolute top-6 left-7 font-display italic text-[13px]" style={{ color: 'var(--text-mute)' }}>
                    44.4°N · 26.1°E
                  </div>

                  {/* Zoom / reset controls — overlaid on tablet+, moved below the map on phones */}
                  <div className="hidden sm:flex absolute bottom-6 left-7 z-10 flex-col gap-2">
                    <button
                      className="grid w-10 h-10 rounded-full place-items-center transition-colors"
                      style={{ border: '1px solid var(--line)', background: 'var(--ink)', color: 'var(--text)' }}
                      onClick={() => setIsZoomed(!isZoomed)}
                      title={isZoomed ? t("map.zoomOut") : t("map.zoomIn")}
                      aria-label={isZoomed ? t("map.zoomOut") : t("map.zoomIn")}
                    >
                      {isZoomed ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                      className="grid w-10 h-10 rounded-full place-items-center transition-colors"
                      style={{ border: '1px solid var(--line)', background: 'var(--ink)', color: 'var(--text)' }}
                      onClick={() => { setSelectedLocation(null); setIsZoomed(false); }}
                      title={t("map.reset")}
                      aria-label={t("map.reset")}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scale — hidden on phones (shown below the map instead) */}
                  <div className="hidden sm:block absolute bottom-6 right-7 font-ui text-[10px] uppercase" style={{ letterSpacing: '0.2em', color: 'var(--text-mute)' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ width: 60, height: 1, background: 'var(--gold)', display: 'inline-block' }} />
                      <span>100 KM</span>
                    </div>
                  </div>

                  {/* Paper grid pattern definition */}
                  <motion.div
                    className="w-full h-full"
                    // Pan is expressed as a percentage of the element's OWN
                    // rendered size, not the viewBox units. centroid lx/ly are
                    // in the 0–800 × 0–600 viewBox space; framer-motion applies
                    // x/y as CSS pixels, so a raw `-(lx - 400) * scale` only
                    // lined up when the map happened to render at 800px wide and
                    // overshot toward the corners everywhere else (badly on
                    // mobile, where the container is ~350px). As a percentage it
                    // resolves against the actual rendered box and is correct at
                    // any size. (At 800px wide this equals the old value.)
                    animate={{
                      scale: isZoomed ? ZOOM_SCALE : 1,
                      x: isZoomed && selectedPath ? `${-ZOOM_SCALE * (selectedPath.lx / MAP_VIEW_W - 0.5) * 100}%` : "0%",
                      y: isZoomed && selectedPath ? `${-ZOOM_SCALE * (selectedPath.ly / MAP_VIEW_H - 0.5) * 100}%` : "0%",
                    }}
                    transition={{ type: "spring", stiffness: 80, damping: 15 }}
                    onAnimationStart={() => setIsAnimating(true)}
                    onAnimationComplete={() => setIsAnimating(false)}
                  >
                    <svg
                      viewBox={`0 0 ${MAP_VIEW_W} ${MAP_VIEW_H}`}
                      className={cn("w-full h-full transition-all duration-300", isAnimating && "pointer-events-none")}
                      style={{ shapeRendering: 'geometricPrecision' }}
                      role="img"
                      aria-label={language === 'en' ? "Map of Romania's counties" : "Harta județelor României"}
                    >
                      <defs>
                        <pattern id="paper-grid" patternUnits="userSpaceOnUse" width="40" height="40">
                          <rect width="40" height="40" fill="rgba(var(--line-rgb), 0.04)" />
                          <path d="M0 20h40M20 0v40" stroke="rgba(var(--line-rgb), 0.15)" strokeWidth="0.5" />
                        </pattern>
                        <filter id="map-glow">
                          <feGaussianBlur stdDeviation="3" />
                        </filter>
                      </defs>

                      {/* Paper backdrop fill */}
                      <rect width={MAP_VIEW_W} height={MAP_VIEW_H} fill="url(#paper-grid)" />

                      {paths.map((county) => {
                        const id = county.id;
                        const count = storiesPerLocation[id] || 0;
                        const isSelected = selectedLocation === id;
                        const isHovered = hoverCounty === id;
                        const tier = tierForCount(count);
                        const fillOpacity = isSelected ? 1 : (isHovered && tier ? tier.hoverOpacity : (tier ? tier.fillOpacity : 0.04));

                        const ariaLabel = count > 0
                          ? `${county.name} — ${count} ${count === 1 ? t("map.storyOne") : t("map.storyMany")}`
                          : `${county.name} — ${t("map.legendNone")}`;

                        return (
                          <g
                            key={id}
                            role="button"
                            tabIndex={0}
                            aria-label={ariaLabel}
                            aria-pressed={isSelected}
                            onClick={() => !isAnimating && handleLocationClick(id)}
                            onMouseEnter={() => setHoverCounty(id)}
                            onMouseLeave={() => setHoverCounty(null)}
                            onKeyDown={(e) => {
                              if (isAnimating) return;
                              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLocationClick(id); }
                            }}
                            className={cn("cursor-pointer outline-none", isAnimating && "pointer-events-none")}
                            style={{ transition: 'fill-opacity .2s' }}
                          >
                            <path
                              d={county.d}
                              fill="var(--gold)"
                              fillOpacity={fillOpacity}
                              stroke={isSelected ? "var(--gold)" : "var(--gold-deep)"}
                              strokeWidth={isSelected ? 1.6 : 0.6}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              // Only the properties that actually change on
                              // hover/select. `all` made the browser watch
                              // every property (incl. transform) on all 42
                              // paths during the zoom — wasted work that added
                              // to the hitch.
                              style={{ transition: 'fill-opacity .25s, stroke .25s, stroke-width .25s' }}
                            />

                            {/* County label — only visible on hover/select */}
                            {(isSelected || isHovered) && (
                              <text
                                x={county.lx}
                                y={county.ly - 3}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontFamily="var(--display)"
                                fontStyle="italic"
                                fontSize="11"
                                fill={isSelected ? "var(--ink)" : "var(--gold)"}
                                style={{ pointerEvents: 'none', transition: 'fill .2s' }}
                              >
                                {county.name}
                              </text>
                            )}

                            {count > 0 && (
                              <>
                                <circle
                                  cx={county.lx}
                                  cy={county.ly + (isSelected || isHovered ? 12 : 0)}
                                  r="9"
                                  fill={isSelected ? "var(--ink)" : "var(--ink-2)"}
                                  stroke="var(--gold)"
                                  strokeWidth="1.5"
                                  style={{ pointerEvents: 'none' }}
                                />
                                <circle cx={county.lx} cy={county.ly + (isSelected || isHovered ? 12 : 0)} r="3" fill="var(--gold)" style={{ pointerEvents: 'none' }} />
                                <text
                                  x={county.lx + 14}
                                  y={county.ly + (isSelected || isHovered ? 12 : 0)}
                                  textAnchor="start"
                                  dominantBaseline="middle"
                                  fontFamily="var(--ui)"
                                  fontSize="9"
                                  fill="var(--gold)"
                                  letterSpacing="0.15em"
                                  style={{ pointerEvents: 'none' }}
                                >
                                  {count}
                                </text>
                              </>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </motion.div>
                </div>

                {/* Mobile control strip — phones only, replaces the overlaid zoom/scale */}
                <div className="sm:hidden flex items-center justify-between mt-4">
                  <div className="flex gap-2">
                    <button
                      className="grid w-10 h-10 rounded-full place-items-center transition-colors"
                      style={{ border: '1px solid var(--line)', background: 'var(--ink)', color: 'var(--text)' }}
                      onClick={() => setIsZoomed(!isZoomed)}
                      title={isZoomed ? t("map.zoomOut") : t("map.zoomIn")}
                      aria-label={isZoomed ? t("map.zoomOut") : t("map.zoomIn")}
                    >
                      {isZoomed ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                      className="grid w-10 h-10 rounded-full place-items-center transition-colors"
                      style={{ border: '1px solid var(--line)', background: 'var(--ink)', color: 'var(--text)' }}
                      onClick={() => { setSelectedLocation(null); setIsZoomed(false); }}
                      title={t("map.reset")}
                      aria-label={t("map.reset")}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="font-ui text-[10px] uppercase flex items-center gap-2" style={{ letterSpacing: '0.2em', color: 'var(--text-mute)' }}>
                    <span style={{ width: 40, height: 1, background: 'var(--gold)', display: 'inline-block' }} />
                    <span>100 KM</span>
                  </div>
                </div>

                {/* Legend strip */}
                <div className="flex flex-wrap items-center gap-6 mt-10 font-ui text-[11px] uppercase" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full" style={{ width: 8, height: 8, background: 'var(--gold)' }} />
                    {language === 'en' ? 'Story pinned' : 'Poveste fixată'}
                  </span>
                  <span className="flex items-center gap-2">
                    <span style={{ width: 14, height: 1, background: 'var(--gold)' }} />
                    {language === 'en' ? 'Border' : 'Graniță'}
                  </span>
                  <span className="ml-auto">
                    {Object.values(storiesPerLocation).reduce((a, b) => a + b, 0)} {language === 'en' ? 'stories pinned' : 'povești fixate'}
                  </span>
                </div>
              </div>

              {/* SIDEBAR */}
              <aside className="flex flex-col gap-8">
                {/* Active story panel */}
                <AnimatePresence>
                  {selectedLocation && (
                    <motion.div
                      ref={panelRef}
                      key={selectedLocation}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      style={{ border: '1px solid var(--line)', padding: 28, background: 'var(--overlay-panel)' }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="eyebrow flex items-center gap-2"><MapPin className="w-3 h-3" /> {selectedLocation}</span>
                        <button
                          onClick={closeList}
                          aria-label="Close"
                          className="grid w-7 h-7 rounded-full place-items-center transition-colors hover:text-gold"
                          style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-dim)' }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h3 className="font-display italic font-medium m-0" style={{ fontSize: 28, lineHeight: 1.1, color: 'var(--parchment)' }}>
                        {filteredArticles.length} {filteredArticles.length === 1 ? (language === 'en' ? 'story' : 'poveste') : (language === 'en' ? 'stories' : 'povești')}
                      </h3>
                      <p className="text-ink-dim mt-2" style={{ fontSize: 14 }}>
                        {language === 'en' ? `Pinned to ${selectedLocation}.` : `Fixate în ${selectedLocation}.`}
                      </p>

                      <div className="mt-6 flex flex-col gap-3">
                        {filteredArticles.length > 0 ? filteredArticles.map(art => (
                          <button
                            key={art.id}
                            onClick={() => navigate(`/article/${art.id}`, { state: { from: '/map', selectedLocation } })}
                            className="flex items-center gap-4 p-3 cursor-pointer transition-colors text-left"
                            style={{ border: '1px solid var(--line-soft)', background: 'transparent' }}
                          >
                            <div className="shrink-0 w-14 h-14 overflow-hidden" style={{ border: '1px solid var(--line)' }}>
                              {art.type === 'video'
                                ? <StoryThumbnail posterUrl={art.posterUrl} className="w-full h-full object-cover" />
                                : (() => {
                                    const cover = articleCoverUrl(art);
                                    return cover
                                      ? <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                                      : <div className="w-full h-full ph" data-tone="warm" />;
                                  })()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-ui text-[10px] uppercase mb-1" style={{ letterSpacing: '0.18em', color: 'var(--gold)' }}>
                                {getArticleKindLabel(art, language)}
                              </div>
                              <div className="font-display italic text-[17px] leading-tight line-clamp-2" style={{ color: 'var(--parchment)' }}>
                                {getLocalized(art, 'title', language)}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-mute)' }} />
                          </button>
                        )) : (
                          <p className="font-display italic text-ink-dim text-center py-6">{t("map.noStories")}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!selectedLocation && (
                  <div style={{ border: '1px solid var(--line)', padding: 28, background: 'var(--overlay-panel-soft)' }}>
                    <div className="eyebrow mb-3.5">{language === 'en' ? 'How to read this' : 'Cum se citește'}</div>
                    <h3 className="font-display italic font-medium m-0" style={{ fontSize: 24, lineHeight: 1.15, color: 'var(--parchment)' }}>
                      {language === 'en' ? 'Tap a county to pull a thread.' : 'Apasă un județ pentru a trage de un fir.'}
                    </h3>
                    <p className="text-ink-dim mt-3" style={{ fontSize: 14, lineHeight: 1.6 }}>
                      {language === 'en'
                        ? 'Counties shaded gold contain stories. Darker means more. Click to zoom and read.'
                        : 'Județele aurii conțin povești. Mai închis înseamnă mai multe. Apasă pentru zoom și lectură.'}
                    </p>
                  </div>
                )}

                {/* Region directory */}
                <div>
                  <div className="eyebrow mb-3.5">{language === 'en' ? 'Most pinned' : 'Cele mai fixate'}</div>
                  <div className="flex flex-col">
                    {allLocationsByCount.map(([loc, count], i) => (
                      <button
                        key={loc}
                        onClick={() => handleLocationClick(loc)}
                        onMouseEnter={() => setHoverCounty(loc)}
                        onMouseLeave={() => setHoverCounty(null)}
                        className="flex justify-between items-center py-4 cursor-pointer text-left"
                        style={{
                          // `border: 0` must come first — the shorthand resets
                          // all four borders, so listing it after borderBottom
                          // erased the row separator.
                          border: 0,
                          borderBottom: i < allLocationsByCount.length - 1 ? '1px solid var(--line-soft)' : 'none',
                          background: 'transparent',
                        }}
                      >
                        <span
                          className="font-display italic"
                          style={{
                            fontSize: 22,
                            color: (selectedLocation === loc || hoverCounty === loc) ? 'var(--gold)' : 'var(--text)',
                          }}
                        >
                          {loc}
                        </span>
                        <span className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                          {count} {language === 'en' ? 'stories' : 'povești'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedLocation && (
                  <button
                    onClick={() => navigate('/categories')}
                    className="btn-ed btn-ed-ghost w-full justify-center"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {language === 'en' ? 'Browse categories' : 'Explorează categorii'}
                  </button>
                )}
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const Stat: React.FC<{ value: React.ReactNode; label: string }> = ({ value, label }) => (
  <div>
    <div className="eyebrow mb-1.5">{label}</div>
    <div className="font-display italic" style={{ fontSize: 36, lineHeight: 1, color: 'var(--gold)' }}>{value}</div>
  </div>
);

export default MapPage;
