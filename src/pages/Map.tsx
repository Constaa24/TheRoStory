import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Info
} from "lucide-react";
import { cn, isAbortError } from "@/lib/utils";
import { HeroBanner } from "@/components/layout/HeroBanner";

const MapPage: React.FC = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Process map data
  const { paths } = useMemo(() => {
    const geojson = topojson.feature(countiesTopoData, countiesTopoData.objects["romania.counties"]);
    
    // Create projection to fit Romania perfectly in our viewBox
    const width = 800;
    const height = 600;
    const projection = d3.geoMercator().fitSize([width, height], geojson);
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

  const closeList = useCallback(() => {
    setSelectedLocation(null);
    setIsZoomed(false);
  }, []);

  const selectedPath = useMemo(() => {
    return paths.find(p => p.id === selectedLocation);
  }, [selectedLocation, paths]);

  const backgroundPath = useMemo(() => paths.map(c => c.d).join(" "), [paths]);

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeroBanner 
        title={language === 'en' ? "Story Map" : "Harta Poveștilor"}
        subtitle={language === 'en' 
          ? "Explore Romania's rich cultural heritage through location-based storytelling." 
          : "Explorează bogatul patrimoniu cultural al României prin povești bazate pe locație."}
        imageUrl="/hero/map.jpg"
        Icon={MapPin}
        height="h-[60vh]"
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
              title="Reset"
            >
              <X className="h-5 w-5 text-primary" />
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
              scale: isZoomed ? 2.2 : 1,
              x: isZoomed ? (selectedPath ? -(selectedPath.lx - 400) * 2.2 : 0) : 0,
              y: isZoomed ? (selectedPath ? -(selectedPath.ly - 300) * 2.2 : 0) : 0,
            }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            onAnimationStart={() => setIsAnimating(true)}
            onAnimationComplete={() => setIsAnimating(false)}
          >
            <svg
              viewBox="0 0 800 600"
              className={cn("w-full h-full transition-all duration-300", isAnimating && "pointer-events-none")}
              style={{
                filter: isAnimating ? 'none' : 'drop-shadow(0 15px 35px hsl(var(--primary) / 0.15))',
                shapeRendering: "geometricPrecision"
              }}
            >
              {/* Background fill for land to avoid gaps */}
              <path
                d={backgroundPath}
                fill="currentColor"
                className="text-primary/5"
                stroke="none"
              />

              {paths.map((county) => {
                const id = county.id;
                const count = storiesPerLocation[id] || 0;
                const isSelected = selectedLocation === id;
                
                return (
                  <g 
                    key={id} 
                    onClick={() => !isAnimating && handleLocationClick(id)}
                    className={cn("cursor-pointer group transition-opacity duration-300", isAnimating && "pointer-events-none")}
                  >
                    <path
                      d={county.d}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-300",
                        isSelected 
                          ? "fill-accent stroke-accent-foreground stroke-[2]" 
                          : count > 0 
                            ? "fill-primary/40 stroke-primary/30 hover:fill-primary/60 hover:stroke-primary stroke-[1]" 
                            : "fill-primary/10 stroke-primary/20 stroke-[0.5] hover:fill-primary/20"
                      )}
                    />
                    
                    {/* County Name Label - only on hover or selection */}
                    <text
                      x={county.lx}
                      y={county.ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={cn(
                        "pointer-events-none transition-all duration-300 font-serif italic",
                        isSelected ? "fill-accent-foreground opacity-100 font-black" : "fill-primary/60 opacity-0 group-hover:opacity-100 font-bold"
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
        </div>

        {/* Stories Panel */}
        <AnimatePresence>
          {selectedLocation && (
            <motion.div
              key={selectedLocation}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="lg:col-span-1 h-full"
            >
              <Card className="h-full border-none shadow-elegant bg-background/50 backdrop-blur-sm flex flex-col rounded-[2rem] overflow-hidden">
                <div className="p-6 bg-accent text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5" />
                    <div>
                      <h3 className="font-serif font-black italic text-xl leading-none">{selectedLocation}</h3>
                      <p className="text-xs opacity-80 mt-1">{filteredArticles.length} {t("nav.myStory").toLowerCase()}</p>
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

        {/* Empty state when no location selected */}
        {!selectedLocation && (
          <div className="lg:col-span-1 hidden lg:flex flex-col h-full items-center justify-center text-center p-8 bg-secondary/5 rounded-[2rem] border border-dashed border-border/50">
            <div className="p-6 bg-secondary/20 rounded-full mb-6">
              <MapPin className="h-12 w-12 text-accent/20" />
            </div>
            <h3 className="font-serif font-black italic text-2xl text-primary mb-2">
              {language === 'en' ? "Select a Region" : "Selectează o regiune"}
            </h3>
            <p className="text-muted-foreground font-serif italic">
              {language === 'en' 
                ? "Click on any highlighted area of the map to discover local stories and traditions." 
                : "Apasă pe orice zonă evidențiată de pe hartă pentru a descoperi povești și tradiții locale."}
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
          <p className="text-4xl font-black text-accent">{articles.length}</p>
          <p className="font-serif italic text-muted-foreground uppercase tracking-widest text-xs font-bold">
            {language === 'en' ? "Total Stories" : "Total Povești"}
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
