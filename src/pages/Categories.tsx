import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Category, getLocalized, fetchCategories, fetchArticleCategoryCounts } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { isAbortError, toJsonLd } from "@/lib/utils";
import { PageHead } from "@/components/layout/PageHead";
import { SITE_URL } from "@/lib/constants";

// Extension-less base paths — each has a .avif, .webp and .jpg sibling, served
// through <picture> below. They shipped as ~800 KB files named .png that were
// actually JPEGs inside; the same AVIF/WebP treatment the hero images already
// get takes the eight of them from 6.3 MB to about 450 KB.
const CATEGORY_IMAGES: Record<string, string> = {
  "history": "/categories/cat_history_new",
  "science": "/categories/cat_science_new",
  "landmarks": "/categories/cat_landmarks_new",
  "historical-figures": "/categories/cat_historical_figures_new",
  "traditions": "/categories/cat_2",
  "myths": "/categories/cat_1",
  "nature": "/categories/cat_nature_new",
  "art": "/categories/cat_art_new"
};

const FALLBACK_IMAGES = Object.values(CATEGORY_IMAGES);

/**
 * Stable image for a category without its own mapping.
 *
 * Keyed on the slug rather than the list index: categories are ordered by
 * name, so an index-based pick reshuffled the artwork of every unmapped
 * category whenever one was added or renamed. It also drew from only
 * cat_1/cat_2 — the artwork already assigned to "myths" and "traditions" —
 * so a new category was guaranteed to look like a duplicate of an existing
 * one. Hashing across the full set makes collisions possible but no longer
 * certain, and keeps each category's image fixed over time.
 */
const getCategoryImage = (slug: string) => {
  const mapped = CATEGORY_IMAGES[slug];
  if (mapped) return mapped;
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = ((h << 5) - h) + slug.charCodeAt(i);
  return FALLBACK_IMAGES[Math.abs(h) % FALLBACK_IMAGES.length];
};

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
        if (!isAbortError(error)) console.error("Error loading content:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

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
    <div className="screen-anim pb-20">
      <PageHead title={pageTitle} description={pageDescription} language={language}>
        <script type="application/ld+json">{toJsonLd(itemListLd)}</script>
      </PageHead>

      {/* PAGE HERO */}
      <section style={{ padding: '80px 0 56px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="eyebrow mb-4">{language === 'en' ? 'Routes through the archive' : 'Trasee prin arhivă'}</div>
          <h1
            className="font-display italic font-medium m-0"
            style={{
              fontSize: 'clamp(42px, 8vw, 120px)',
              lineHeight: 0.95,
              letterSpacing: '-0.01em',
              color: 'var(--parchment)',
            }}
          >
            {language === 'en' ? 'Categories.' : 'Categorii.'}
          </h1>
          <p className="mt-7 max-w-[540px]" style={{ fontSize: 19, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {language === 'en'
              ? 'Different ways into the same country. Choose how you want to wander.'
              : 'Căi diferite prin aceeași țară. Alege cum vrei să rătăcești.'}
          </p>
        </div>
      </section>

      {/* CATEGORIES GRID */}
      <section style={{ padding: '60px 0 120px' }}>
        <div className="ed-container">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-14">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse" style={{ aspectRatio: '16/9', background: 'var(--ink-2)', border: '1px solid var(--line)' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-14">
              {categories.map((category, i) => {
                const name = getLocalized(category, 'name', language);
                const count = categoryCounts[category.id] ?? 0;
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className="block text-left cursor-pointer group transition-colors w-full h-full"
                    style={{ background: 'transparent', border: 0, padding: 0, borderRadius: 0 }}
                  >
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 28 }} className="h-full flex flex-col">
                      <div className="mb-6 md:min-h-[120px] lg:min-h-[140px]">
                        <div className="flex justify-between items-baseline">
                          <div className="flex gap-4 items-baseline">
                            <span className="font-ui text-[12px] uppercase shrink-0" style={{ letterSpacing: '0.18em', color: 'var(--gold)' }}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <h2
                              className="font-display italic font-medium m-0 transition-colors group-hover:text-gold"
                              style={{ fontSize: 'clamp(38px, 4vw, 56px)', lineHeight: 1, color: 'var(--parchment)' }}
                            >
                              {name}
                            </h2>
                          </div>
                          <span className="font-ui text-[12px] uppercase shrink-0 ml-4" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
                            {count} {language === 'en' ? 'stories' : 'povești'}
                          </span>
                        </div>
                      </div>

                      <div className="mb-6 relative overflow-hidden transition-transform group-hover:translate-y-[-2px]" style={{ aspectRatio: '16/9' }}>
                        {(() => {
                          const base = getCategoryImage(category.slug || name.toLowerCase());
                          return (
                            <picture>
                              <source type="image/avif" srcSet={`${base}.avif`} />
                              <source type="image/webp" srcSet={`${base}.webp`} />
                              <img
                                src={`${base}.jpg`}
                                alt={name}
                                width={1024}
                                height={1024}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              />
                            </picture>
                          );
                        })()}
                      </div>

                      <div className="flex justify-between items-start gap-6">
                        <div className="flex-1">
                          <p className="text-ink-dim m-0 max-w-[480px]" style={{ fontSize: 15, lineHeight: 1.6 }}>
                            {language === 'en'
                              ? `Stories filed under ${name.toLowerCase()} — long reads, photo essays, and films.`
                              : `Povești filtrate sub ${name.toLowerCase()} — lecturi, eseuri foto și filme.`}
                          </p>
                          <p className="font-display italic mt-3" style={{ fontSize: 18, color: 'var(--gold)' }}>
                            {language === 'en' ? `Browse ${name.toLowerCase()} →` : `Explorează ${name.toLowerCase()} →`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Categories;
