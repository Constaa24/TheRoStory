import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Category, Article, getLocalized } from "@/lib/supabase";
import { fetchPublicContent } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { ArrowLeft, ArrowRight, BookOpen, Heart, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryThumbnail } from "@/components/ui/story-thumbnail";
import { cn, isAbortError } from "@/lib/utils";
import { ParchmentArticle } from "@/components/organisms/ParchmentArticle";
import { AnimatePresence } from "framer-motion";

const CategoryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { handleFavoriteToggle, isFavorited } = useFavorites();
  const [category, setCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchPublicContent();
        const foundCategory = data.categories.find((c) => c.id === id);
        if (foundCategory) {
          setCategory(foundCategory);
          setArticles(data.articles.filter((a) => a.categoryId === id));
        } else {
          navigate("/categories");
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.error("Error loading category content:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  if (!category) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="relative py-16 bg-gradient-to-b from-secondary/30 to-background border-b border-border">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            className="mb-8 group"
            onClick={() => navigate("/categories")}
          >
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            {language === "en" ? "Back to Categories" : "Înapoi la Categorii"}
          </Button>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                <BookOpen className="h-4 w-4" />
                {articles.length} {language === "en" ? "stories" : "povești"}
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-black text-primary italic">
                {getLocalized(category, "name", language)}
              </h1>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        {articles.length === 0 ? (
          <div className="text-center py-20 bg-secondary/20 rounded-2xl border border-dashed border-border">
            <p className="text-muted-foreground italic text-lg">
              {t("articles.noArticles")}
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => navigate("/categories")}
            >
              {language === "en" ? "Explore other categories" : "Explorează alte categorii"}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => (
              <div
                key={article.id}
                onClick={() => setActiveArticle(article)}
                className="group flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer relative"
              >
                <div className="absolute top-4 right-4 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors",
                      isFavorited(article.id) ? "text-red-500" : "text-white"
                    )}
                    onClick={(e) => handleFavoriteToggle(e, article.id)}
                  >
                    <Heart className={cn("h-5 w-5", isFavorited(article.id) && "fill-current")} />
                  </Button>
                </div>

                {article.mediaUrl && (
                  <div className="aspect-[16/10] overflow-hidden relative">
                    {article.type === 'video' ? (
                      <div className="w-full h-full relative">
                        <StoryThumbnail
                          posterUrl={article.posterUrl}
                          alt={getLocalized(article, "title", language)}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                          <div className="p-3 bg-white/20 backdrop-blur-md rounded-full">
                            <Video className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={article.mediaUrl}
                        alt={getLocalized(article, "title", language)}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        loading="lazy"
                      />
                    )}
                  </div>
                )}
                <div className="p-8 flex flex-col flex-1">
                  <h3 className="text-xl font-serif italic font-bold text-primary mb-3 group-hover:text-accent transition-colors duration-300">
                    {getLocalized(article, "title", language)}
                  </h3>
                  <p className="text-muted-foreground line-clamp-3 mb-6 flex-1">
                    {getLocalized(article, "content", language).substring(0, 150)}...
                  </p>
                  <div className="flex items-center gap-2 text-accent font-semibold group-hover:gap-3 transition-all duration-300">
                    <span className="text-sm uppercase tracking-wider">{t("articles.readMore")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parchment Article Viewer */}
      <AnimatePresence>
        {activeArticle && (
          <ParchmentArticle 
            article={activeArticle} 
            onClose={() => setActiveArticle(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryDetail;
