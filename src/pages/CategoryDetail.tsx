import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Category, Article, getLocalized, supabase, toCamelCase, fetchArticlesPage } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { ArrowLeft, Heart, Play, Images, ChevronRight, Loader2 } from "lucide-react";
import { StoryThumbnail } from "@/components/ui/story-thumbnail";
import { cn, isAbortError } from "@/lib/utils";
import { PageHead } from "@/components/layout/PageHead";
import { SITE_URL } from "@/lib/constants";
import { toneFor, readMinutes, articleExcerpt, articleCoverUrl } from "@/lib/article-utils";

// Fetched in pages so a large category doesn't pull hundreds of full-content
// rows (previously: up to 500 articles × both 50k-char content columns in
// one request).
const CATEGORY_PAGE_SIZE = 24;

const CategoryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { handleFavoriteToggle, isFavorited } = useFavorites();
  const [category, setCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!id) { navigate("/categories"); return; }
    let cancelled = false;
    setIsLoading(true);
    setArticles([]);
    setTotalCount(0);
    const loadData = async () => {
      try {
        const [categoryRes, articlesPage] = await Promise.all([
          supabase.from('categories').select('*').eq('id', id).maybeSingle(),
          fetchArticlesPage(1, CATEGORY_PAGE_SIZE, id),
        ]);
        if (cancelled) return;
        if (categoryRes.error) throw categoryRes.error;
        if (!categoryRes.data) { navigate("/categories"); return; }
        setCategory(toCamelCase<Category>(categoryRes.data));
        setArticles(articlesPage.articles);
        setTotalCount(articlesPage.total);
      } catch (error) {
        if (!isAbortError(error)) console.error("Error loading category content:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [id, navigate]);

  const loadMore = async () => {
    if (!id || isLoadingMore || articles.length >= totalCount) return;
    setIsLoadingMore(true);
    try {
      const nextPage = Math.floor(articles.length / CATEGORY_PAGE_SIZE) + 1;
      const { articles: more, total } = await fetchArticlesPage(nextPage, CATEGORY_PAGE_SIZE, id);
      setArticles(prev => {
        const seen = new Set(prev.map(a => a.id));
        return [...prev, ...more.filter(a => !seen.has(a.id))];
      });
      setTotalCount(total);
    } catch (error) {
      if (!isAbortError(error)) console.error("Error loading more articles:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
      </div>
    );
  }
  if (!category) return null;

  const categoryName = getLocalized(category, "name", language);
  const pageTitle = categoryName;
  const pageDescription = language === "en"
    ? `Stories about ${categoryName} — explore Romania through ${totalCount} ${totalCount === 1 ? "story" : "stories"} curated by The RoStory.`
    : `Povești despre ${categoryName} — descoperă România prin ${totalCount} ${totalCount === 1 ? "poveste" : "povești"} pe The RoStory.`;

  const breadcrumbLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: language === "en" ? "Home" : "Acasă", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: language === "en" ? "Categories" : "Categorii", item: `${SITE_URL}/categories` },
      { "@type": "ListItem", position: 3, name: categoryName, item: `${SITE_URL}/category/${category.id}` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org", "@type": "ItemList",
    itemListElement: articles.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/article/${a.id}`, name: getLocalized(a, "title", language) })),
  };

  return (
    <div className="screen-anim pb-20">
      <PageHead title={pageTitle} description={pageDescription} language={language}>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </PageHead>

      <section style={{ padding: '60px 0 40px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <button
            onClick={() => navigate('/categories')}
            className="flex items-center gap-2 mb-8 transition-colors hover:text-gold cursor-pointer"
            style={{ color: 'var(--text-dim)', background: 'transparent', border: 0, fontFamily: 'var(--ui)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {language === 'en' ? 'Back' : 'Înapoi'}
          </button>

          <nav aria-label="Breadcrumb" className="mb-6 font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link to="/" className="transition-colors hover:text-gold">{language === 'en' ? 'Home' : 'Acasă'}</Link></li>
              <li><ChevronRight className="w-3 h-3" /></li>
              <li><Link to="/categories" className="transition-colors hover:text-gold">{language === 'en' ? 'Categories' : 'Categorii'}</Link></li>
              <li><ChevronRight className="w-3 h-3" /></li>
              <li className="text-gold" aria-current="page">{categoryName}</li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="eyebrow mb-3.5">{language === 'en' ? 'Collection' : 'Colecția'}</div>
              <h1
                className="font-display italic font-medium m-0"
                style={{
                  fontSize: 'clamp(56px, 8vw, 120px)',
                  lineHeight: 0.95,
                  letterSpacing: '-0.01em',
                  color: 'var(--parchment)',
                }}
              >
                {categoryName}
              </h1>
            </div>
            <div className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
              {totalCount} {language === 'en' ? 'stories' : 'povești'}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 0' }}>
        <div className="ed-container">
          {articles.length === 0 ? (
            <div className="py-20 text-center" style={{ border: '1px dashed var(--line)' }}>
              <p className="font-display italic text-2xl text-ink-dim">{t("articles.noArticles")}</p>
              <button onClick={() => navigate("/categories")} className="btn-ed btn-ed-ghost mt-6">
                {language === 'en' ? 'Explore other categories' : 'Explorează alte categorii'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 gap-y-[72px]">
              {articles.map(article => {
                const tone = toneFor(article.id);
                const cover = articleCoverUrl(article);
                const fav = isFavorited(article.id);
                return (
                  <Link
                    key={article.id}
                    to={`/article/${article.id}`}
                    state={{ from: `/category/${id}`, category: id }}
                    className="block cursor-pointer group"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <div
                      className="ph relative overflow-hidden"
                      data-tone={tone}
                      data-label={article.location?.toUpperCase() || categoryName.toUpperCase()}
                      style={{ aspectRatio: '3/4' }}
                    >
                      {cover && (
                        <>
                          {article.type === 'video' ? (
                            <StoryThumbnail posterUrl={article.posterUrl} alt={getLocalized(article, 'title', language)} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <img src={cover} alt={getLocalized(article, 'title', language)} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          )}
                          <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--scrim-card)' }} />
                        </>
                      )}
                      {article.type === 'video' && (
                        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1" style={{ background: 'var(--overlay-dark)', border: '1px solid var(--gold)', color: 'var(--gold)', fontFamily: 'var(--ui)', fontSize: 10, letterSpacing: '0.18em' }}>
                          <Play className="w-2.5 h-2.5" fill="currentColor" /> FILM
                        </div>
                      )}
                      {article.type === 'carousel' && article.mediaUrls && (
                        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1" style={{ background: 'var(--overlay-dark)', border: '1px solid var(--gold)', color: 'var(--gold)', fontFamily: 'var(--ui)', fontSize: 10, letterSpacing: '0.18em' }}>
                          <Images className="w-2.5 h-2.5" /> {article.mediaUrls.length}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFavoriteToggle(e, article.id); }}
                        aria-label="Favorite"
                        className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full transition-colors"
                        style={{ background: 'var(--overlay-medium)', border: '1px solid var(--line)', color: fav ? 'var(--oxblood-2)' : 'var(--text)', backdropFilter: 'blur(6px)' }}
                      >
                        <Heart className={cn('w-4 h-4', fav && 'fill-current')} />
                      </button>
                    </div>
                    <div className="pt-5">
                      <div className="flex items-center gap-3.5 font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
                        <span style={{ color: 'var(--gold)' }}>{categoryName}</span>
                        {article.type !== 'video' && (
                          <>
                            <span>·</span>
                            <span>{readMinutes(article, language)} {language === 'en' ? 'min read' : 'min citire'}</span>
                          </>
                        )}
                      </div>
                      <h3
                        className="font-display italic font-medium m-0 mt-3 mb-2"
                        style={{ fontSize: 22, lineHeight: 1.1, color: 'var(--text)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
                      >
                        {getLocalized(article, 'title', language)}
                      </h3>
                      <p className="text-ink-dim m-0" style={{ fontSize: 15 }}>
                        {articleExcerpt(article, language, 130)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {articles.length > 0 && articles.length < totalCount && (
            <div className="flex justify-center pt-16">
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="btn-ed btn-ed-ghost"
                style={{ opacity: isLoadingMore ? 0.5 : 1 }}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {language === 'en' ? 'Loading…' : 'Se încarcă…'}
                  </>
                ) : (
                  language === 'en'
                    ? `Load more (${totalCount - articles.length} remaining)`
                    : `Încarcă mai multe (${totalCount - articles.length} rămase)`
                )}
              </button>
            </div>
          )}
        </div>
      </section>

    </div>
  );
};

export default CategoryDetail;
