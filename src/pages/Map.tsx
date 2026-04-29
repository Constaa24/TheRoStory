import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as topojson from "topojson-client";
import * as d3 from "d3-geo";
import countiesTopoData from "@/lib/counties_topo";
import {
  fetchPublicContent,
  Article,
  getLocalized
} from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StoryThumbnail } from "@/components/ui/story-thumbnail";
import {
  X,
  MapPin,
  BookText,
  Video,
  ChevronRight,
  Maximize2,
  Minimize2,
  Info,
  RotateCcw
} from "lucide-react";
import { cn, isAbortError } from "@/lib/utils";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { PageHead } from "@/components/layout/PageHead";

// Choropleth tiers — counties get progressively warmer as story density grows.
// Tiers chosen empirically: most counties have 0-2 stories, a few have many.
// All Tailwind class strings are listed verbatim so JIT picks them up.
const STORY_DENSITY_TIERS: Array<{
  min: number;
  max: number;
  label: string;
  fill: string;
  stroke: string;
  hover: string;
  swatch: string;
}> = [
  { min: 1, max: 2, label: "1–2", fill: "fill-accent/20", stroke: "stroke-accent/30", hover: "hover:fill-accent/30", swatch: "bg-accent/20" },
  { min: 3, max: 5, label: "3–5", fill: "fill-accent/40", stroke: "stroke-accent/50", hover: "hover:fill-accent/55", swatch: "bg-accent/40" },
  { min: 6, max: 10, label: "6–10", fill: "fill-accent/60", stroke: "stroke-accent/70", hover: "hover:fill-accent/75", swatch: "bg-accent/60" },
  { min: 11, max: Infinity, label: "11+", fill: "fill-accent/80", stroke: "stroke-accent/90", hover: "hover:fill-accent/90", swatch: "bg-accent/80" },
];

const tierForCount = (count: number) => {
  if (count <= 0) return null;
  return STORY_DENSITY_TIERS.find((t) => count >= t.min && count <= t.max) ?? STORY_DENSITY_TIERS[STORY_DENSITY_TIERS.length - 1];
};

