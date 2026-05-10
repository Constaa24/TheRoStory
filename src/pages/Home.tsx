import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Category, Article, getLocalized, fetchCategories, fetchArticlesPage, fetchRandomArticle } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { ChevronRight, ChevronLeft, ArrowRight, Heart, Play, Images } from "lucide-react";
import { cn, isAbortError } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/layout/PageHead";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

const PAGE_SIZE = 9;

// Match design tones to a stable per-article hash for visual variety in placeholders.
const TONES = ["warm", "forest", "sky", "oxblood", "bone"] as const;
const toneFor = (id: string) => TONES[Math.abs(hashCode(id)) % TONES.length];
function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return h | 0;
}

const typeLabel = (article: Article, language: 'en' | 'ro') => {
  if (article.type === 'video') return language === 'en' ? 'Film' : 'Film';
  if (article.type === 'carousel') return language === 'en' ? 'Photo essay' : 'Eseu foto';
  return language === 'en' ? 'Long read' : 'Lectură';
};

const placeLabel = (article: Article) => (article.location || '').toUpperCase();

// Approximate read minutes from content length
const readMinutes = (article: Article, language: 'en' | 'ro') => {
  const text = getLocalized(article, 'content', language);
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 220));
};

interface StoryCardProps {
  article: Article;
  category?: Category;
  language: 'en' | 'ro';
  size?: 'lg' | 'wide' | 'md';
  isArticleFavorited: boolean;
  onOpen: (article: Article) => void;
  onFavoriteToggle: (e: React.MouseEvent, articleId: string) => void;
}

