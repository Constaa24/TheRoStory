import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Category, Article, getLocalized, fetchPublicContent, fetchArticlesPage, fetchRandomArticle } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { StoryThumbnail } from "@/components/ui/story-thumbnail";
import { ParchmentArticle } from "@/components/organisms/ParchmentArticle";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, BookOpen, Heart, Video, MapPin, Images } from "lucide-react";
import { cn, isAbortError } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { PageHead } from "@/components/layout/PageHead";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const PAGE_SIZE = 9;
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1701118737005-005fc66703be?q=80&w=800";

// Extracted animation variants to avoid re-creating objects on every render
const fadeScaleIn = { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 } } as const;
const fadeSlideUp30 = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } } as const;
const fadeSlideUp20 = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } } as const;
const heroSubtitleTransition = { delay: 0.5 } as const;
const heroCtaTransition = { delay: 0.7 } as const;
const cardVariants = {
  initial: { opacity: 0, scale: 0.9, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: 20 },
  transition: { duration: 0.4, ease: "easeOut" as const },
} as const;

interface ArticleCardProps {
  article: Article;
  categoryName: string;
  language: 'en' | 'ro';
  t: (key: string) => string;
  isArticleFavorited: boolean;
  onOpen: (article: Article) => void;
  onFavoriteToggle: (e: React.MouseEvent, articleId: string) => void;
}

