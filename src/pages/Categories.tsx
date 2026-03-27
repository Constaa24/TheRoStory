import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Category, Article, getLocalized } from "@/lib/supabase";
import { fetchPublicContent } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { BookOpen, Layers } from "lucide-react";
import { isAbortError } from "@/lib/utils";
import { HeroBanner } from "@/components/layout/HeroBanner";

const Categories: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleCategorySelect = (categoryId: string) => {
    navigate(`/category/${categoryId}`);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchPublicContent();
        setCategories(data.categories);
        setArticles(data.articles);
      } catch (error) {
        if (!isAbortError(error)) {
          console.error("Error loading content:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const getCategoryArticleCount = (categoryId: string) => {
    return articles.filter((a) => a.categoryId === categoryId).length;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeroBanner 
        title={language === "en" ? "Explore Categories" : "Explorează Categoriile"}
        subtitle={language === "en"
          ? "Discover stories about Romania organized by themes. From ancient history to breathtaking nature."
          : "Descoperă povești despre România organizate pe teme. De la istorie antică la natură de vis."}
        imageUrl="https://images.unsplash.com/photo-1754837067086-55787f63f9dd?q=80&w=2000"
        Icon={Layers}
        height="h-[60vh]"
      />

      {/* Categories Grid */}
      <div className="container mx-auto px-4 py-20">
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {categories.map((category, index) => (
            <motion.button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              className="parchment-effect group relative p-10 rounded-sm border-none shadow-elegant hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 text-left flex flex-col items-center justify-center space-y-4 min-h-[300px]"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="absolute top-10 right-10 text-accent/20 group-hover:text-accent/40 transition-colors">
                <BookOpen className="h-12 w-12" />
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-[1px] bg-accent mx-auto group-hover:w-24 transition-all duration-500" />
                <h3 className="text-3xl font-serif font-black italic text-secondary-foreground leading-tight">
                  {getLocalized(category, "name", language)}
                </h3>
                <div className="w-16 h-[1px] bg-accent mx-auto group-hover:w-24 transition-all duration-500" />
                
                <p className="text-sm font-sans uppercase tracking-[0.3em] text-accent font-bold pt-4">
                  {getCategoryArticleCount(category.id)} {language === "en" ? "Stories" : "Povești"}
                </p>
              </div>

              <div className="absolute inset-0 border-[1px] border-secondary-foreground/5 pointer-events-none" />
              <div className="absolute inset-2 border-[1px] border-accent/10 pointer-events-none group-hover:inset-1 transition-all duration-500" />
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Categories;