const StoryCard = React.memo<StoryCardProps>(({ article, category, language, size = 'md', isArticleFavorited, onOpen, onFavoriteToggle }) => {
  const dims = size === 'lg'
    ? { aspect: '4/5', titleSize: 38 }
    : size === 'wide'
      ? { aspect: '16/10', titleSize: 28 }
      : { aspect: '3/4', titleSize: 22 };
  const tone = toneFor(article.id);
  const cover = article.type === 'video'
    ? article.posterUrl
    : article.type === 'carousel'
      ? article.mediaUrls?.[0] || article.mediaUrl
      : article.mediaUrl;
  const hasMedia = !!cover || (article.type === 'video' && !!article.mediaUrl);

  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onOpen(article); }}
      className="block cursor-pointer group"
      style={{ color: 'inherit', textDecoration: 'none' }}
    >
      <div
        className="ph relative overflow-hidden"
        data-tone={tone}
        data-label={placeLabel(article) || (category ? getLocalized(category, 'name', language).toUpperCase() : '')}
        style={{ aspectRatio: dims.aspect }}
      >
        {hasMedia && cover && (
          <img
            src={cover}
            alt={getLocalized(article, 'title', language)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            loading="lazy"
            style={{ filter: 'grayscale(0.15) contrast(1.05)' }}
          />
        )}
        {hasMedia && cover && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--scrim-card)' }} />
        )}
        {article.type === 'video' && (
          <div
            className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1"
            style={{
              background: 'var(--overlay-dark)',
              border: '1px solid var(--gold)',
              color: 'var(--gold)',
              fontFamily: 'var(--ui)',
              fontSize: 10,
              letterSpacing: '0.18em',
            }}
          >
            <Play className="w-2.5 h-2.5" fill="currentColor" />
            {language === 'en' ? 'FILM' : 'FILM'}
          </div>
        )}
        {article.type === 'carousel' && article.mediaUrls && (
          <div
            className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1"
            style={{
              background: 'var(--overlay-dark)',
              border: '1px solid var(--gold)',
              color: 'var(--gold)',
              fontFamily: 'var(--ui)',
              fontSize: 10,
              letterSpacing: '0.18em',
            }}
          >
            <Images className="w-2.5 h-2.5" />
            {article.mediaUrls.length}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle(e, article.id); }}
          aria-label="Favorite"
          className="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full transition-colors"
          style={{
            background: 'var(--overlay-medium)',
            border: '1px solid var(--line)',
            color: isArticleFavorited ? 'var(--oxblood-2)' : 'var(--text)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Heart className={cn('w-4 h-4', isArticleFavorited && 'fill-current')} />
        </button>
      </div>

      <div className="pt-5">
        <div className="flex items-center gap-3.5 font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
          {category && <span style={{ color: 'var(--gold)' }}>{getLocalized(category, 'name', language)}</span>}
          {category && <span>·</span>}
          <span>{typeLabel(article, language)}</span>
          <span>·</span>
          <span>{readMinutes(article, language)} {language === 'en' ? 'min read' : 'min citire'}</span>
        </div>
        <h3
          className="font-display italic font-medium m-0 mt-3 mb-2"
          style={{ fontSize: dims.titleSize, lineHeight: 1.1, color: 'var(--text)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
        >
          {getLocalized(article, 'title', language)}
        </h3>
        <p className="text-ink-dim m-0" style={{ fontSize: 16 }}>
          {getLocalized(article, 'content', language).replace(/[#*_>`|-]/g, ' ').split('\n').filter(Boolean)[0]?.slice(0, 140)}
          {getLocalized(article, 'content', language).length > 140 ? '…' : ''}
        </p>
      </div>
    </a>
  );
});
StoryCard.displayName = 'StoryCard';

const Home: React.FC = () => {
  const { language, t } = useLanguage();
  const { handleFavoriteToggle, isFavorited } = useFavorites();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => {
    try { return localStorage.getItem('rostory_selected_category'); } catch { return null; }
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = (() => {
    const raw = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  })();
  const currentPage = pageFromUrl;
  const setCurrentPage = useCallback((updater: number | ((prev: number) => number)) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const rawPrev = parseInt(prev.get('page') || '1', 10);
      const prevPage = Number.isFinite(rawPrev) && rawPrev > 0 ? rawPrev : 1;
      const nextPage = typeof updater === 'function' ? updater(prevPage) : updater;
      if (nextPage <= 1) next.delete('page');
      else next.set('page', String(nextPage));
      return next;
    }, { replace: false });
  }, [setSearchParams]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const handleOpenArticle = useCallback((a: Article) => navigate(`/article/${a.id}`, { state: { from: '/' } }), [navigate]);

  const handleRandomStory = async () => {
    const a = await fetchRandomArticle();
    if (a) navigate(`/article/${a.id}`, { state: { from: '/' } });
  };

  const handleCategoryChange = (catId: string | null) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (selectedCategory) localStorage.setItem('rostory_selected_category', selectedCategory);
      else localStorage.removeItem('rostory_selected_category');
    } catch { /* ignore */ }
  }, [selectedCategory]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchArticlesPage(currentPage, PAGE_SIZE, selectedCategory)
      .then(({ articles, total }) => {
        if (cancelled) return;
        setArticles(articles);
        setTotalCount(total);
      })
      .catch((error) => { if (!isAbortError(error)) console.error('Error fetching articles:', error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [currentPage, selectedCategory]);

  const pageTitle = language === 'en' ? 'The RoStory — Stories of Romania' : 'The RoStory — Povești din România';
  const pageDescription = language === 'en'
    ? 'Discover the culture, history, and traditions of Romania through visual stories — articles, videos, and photo galleries from every region.'
    : 'Descoperă cultura, istoria și tradițiile României prin povești vizuale — articole, videoclipuri și galerii foto din fiecare regiune.';

  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      'https://www.instagram.com/therostory',
      'https://www.tiktok.com/@therostory',
      'https://www.youtube.com/@therostory',
    ],
  };

  const prevPageUrl = currentPage > 1 ? `${SITE_URL}/?page=${currentPage - 1}` : null;
  const nextPageUrl = currentPage < totalPages ? `${SITE_URL}/?page=${currentPage + 1}` : null;

  // The magazine-style featured spread is editorial top picks — only meaningful
  // when viewing the full archive. When a category is selected, treat the
  // request as a filter and route every article into the explore grid so users
  // don't get an empty section.
  const showFeatured = selectedCategory === null && currentPage === 1 && articles.length >= 1;
  const featured = showFeatured ? articles[0] : undefined;
  const second = showFeatured ? articles[1] : undefined;
  const third = showFeatured ? articles[2] : undefined;
  const latest = articles;

  const tickerItems = language === 'en'
    ? ['Dacia · Wallachia · Moldavia', '1859 — The Small Union', 'Transilvania · Bucovina · Dobrogea', 'Folktales of the Carpathians', 'Wooden churches of Maramureș', 'Salt mines beneath the Apuseni']
    : ['Dacia · Țara Românească · Moldova', '1859 — Mica Unire', 'Transilvania · Bucovina · Dobrogea', 'Povești din Carpați', 'Bisericile de lemn din Maramureș', 'Salinele de sub Apuseni'];

  return (
    <>
      <PageHead title={pageTitle} description={pageDescription} language={language}>
        <script type="application/ld+json">{JSON.stringify(organizationLd)}</script>
        {prevPageUrl && <link rel="prev" href={prevPageUrl} />}
        {nextPageUrl && <link rel="next" href={nextPageUrl} />}
      </PageHead>

      <div className="screen-anim">
        {/* CINEMATIC HERO */}
        <section
          className="relative overflow-hidden"
          style={{ minHeight: 'min(calc(100vh - 76px), 760px)', borderBottom: '1px solid var(--line-soft)' }}
        >
          <div className="absolute inset-0">
            <picture>
              <source type="image/avif" srcSet="/hero/castle.avif" />
              <source type="image/webp" srcSet="/hero/castle.webp" />
              <img
                src="/hero/castle.jpg"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                style={{ filter: 'grayscale(0.1) contrast(1.05)' }}
              />
            </picture>
            <div
              className="absolute inset-0"
              style={{
                background:
                  'var(--scrim-hero)',
              }}
            />
          </div>

          <div className="ed-container relative h-full flex flex-col justify-between" style={{ paddingTop: 64, paddingBottom: 56 }}>
            <div className="flex items-start justify-between">
              <div className="pill">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 8px var(--gold)' }} />
                {language === 'en' ? 'An archive of the Romanian imagination' : 'O arhivă a imaginației românești'}
              </div>
              <div className="text-right font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(255, 255, 255, 0.7)' }}>
                <div>{language === 'en' ? 'Issue No. 14' : 'Numărul 14'}</div>
                <div className="mt-1.5" style={{ color: '#f0e3c2', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {language === 'en' ? 'Spring · 2026' : 'Primăvara · 2026'}
                </div>
              </div>
            </div>

            <div style={{ maxWidth: 980 }}>
              <h1
                className="font-display italic font-medium m-0"
                style={{
                  fontSize: 'clamp(64px, 10vw, 156px)',
                  lineHeight: 0.92,
                  letterSpacing: '-0.02em',
                  color: '#f4ead7',
                  textWrap: 'balance' as React.CSSProperties['textWrap'],
                  whiteSpace: 'pre-line',
                }}
              >
                {language === 'en'
                  ? 'The land remembers,\nin a hundred quiet voices.'
                  : 'Pământul își amintește,\nîn o sută de voci tăcute.'}
              </h1>
              <p
                className="mt-8 max-w-[560px]"
                style={{ fontSize: 20, lineHeight: 1.55, color: 'rgba(255, 255, 255, 0.7)' }}
              >
                {language === 'en'
                  ? 'A living archive of histories, traditions, and visual stories — gathered village by village, century by century, across the country we call home.'
                  : 'O arhivă vie de istorii, tradiții și povești vizuale — adunate sat cu sat, secol cu secol, prin țara pe care o numim acasă.'}
              </p>
              <div className="flex items-center gap-3.5 mt-9 flex-wrap">
                <button className="btn-ed" onClick={() => navigate('/map')}>
                  {language === 'en' ? 'Open the map' : 'Deschide harta'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button className="btn-ed btn-ed-ghost" onClick={() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })}>
                  {language === 'en' ? 'Browse the archive' : 'Explorează arhiva'}
                </button>
                <button className="btn-ed btn-ed-ghost" onClick={handleRandomStory}>
                  {language === 'en' ? 'Random story' : 'Poveste aleatorie'}
                </button>
              </div>
            </div>
          </div>

          <div
            className="absolute hidden md:block font-ui text-[10px] uppercase"
            style={{
              right: 'var(--gutter)', bottom: 140,
              letterSpacing: '0.22em', color: 'rgba(255, 255, 255, 0.5)',
              writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            }}
          >
            {language === 'en' ? 'Photograph · The RoStory · Spring 2026' : 'Fotografie · The RoStory · Primăvara 2026'}
          </div>
        </section>

        {/* TICKER */}
        <section className="ticker overflow-hidden" style={{ borderBottom: '1px solid var(--line-soft)', padding: '22px 0', background: 'var(--overlay-ticker)' }}>
          <div className="ticker-track">
            {[...tickerItems, ...tickerItems, ...tickerItems].map((tx, i) => (
              <div key={i} className="flex items-center gap-12 whitespace-nowrap" style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 22, color: 'var(--gold)' }}>
                <span>{tx}</span>
                <span style={{ color: 'var(--text-mute)' }}>✦</span>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURED — magazine-style spread */}
        {featured && (
          <section style={{ padding: '120px 0 80px' }}>
            <div className="ed-container">
              <SectionHeader
                eyebrow={language === 'en' ? 'Featured this season' : 'Recomandate sezonul acesta'}
                title={language === 'en' ? 'Three deep readings\non Romania this season.' : 'Trei lecturi profunde\ndespre România în acest sezon.'}
                action={<span className="font-ui text-[11px] uppercase text-ink-mute" style={{ letterSpacing: '0.22em' }}>{language === 'en' ? 'Editorial selection' : 'Selecție editorială'}</span>}
              />

              <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-14 items-stretch">
                <a href="#" onClick={(e) => { e.preventDefault(); handleOpenArticle(featured); }} className="block" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="ph relative" data-tone={toneFor(featured.id)} data-label={placeLabel(featured)} style={{ aspectRatio: '5/6' }}>
                    {(featured.mediaUrl || featured.posterUrl) && (
                      <img src={featured.mediaUrl || featured.posterUrl} alt={getLocalized(featured, 'title', language)} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    )}
                    <div className="absolute left-6 top-6">
                      <span className="pill" style={{ background: 'var(--overlay-deep)' }}>{language === 'en' ? 'Lead story' : 'Articolul principal'}</span>
                    </div>
                  </div>
                  <div className="pt-7">
                    <div className="eyebrow">
                      {categoryMap.get(featured.categoryId) ? getLocalized(categoryMap.get(featured.categoryId)!, 'name', language) : ''} · {readMinutes(featured, language)} {language === 'en' ? 'min read' : 'min citire'}
                    </div>
                    <h3
                      className="font-display italic font-medium m-0 mb-3.5 mt-5"
                      style={{ fontSize: 'clamp(40px, 4.4vw, 60px)', lineHeight: 1.05, color: 'var(--parchment)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
                    >
                      {getLocalized(featured, 'title', language)}
                    </h3>
                    <p className="text-ink-dim m-0 max-w-[620px]" style={{ fontSize: 19, lineHeight: 1.55 }}>
                      {getLocalized(featured, 'content', language).split('\n').filter(Boolean)[0]?.slice(0, 220)}
                      {getLocalized(featured, 'content', language).length > 220 ? '…' : ''}
                    </p>
                  </div>
                </a>

                <div className="flex flex-col gap-12 justify-between">
                  {[second, third].filter(Boolean).map(s => (
                    <StoryCard
                      key={s!.id}
                      article={s!}
                      category={categoryMap.get(s!.categoryId)}
                      language={language}
                      size="wide"
                      isArticleFavorited={isFavorited(s!.id)}
                      onOpen={handleOpenArticle}
                      onFavoriteToggle={handleFavoriteToggle}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PULL QUOTE BREAK */}
        <section style={{ padding: '60px 0', borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)', background: 'linear-gradient(180deg, transparent, rgba(201,169,110,0.04), transparent)' }}>
          <div className="ed-container">
            <div className="flex items-center gap-12">
              <div className="hidden md:block font-display italic" style={{ flex: '0 0 auto', fontSize: 64, color: 'var(--gold)', lineHeight: 1 }}>“</div>
              <p
                className="m-0 font-display italic"
                style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.25, color: 'var(--parchment)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
              >
                {language === 'en'
                  ? "We don't keep an archive because the past is finished. We keep one because it isn't."
                  : 'Nu ținem o arhivă pentru că trecutul s-a încheiat. O ținem pentru că nu s-a încheiat.'}
              </p>
            </div>
          </div>
        </section>

        {/* LATEST GRID */}
        <section id="explore" style={{ padding: '120px 0 60px' }}>
          <div className="ed-container">
            <SectionHeader
              eyebrow={language === 'en' ? 'Latest stories' : 'Ultimele povești'}
              title={language === 'en' ? 'From the field.' : 'Din teren.'}
              sub={language === 'en' ? 'New stories, fresh from the road.' : 'Povești noi, proaspete de pe drum.'}
              action={
                <button className="btn-ed btn-ed-ghost" onClick={() => navigate('/categories')}>
                  {language === 'en' ? 'All categories →' : 'Toate categoriile →'}
                </button>
              }
            />

            {/* Category filter pills */}
            <div className="flex flex-wrap gap-2 mb-12">
              <button
                onClick={() => handleCategoryChange(null)}
                className="px-3.5 py-2 font-ui text-[11px] uppercase rounded-full cursor-pointer transition-colors"
                style={{
                  letterSpacing: '0.15em',
                  border: '1px solid var(--line)',
                  background: selectedCategory === null ? 'var(--gold)' : 'transparent',
                  color: selectedCategory === null ? 'var(--ink)' : 'var(--text-dim)',
                }}
              >
                {language === 'en' ? 'All' : 'Toate'}
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleCategoryChange(c.id)}
                  className="px-3.5 py-2 font-ui text-[11px] uppercase rounded-full cursor-pointer transition-colors"
                  style={{
                    letterSpacing: '0.15em',
                    border: '1px solid var(--line)',
                    background: selectedCategory === c.id ? 'var(--gold)' : 'transparent',
                    color: selectedCategory === c.id ? 'var(--ink)' : 'var(--text-dim)',
                  }}
                >
                  {getLocalized(c, 'name', language)}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 gap-y-10 md:gap-y-[72px]">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} style={{ aspectRatio: '3/4', border: '1px solid var(--line)', background: 'var(--ink-2)' }} className="animate-pulse" />
                ))}
              </div>
            ) : (latest.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 gap-y-10 md:gap-y-[72px]">
                  {latest.map(article => (
                    <StoryCard
                      key={article.id}
                      article={article}
                      category={categoryMap.get(article.categoryId)}
                      language={language}
                      size="md"
                      isArticleFavorited={isFavorited(article.id)}
                      onOpen={handleOpenArticle}
                      onFavoriteToggle={handleFavoriteToggle}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-6 pt-12 mt-4">
                    <button
                      className="btn-ed btn-ed-ghost"
                      onClick={() => setCurrentPage(p => p - 1)}
                      disabled={currentPage === 1}
                      style={{ opacity: currentPage === 1 ? 0.4 : 1 }}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      {language === 'en' ? 'Previous' : 'Anterior'}
                    </button>
                    <span className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
                      {language === 'en' ? `Page ${currentPage} of ${totalPages}` : `Pagina ${currentPage} din ${totalPages}`}
                    </span>
                    <button
                      className="btn-ed btn-ed-ghost"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage === totalPages}
                      style={{ opacity: currentPage === totalPages ? 0.4 : 1 }}
                    >
                      {language === 'en' ? 'Next' : 'Următor'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-24 text-center">
                <div className="font-display italic text-2xl text-ink-dim">{t('articles.noArticles')}</div>
              </div>
            ))}
          </div>
        </section>

        {/* NEWSLETTER STRIP */}
        <section
          style={{
            padding: '80px 0',
            marginTop: 60,
            background: 'linear-gradient(180deg, rgba(201,169,110,0.05), rgba(138,42,42,0.04))',
            borderTop: '1px solid var(--line-soft)',
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <div className="ed-container">
            <div className="flex flex-wrap items-center justify-between gap-10">
              <div style={{ maxWidth: 540 }}>
                <div className="eyebrow mb-3.5">{language === 'en' ? 'The dispatch' : 'Buletinul'}</div>
                <h3
                  className="font-display italic font-medium m-0"
                  style={{ fontSize: 'clamp(28px, 3vw, 44px)', lineHeight: 1.1, color: 'var(--parchment)' }}
                >
                  {language === 'en' ? 'One letter a month, from the road.' : 'O scrisoare pe lună, de pe drum.'}
                </h3>
                <p className="text-ink-dim mt-3" style={{ fontSize: 16 }}>
                  {language === 'en' ? 'Field notes, photographs, and the occasional recipe. Free.' : 'Note de teren, fotografii și, ocazional, o rețetă. Gratuit.'}
                </p>
              </div>
              <form
                className="flex gap-2 ed-form w-full"
                style={{ flex: '1 1 260px', maxWidth: 520 }}
                onSubmit={(e) => e.preventDefault()}
              >
                <input
                  type="email"
                  placeholder={language === 'en' ? 'your@email.com' : 'email@tau.ro'}
                  style={{ flex: 1, background: 'transparent', borderRadius: 999, padding: '16px 22px' }}
                />
                <button type="submit" className="btn-ed">{language === 'en' ? 'Subscribe' : 'Abonează-te'}</button>
              </form>
            </div>
          </div>
        </section>
      </div>

    </>
  );
};

const SectionHeader: React.FC<{ eyebrow?: string; title: string; sub?: string; action?: React.ReactNode }> = ({ eyebrow, title, sub, action }) => (
  <div className="flex flex-wrap justify-between items-end gap-6 mb-12">
    <div style={{ maxWidth: 720 }}>
      {eyebrow && <div className="eyebrow mb-3.5">{eyebrow}</div>}
      <h2
        className="font-display italic font-medium m-0"
        style={{
          fontSize: 'clamp(36px, 5vw, 64px)',
          lineHeight: 1.05,
          color: 'var(--parchment)',
          textWrap: 'balance' as React.CSSProperties['textWrap'],
          whiteSpace: 'pre-line',
        }}
      >
        {title}
      </h2>
      {sub && <p className="text-ink-dim mt-4 max-w-[600px]" style={{ fontSize: 18 }}>{sub}</p>}
    </div>
    {action}
  </div>
);

export default Home;