const ArticleCard = React.memo<ArticleCardProps>(({
  article,
  categoryName,
  language,
  t,
  isArticleFavorited,
  onOpen,
  onFavoriteToggle,
}) => {
  return (
  <Card
    className="group overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] transition-all duration-700 bg-secondary/5 cursor-pointer h-full flex flex-col hover:-translate-y-3 relative rounded-[2rem] md:rounded-[2.5rem]"
    onClick={() => onOpen(article)}
  >
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-10">
      <div className="absolute inset-0 bg-accent/5 mix-blend-overlay" />
      <div className="absolute inset-0 border-2 border-accent/20 rounded-[2rem] md:rounded-[2.5rem] m-2" />
    </div>

    <div className="aspect-[4/5] overflow-hidden relative">
      {article.type === 'video' ? (
        <div className="w-full h-full relative">
          <StoryThumbnail
            posterUrl={article.posterUrl}
            alt={getLocalized(article, "title", language)}
            className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-full">
              <Video className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      ) : article.type === 'carousel' ? (
        <div className="w-full h-full relative">
          <img
            src={article.mediaUrls?.[0] || article.mediaUrl || FALLBACK_IMAGE_URL}
            alt={getLocalized(article, "title", language)}
            className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-transparent transition-colors">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-full">
              <Images className="h-8 w-8 text-white" />
            </div>
          </div>
          {article.mediaUrls && (
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-sans uppercase tracking-widest">
              {article.mediaUrls.length} Photos
            </div>
          )}
        </div>
      ) : (
        <img
          src={article.mediaUrl || FALLBACK_IMAGE_URL}
          alt={getLocalized(article, "title", language)}
          className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <Badge className="bg-accent text-white border-none font-serif italic rounded-full px-3">
          {categoryName}
        </Badge>
        {article.location && (
          <Badge variant="outline" className="bg-white/20 text-white border-white/30 font-serif italic backdrop-blur-md flex items-center gap-1 rounded-full px-3">
            <MapPin className="h-3 w-3" />
            {article.location}
          </Badge>
        )}
        {article.type === 'video' && (
          <Badge variant="outline" className="bg-white/10 text-white border-white/20 font-serif italic backdrop-blur-md rounded-full px-3">
            Video
          </Badge>
        )}
        {article.type === 'carousel' && (
          <Badge variant="outline" className="bg-white/10 text-white border-white/20 font-serif italic backdrop-blur-md rounded-full px-3">
            Carousel
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors",
            isArticleFavorited ? "text-red-500" : "text-white"
          )}
          onClick={(e) => onFavoriteToggle(e, article.id)}
        >
          <Heart className={cn("h-5 w-5", isArticleFavorited && "fill-current")} />
        </Button>
      </div>
    </div>
    <CardHeader className="space-y-2 p-6 pb-2">
      <h3 className="text-2xl font-serif font-bold text-secondary-foreground leading-tight group-hover:text-accent transition-colors">
        {getLocalized(article, "title", language)}
      </h3>
    </CardHeader>
    <CardContent className="p-6 pt-2 flex-1">
      <p className="text-muted-foreground line-clamp-3 font-serif italic text-sm">
        {getLocalized(article, "content", language).substring(0, 150)}...
      </p>
    </CardContent>
    <CardFooter className="p-6 pt-0 border-t border-secondary-foreground/5 mt-auto">
      <Button variant="link" className="p-0 text-accent gap-2 group/btn">
        {t("articles.readMore")}
        <BookOpen className="h-4 w-4 group-hover/btn:rotate-12 transition-transform" />
      </Button>
    </CardFooter>
  </Card>
  );
});
ArticleCard.displayName = "ArticleCard";

const Home: React.FC = () => {
  const { language, t } = useLanguage();
  const { handleFavoriteToggle, isFavorited } = useFavorites();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => {
    try {
      return localStorage.getItem("rostory_selected_category");
    } catch {
      return null;
    }
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const handleCloseArticle = useCallback(() => setActiveArticle(null), []);
  const handleOpenArticle = useCallback((article: Article) => setActiveArticle(article), []);

  const handleRandomStory = async () => {
    const article = await fetchRandomArticle();
    if (article) setActiveArticle(article);
  };

  const handleCategoryChange = (catId: string | null) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
  };

  // Fetch categories once
  useEffect(() => {
    fetchPublicContent()
      .then((data) => setCategories(data.categories))
      .catch(() => {});
  }, []);

  // Persist selected category
  useEffect(() => {
    try {
      if (selectedCategory) {
        localStorage.setItem("rostory_selected_category", selectedCategory);
      } else {
        localStorage.removeItem("rostory_selected_category");
      }
    } catch {
      // Ignore browser storage restrictions
    }
  }, [selectedCategory]);

  // Fetch articles page whenever page or category changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchArticlesPage(currentPage, PAGE_SIZE, selectedCategory)
      .then(({ articles, total }) => {
        if (cancelled) return;
        setArticles(articles);
        setTotalCount(total);
      })
      .catch((error) => {
        if (!isAbortError(error)) console.error("Error fetching articles:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentPage, selectedCategory]);

  const pageTitle = language === "en"
    ? "The RoStory — Stories of Romania"
    : "The RoStory — Povești din România";
  const pageDescription = language === "en"
    ? "Discover the culture, history, and traditions of Romania through visual stories — articles, videos, and photo galleries from every region."
    : "Descoperă cultura, istoria și tradițiile României prin povești vizuale — articole, videoclipuri și galerii foto din fiecare regiune.";

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      "https://www.instagram.com/therostory",
      "https://www.tiktok.com/@therostory",
      "https://www.youtube.com/@therostory",
    ],
  };

  // rel=prev/next for paginated home content
  const prevPageUrl = currentPage > 1
    ? `${SITE_URL}/?page=${currentPage - 1}`
    : null;
  const nextPageUrl = currentPage < totalPages
    ? `${SITE_URL}/?page=${currentPage + 1}`
    : null;

  return (
    <>
      <PageHead title={pageTitle} description={pageDescription} language={language}>
        <script type="application/ld+json">{JSON.stringify(organizationLd)}</script>
        {prevPageUrl && <link rel="prev" href={prevPageUrl} />}
        {nextPageUrl && <link rel="next" href={nextPageUrl} />}
      </PageHead>
      <div className="space-y-16 animate-fade-in pb-20">
        {/* Hero Section */}
      <section className="relative min-h-[80vh] pt-20 flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{ 
            backgroundImage: `url("/hero/castle.jpg")`,
          }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 px-4 w-full max-w-7xl mx-auto">
          <motion.div
            {...fadeScaleIn}
            className="inline-block px-4 py-1 rounded-full bg-accent/20 backdrop-blur-md border border-accent/30 text-white font-serif italic text-sm mb-4"
          >
            {t("hero.badge")}
          </motion.div>
          <motion.h1
            {...fadeSlideUp30}
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif font-black text-white tracking-tight animate-parchment-reveal px-4 pb-4"
          >
            {t("hero.title")}
          </motion.h1>
          <motion.p
            {...fadeSlideUp20}
            transition={heroSubtitleTransition}
            className="text-xl md:text-3xl text-white/90 font-serif italic max-w-3xl mx-auto leading-relaxed"
          >
            {t("hero.subtitle")}
          </motion.p>
          <motion.div
            {...fadeSlideUp20}
            transition={heroCtaTransition}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Button 
              size="lg" 
              className="rounded-full bg-accent text-white hover:bg-accent/90 px-10 h-16 text-xl shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95"
              onClick={() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t("nav.explore")} <ChevronRight className="ml-2 h-6 w-6" />
            </Button>
            <Button 
              variant="outline"
              size="lg" 
              className="rounded-full bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-md px-10 h-16 text-xl transition-all hover:scale-105 active:scale-95"
              onClick={handleRandomStory}
            >
              <BookOpen className="mr-2 h-6 w-6" />
              {t("home.randomButton")}
            </Button>
          </motion.div>
        </div>

        {/* Hero Bottom Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      </section>

      {/* Explore Section */}
      <section id="explore" className="container mx-auto px-4 space-y-16 py-12">
        <div className="flex flex-col items-center justify-center gap-8 mb-16">
          <div className="space-y-4 text-center">
            <h2 className="text-4xl md:text-5xl font-serif font-black text-primary italic">
              {t("categories.title")}
            </h2>
            <div className="h-1 w-24 bg-accent mx-auto rounded-full" />
          </div>

          {/* Floating Category Filter */}
          <div className="flex w-full md:w-auto overflow-x-auto pb-4 md:pb-0 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex flex-nowrap md:flex-wrap items-center justify-start md:justify-center p-2 bg-secondary/20 backdrop-blur-md rounded-full border border-border/40 shadow-sm mx-auto min-w-max">
              <Button
                variant={selectedCategory === null ? "default" : "ghost"}
                size="sm"
                onClick={() => handleCategoryChange(null)}
                className={cn(
                  "rounded-full px-6 transition-all duration-300",
                  selectedCategory === null ? "shadow-md scale-105" : "hover:bg-accent/10"
                )}
              >
                {t("home.all")}
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={cn(
                    "rounded-full px-6 transition-all duration-300",
                    selectedCategory === cat.id ? "shadow-md scale-105" : "hover:bg-accent/10"
                  )}
                >
                  {getLocalized(cat, "name", language)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Article Grid */}
        <div className="space-y-10">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-[450px] rounded-2xl bg-secondary/20 animate-pulse border border-border/10" />
              ))}
            </div>
          ) : articles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                  {articles.map((article) => (
                    <motion.div
                      key={article.id}
                      initial={cardVariants.initial}
                      animate={cardVariants.animate}
                      exit={cardVariants.exit}
                      transition={cardVariants.transition}
                    >
                      <ArticleCard
                        article={article}
                        categoryName={getLocalized(categoryMap.get(article.categoryId) || {}, "name", language)}
                        language={language}
                        t={t}
                        isArticleFavorited={isFavorited(article.id)}
                        onOpen={handleOpenArticle}
                        onFavoriteToggle={handleFavoriteToggle}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full px-6 gap-1"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {language === "en" ? "Previous" : "Anterior"}
                  </Button>
                  <span className="font-serif italic text-muted-foreground text-sm">
                    {language === "en"
                      ? `Page ${currentPage} of ${totalPages}`
                      : `Pagina ${currentPage} din ${totalPages}`}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full px-6 gap-1"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage === totalPages}
                  >
                    {language === "en" ? "Next" : "Următor"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="py-24 text-center space-y-6">
              <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-accent/5 mb-4 shadow-inner ring-1 ring-border/10 backdrop-blur-sm">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent/20 to-transparent blur-xl" />
                <BookOpen className="h-10 w-10 text-accent/50 relative z-10" />
              </div>
              <p className="text-2xl font-serif italic text-muted-foreground">
                {t("articles.noArticles")}
              </p>
              <div className="h-px w-16 bg-border mx-auto" />
            </div>
          )}
        </div>
      </section>

      {/* Become a Writer CTA */}
      <section className="container mx-auto px-4 py-24">
        <div className="bg-accent text-white rounded-[3rem] p-12 md:p-20 flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden group shadow-[0_20px_60px_-15px_rgba(217,119,6,0.3)]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl group-hover:bg-white/20 transition-all duration-1000" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full -ml-32 -mb-32 blur-2xl group-hover:bg-black/20 transition-all duration-1000" />
          
          <div className="space-y-6 max-w-2xl text-center md:text-left relative z-10">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-serif font-black italic leading-tight">
              {language === 'en' ? "Share Your Romanian Story" : "Împărtășește Povestea Ta Românească"}
            </h2>
            <p className="text-xl text-white/90 font-serif italic max-w-xl">
              {language === 'en' 
                ? "Are you passionate about Romanian culture? Join our community of storytellers and help us preserve our heritage." 
                : "Ești pasionat de cultura română? Alătură-te comunității noastre de povestitori și ajută-ne să ne păstrăm moștenirea."}
            </p>
          </div>
          
          <Button 
            size="lg" 
            variant="secondary" 
            className="rounded-full px-12 h-20 text-2xl font-serif italic group relative z-10 shadow-xl hover:scale-105 active:scale-95 transition-all"
            onClick={() => navigate('/contact-us')}
          >
            {language === 'en' ? "Become a Writer" : "Devino Scriitor"}
          </Button>
        </div>
      </section>
    </div>

    {/* Parchment Article Viewer */}
    <AnimatePresence>
      {activeArticle && (
        <ParchmentArticle
          article={activeArticle}
          onClose={handleCloseArticle}
        />
      )}
    </AnimatePresence>
  </>
);
};

export default Home;