// SVG viewBox — referenced for pan math so changing dimensions doesn't
// silently break the zoom centering.
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

  // Ref to the stories panel — used to scroll it into view on mobile
  // when a county is selected, since the panel renders below the map.
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Process map data
  const { paths } = useMemo(() => {
    const geojson = topojson.feature(countiesTopoData, countiesTopoData.objects["romania.counties"]);

    // Create projection to fit Romania perfectly in our viewBox
    const projection = d3.geoMercator().fitSize([MAP_VIEW_W, MAP_VIEW_H], geojson);
    const pathGenerator = d3.geoPath().projection(projection);

    // @ts-expect-error - GeoJSON Feature type from @types/geojson expects strict property types,
    // but our custom TopoJSON-derived data uses a looser shape (string name, no typed geometry).
    // Typed manually via `feature: any` below; safe to suppress here.
    const countyPaths = geojson.features.map((feature: any) => {
      let name = feature.properties.name;
      
      // Normalize names to match app's expectations
      if (name === "SatuMare") name = "Satu Mare";
      
      const centroid = pathGenerator.centroid(feature);
      return {
        id: name,
        name: name,
        d: pathGenerator(feature) || "",
        lx: centroid[0],
        ly: centroid[1]
      };
    });

    return { paths: countyPaths };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchPublicContent()
      .then((data) => {
        if (!cancelled) setArticles(data.articles || []);
      })
      .catch((error) => {
        if (!isAbortError(error)) console.error("Error fetching data:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // Restore selected location from state if returning from an article
    const state = location.state as { selectedLocation?: string } | null;
    if (state?.selectedLocation) {
      setSelectedLocation(state.selectedLocation);
      setIsZoomed(true);
    }

    return () => { cancelled = true; };
    // location.state is read once on mount intentionally — re-running on
    // navigation would clobber the user's current selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storiesPerLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach(art => {
      if (art.location) {
        counts[art.location] = (counts[art.location] || 0) + 1;
      }
    });
    return counts;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (!selectedLocation) return [];
    return articles.filter(art => art.location === selectedLocation);
  }, [selectedLocation, articles]);

  const handleLocationClick = useCallback((location: string) => {
    if (selectedLocation === location) {
      setSelectedLocation(null);
      setIsZoomed(false);
    } else {
      setSelectedLocation(location);
      setIsZoomed(true);
    }
  }, [selectedLocation]);

  // On mobile the panel renders below the map — scroll it into view so
  // tapping a county doesn't leave the user looking at an unchanged hero.
  // We also avoid scrolling on desktop (lg+) where the panel sits beside
  // the map and is already visible.
  useEffect(() => {
    if (!selectedLocation) return;
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) return;
    const id = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(id);
  }, [selectedLocation]);

  const closeList = useCallback(() => {
    setSelectedLocation(null);
    setIsZoomed(false);
  }, []);

  const selectedPath = useMemo(() => {
    return paths.find(p => p.id === selectedLocation);
  }, [selectedLocation, paths]);

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="font-serif italic text-accent">Loading Romania...</p>
        </div>
      </div>
    );
  }

  const mapTitle = language === 'en' ? "Story Map" : "Harta Poveștilor";
  const mapDescription = language === 'en'
    ? "Explore Romania's rich cultural heritage through location-based storytelling — click any county to discover its stories."
    : "Explorează bogatul patrimoniu cultural al României prin povești bazate pe locație — apasă orice județ pentru a-i descoperi poveștile.";

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHead title={mapTitle} description={mapDescription} language={language} />
      <HeroBanner
        title={mapTitle}
        subtitle={language === 'en'
          ? "Explore Romania's rich cultural heritage through location-based storytelling."
          : "Explorează bogatul patrimoniu cultural al României prin povești bazate pe locație."}
        imageUrl="/hero/map.jpg"
        Icon={MapPin}
        height="h-[40vh]"
      />

      <div className="container mx-auto px-4 py-20 max-w-7xl space-y-16 animate-fade-in">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Map Section */}
        <div className={cn(
          "lg:col-span-2 relative bg-card/40 rounded-[2rem] p-4 sm:p-8 border-2 border-primary/10 overflow-hidden transition-all duration-700",
          isZoomed ? "shadow-2xl ring-2 ring-accent/40" : "shadow-elegant"
        )}>
          {/* Zoom controls */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <Button 
              variant="secondary" 
              size="icon" 
              className="rounded-full shadow-md bg-background/90 backdrop-blur-sm border border-border/50"
              onClick={() => setIsZoomed(!isZoomed)}
              title={isZoomed ? t("map.zoomOut") : t("map.zoomIn")}
            >
              {isZoomed ? <Minimize2 className="h-5 w-5 text-primary" /> : <Maximize2 className="h-5 w-5 text-primary" />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full shadow-md bg-background/90 backdrop-blur-sm border border-border/50"
              onClick={() => {
                setSelectedLocation(null);
                setIsZoomed(false);
              }}
              title={t("map.reset")}
              aria-label={t("map.reset")}
            >
              <RotateCcw className="h-5 w-5 text-primary" />
            </Button>
          </div>

          {/* Hint */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-sm rounded-full text-xs font-serif italic text-muted-foreground shadow-sm">
            <Info className="h-3 w-3" />
            {t("map.clickToZoom")}
          </div>

          <motion.div
            className="w-full aspect-[4/3] flex items-center justify-center"
            animate={{
              scale: isZoomed ? ZOOM_SCALE : 1,
              x: isZoomed && selectedPath ? -(selectedPath.lx - MAP_VIEW_W / 2) * ZOOM_SCALE : 0,
              y: isZoomed && selectedPath ? -(selectedPath.ly - MAP_VIEW_H / 2) * ZOOM_SCALE : 0,
            }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            onAnimationStart={() => setIsAnimating(true)}
            onAnimationComplete={() => setIsAnimating(false)}
          >
            <svg
              viewBox={`0 0 ${MAP_VIEW_W} ${MAP_VIEW_H}`}
              className={cn("w-full h-full transition-all duration-300", isAnimating && "pointer-events-none")}
              style={{
                filter: isAnimating ? 'none' : 'drop-shadow(0 15px 35px hsl(var(--primary) / 0.15))',
                shapeRendering: "geometricPrecision"
              }}
              role="img"
              aria-label={language === 'en' ? "Map of Romania's counties" : "Harta județelor României"}
            >
              {paths.map((county) => {
                const id = county.id;
                const count = storiesPerLocation[id] || 0;
                const isSelected = selectedLocation === id;
                const tier = tierForCount(count);

                const ariaLabel = count > 0
                  ? (language === 'en'
                    ? `${county.name} — ${count} ${count === 1 ? t("map.storyOne") : t("map.storyMany")}`
                    : `${county.name} — ${count} ${count === 1 ? t("map.storyOne") : t("map.storyMany")}`)
                  : (language === 'en'
                    ? `${county.name} — ${t("map.legendNone")}`
                    : `${county.name} — ${t("map.legendNone")}`);

                return (
                  <g
                    key={id}
                    role="button"
                    tabIndex={0}
                    aria-label={ariaLabel}
                    aria-pressed={isSelected}
                    onClick={() => !isAnimating && handleLocationClick(id)}
                    onKeyDown={(e) => {
                      if (isAnimating) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleLocationClick(id);
                      }
                    }}
                    className={cn(
                      "cursor-pointer group transition-opacity duration-300 outline-none",
                      "focus-visible:[&_path]:stroke-accent focus-visible:[&_path]:stroke-[2]",
                      isAnimating && "pointer-events-none"
                    )}
                  >
                    <path
                      d={county.d}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-300",
                        isSelected
                          ? "fill-accent stroke-accent-foreground stroke-[2]"
                          : tier
                            ? cn(tier.fill, tier.stroke, tier.hover, "stroke-[1] hover:stroke-accent")
                            : "fill-primary/10 stroke-primary/20 stroke-[0.5] hover:fill-primary/20"
                      )}
                    />

                    {/* County name label — visible on hover/focus or when selected */}
                    <text
                      x={county.lx}
                      y={county.ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={cn(
                        "pointer-events-none transition-all duration-300 font-serif italic",
                        isSelected
                          ? "fill-accent-foreground opacity-100 font-black"
                          : "fill-primary/70 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 font-bold"
                      )}
                      style={{ fontSize: '10px' }}
                    >
                      {county.name}
                    </text>

                    {/* Story count badge — native SVG to avoid foreignObject compositing overhead */}
                    {count > 0 && (
                      <>
                        <circle
                          cx={county.lx}
                          cy={county.ly + 16}
                          r="10"
                          strokeWidth="1"
                          className={cn(
                            "pointer-events-none",
                            isSelected ? "fill-background stroke-accent" : "fill-accent stroke-none"
                          )}
                        />
                        <text
                          x={county.lx}
                          y={county.ly + 16}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={cn(
                            "pointer-events-none",
                            isSelected ? "fill-accent" : "fill-white"
                          )}
                          style={{ fontSize: '9px', fontWeight: 900 }}
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

          {/* Legend — shows the choropleth scale so users can read story
              density at a glance instead of guessing what the shading means. */}
          <div className="mt-6 pt-4 border-t border-border/30 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            <span className="font-serif italic normal-case tracking-normal text-xs text-foreground/70">
              {t("map.legendTitle")}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-primary/10 border border-primary/20" aria-hidden="true" />
              <span>{t("map.legendNone")}</span>
            </div>
            {STORY_DENSITY_TIERS.map((tier) => (
              <div key={tier.label} className="flex items-center gap-1.5">
                <span
                  className={cn("h-3 w-5 rounded-sm border border-accent/30", tier.swatch)}
                  aria-hidden="true"
                />
                <span>{tier.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stories Panel */}
        <AnimatePresence>
          {selectedLocation && (
            <motion.div
              key={selectedLocation}
              ref={panelRef}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="lg:col-span-1 h-full scroll-mt-24"
            >
              <Card className="h-full border-none shadow-elegant bg-background/50 backdrop-blur-sm flex flex-col rounded-[2rem] overflow-hidden">
                <div className="p-6 bg-accent text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5" />
                    <div>
                      <h3 className="font-serif font-black italic text-xl leading-none">{selectedLocation}</h3>
                      <p className="text-xs opacity-80 mt-1">
                        {filteredArticles.length}{" "}
                        {filteredArticles.length === 1 ? t("map.storyOne") : t("map.storyMany")}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full text-white hover:bg-white/20"
                    onClick={closeList}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {filteredArticles.length > 0 ? (
                    filteredArticles.map((art) => (
                      <motion.div
                        key={art.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group cursor-pointer bg-secondary/10 hover:bg-accent/5 rounded-2xl p-4 border border-transparent hover:border-accent/20 transition-all"
                        onClick={() => navigate(`/article/${art.id}`, { 
                          state: { 
                            from: "/map",
                            selectedLocation: selectedLocation
                          } 
                        })}
                      >
                        <div className="flex gap-4">
                          {art.mediaUrl && (
                            <div className="h-16 w-16 rounded-xl overflow-hidden shrink-0 shadow-sm">
                              {art.type === 'video' ? (
                                <StoryThumbnail posterUrl={art.posterUrl} className="h-full w-full object-cover" />
                              ) : (
                                <img src={art.mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {art.type === 'video' ? (
                                <Video className="h-3 w-3 text-accent" />
                              ) : (
                                <BookText className="h-3 w-3 text-accent" />
                              )}
                              <span className="text-[10px] uppercase tracking-widest font-bold text-accent">
                                {art.type}
                              </span>
                            </div>
                            <h4 className="font-serif font-bold italic text-sm line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                              {getLocalized(art, "title", language)}
                            </h4>
                          </div>
                          <ChevronRight className="h-4 w-4 self-center text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-4">
                      <div className="p-4 bg-secondary/50 rounded-full">
                        <MapPin className="h-10 w-10 opacity-20" />
                      </div>
                      <p className="font-serif italic">{t("map.noStories")}</p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state when no location selected — visible on all sizes so
            mobile users get a contextual hint after the hero. */}
        {!selectedLocation && (
          <div className="lg:col-span-1 flex flex-col h-full items-center justify-center text-center p-8 bg-secondary/5 rounded-[2rem] border border-dashed border-border/50">
            <div className="p-6 bg-secondary/20 rounded-full mb-6">
              <MapPin className="h-12 w-12 text-accent/20" />
            </div>
            <h3 className="font-serif font-black italic text-2xl text-primary mb-2">
              {t("map.selectRegion")}
            </h3>
            <p className="text-muted-foreground font-serif italic">
              {t("map.selectRegionHint")}
            </p>
          </div>
        )}
      </div>

      {/* Statistics Section */}
      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="p-8 border-none shadow-elegant bg-accent/5 rounded-[2rem] text-center space-y-2">
          <p className="text-4xl font-black text-accent">{Object.keys(storiesPerLocation).length}</p>
          <p className="font-serif italic text-muted-foreground uppercase tracking-widest text-xs font-bold">
            {language === 'en' ? "Active Regions" : "Regiuni Active"}
          </p>
        </Card>
        <Card className="p-8 border-none shadow-elegant bg-accent/5 rounded-[2rem] text-center space-y-2">
          {/* Only count stories that have a location — otherwise this stat
              double-counts general articles on a page that's about geography. */}
          <p className="text-4xl font-black text-accent">{articles.filter(a => a.location).length}</p>
          <p className="font-serif italic text-muted-foreground uppercase tracking-widest text-xs font-bold">
            {language === 'en' ? "Stories on the Map" : "Povești pe Hartă"}
          </p>
        </Card>
        <Card className="p-8 border-none shadow-elegant bg-accent/5 rounded-[2rem] text-center space-y-2">
          <p className="text-4xl font-black text-accent">{paths.length}</p>
          <p className="font-serif italic text-muted-foreground uppercase tracking-widest text-xs font-bold">
            {language === 'en' ? "Counties Covered" : "Județe Acoperite"}
          </p>
        </Card>
      </section>
      </div>
    </div>
  );
};

export default MapPage;
