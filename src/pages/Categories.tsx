import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Category, getLocalized, fetchCategories, fetchArticleCategoryCounts } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { BookOpen, Layers } from "lucide-react";
import { isAbortError } from "@/lib/utils";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { PageHead } from "@/components/layout/PageHead";
import { SITE_URL } from "@/lib/constants";

const Categories: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const handleCategorySelect = (categoryId: string) => {
    navigate(`/category/${categoryId}`);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cats, counts] = await Promise.all([
          fetchCategories(),
          fetchArticleCategoryCounts(),
        ]);
        setCategories(cats);
        setCategoryCounts(counts);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  const pageTitle = language === "en" ? "Categories" : "Categorii";
  const pageDescription = language === "en"
    ? "Browse stories of Romania organized by theme — history, traditions, nature, food, regions, and more."
    : "Răsfoiește poveștile României organizate pe teme — istorie, tradiții, natură, mâncare, regiuni și multe altele.";

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: categories.map((cat, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: getLocalized(cat, "name", language),
      url: `${SITE_URL}/category/${cat.id}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHead title={pageTitle} description={pageDescription} language={language}>
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </PageHead>
      <HeroBanner
        title={language === "en" ? "Explore Categories" : "Explorează Categoriile"}
        subtitle={language === "en"
          ? "Discover stories about Romania organized by themes. From ancient history to breathtaking nature."
          : "Descoperă povești despre România organizate pe teme. De la istorie antică la natură de vis."}
        imageUrl="/hero/delta.jpg"
        Icon={Layers}
        height="h-[60vh]"
      />

      {/* Categories Grid */}
      <div className="container mx-auto px-4 py-20 animate-fade-in">
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {categories.map((category, index) => (
            <motion.button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              className="parchment-effect group relative p-12 rounded-[2.5rem] md:rounded-[3rem] border-none shadow-elegant hover:shadow-2xl hover:shadow-accent/20 transition-all duration-700 hover:-translate-y-3 text-left flex flex-col items-center justify-center space-y-6 min-h-[320px]"
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
                  {categoryCounts[category.id] ?? 0} {language === "en" ? "Stories" : "Povești"}
                </p>
              </div>

              <div className="absolute inset-0 border-[1px] border-secondary-foreground/5 pointer-events-none rounded-[2.5rem] md:rounded-[3rem]" />
              <div className="absolute inset-3 border-[1px] border-accent/20 pointer-events-none group-hover:inset-2 transition-all duration-700 rounded-[2.5rem] md:rounded-[3rem]" />
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Categories;
