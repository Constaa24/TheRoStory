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
    className="group overflow-hidden border border-border/10 shadow-elegant hover:shadow-2xl transition-all duration-700 bg-secondary/5 cursor-pointer h-full flex flex-col hover:-translate-y-3 relative rounded-2xl"
    onClick={() => onOpen(article)}
  >
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-10">
      <div className="absolute inset-0 bg-accent/10 mix-blend-overlay" />
      <div className="absolute inset-0 border-2 border-accent/20 rounded-2xl m-2" />
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

  return (
    <>
      <div className="space-y-16 animate-fade-in pb-20">
        {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{ 
            backgroundImage: `url("https://images.unsplash.com/photo-1701118737005-005fc66703be?q=80&w=2000")`,
          }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 px-4 w-full max-w-7xl mx-auto">
          <motion.div
            {...fadeScaleIn}
            className="inline-block px-4 py-1 rounded-full bg-accent/20 backdrop-blur-md border border-accent/30 text-accent font-serif italic text-sm mb-4"
          >
            {t("hero.badge")}
          </motion.div>
          <motion.h1
            {...fadeSlideUp30}
            className="text-6xl md:text-8xl font-serif font-black text-white tracking-tight animate-parchment-reveal px-4 pb-4"
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
      </section>

      {/* Explore Section */}
      <section id="explore" className="container mx-auto px-4 space-y-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-border pb-8">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-3xl font-serif font-bold text-primary italic">
              {t("categories.title")}
            </h2>
            <div className="h-1 w-20 bg-accent mx-auto md:mx-0" />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryChange(null)}
              className="rounded-full px-6"
            >
              {t("home.all")}
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleCategoryChange(cat.id)}
                className="rounded-full px-6"
              >
                {getLocalized(cat, "name", language)}
              </Button>
            ))}
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
            <div className="py-20 text-center space-y-4">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
              <p className="text-xl font-serif italic text-muted-foreground">
                {t("articles.noArticles")}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Become a Writer CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-accent text-white rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
          
          <div className="space-y-4 max-w-xl text-center md:text-left relative z-10">
            <h2 className="text-3xl md:text-5xl font-serif font-black italic">
              {language === 'en' ? "Share Your Romanian Story" : "Împărtășește Povestea Ta Românească"}
            </h2>
            <p className="text-lg text-white/80 font-serif italic">
              {language === 'en' 
                ? "Are you passionate about Romanian culture? Join our community of storytellers and help us preserve our heritage." 
                : "Ești pasionat de cultura română? Alătură-te comunității noastre de povestitori și ajută-ne să ne păstrăm moștenirea."}
            </p>
          </div>
          
          <Button 
            size="lg" 
            variant="secondary" 
            className="rounded-full px-10 h-16 text-xl font-serif italic group relative z-10"
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
