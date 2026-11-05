import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Category, Article, Journey, getLocalized, supabase, toCamelCase, fetchArticlesPage, fetchArchiveIndex, fetchArticleCardsByIds, fetchCategories, fetchJourneys } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { Loader2 } from "lucide-react";
import { isAbortError, toJsonLd } from "@/lib/utils";
import { PageHead } from "@/components/layout/PageHead";
import { StoryCard } from "@/components/ui/story-card";
import { LoadError } from "@/components/ui/load-error";
import { SITE_URL } from "@/lib/constants";
import { localizedPath } from "@/lib/locale";
import { countLabel, joinMeta, type CountNoun } from "@/lib/article-utils";
import { categoryDescription, categoryImageSources, getCategoryImage } from "@/lib/category-copy";
import { formatYear, placeOf } from "@/lib/story-facts";
import { StoryLoading, Thread } from "@/components/story/Ornaments";
import { MiniMap } from "@/components/story/MiniMap";

// Fetched in pages so a large category doesn't pull hundreds of full-content
// rows (previously: up to 500 articles × both 50k-char content columns in
// one request).
const CATEGORY_PAGE_SIZE = 24;

const kindNoun = (a: Article): CountNoun =>
  a.type === 'video' ? 'film'
    : a.type === 'carousel' ? 'visualEssay'
      : a.subtype === 'poetry' ? 'poem'
        : a.subtype === 'short_story' ? 'shortStory'
          : 'essay';

/**
 * The line under a shelf's title: how many stories, in which forms, from
 * when — "3 stories · all films · timeless". Forms and dates are only told
 * once every story on the shelf has loaded, so the line never describes half
 * a shelf as if it were all of it.
 */
const shelfFacts = (articles: Article[], total: number, complete: boolean, language: 'en' | 'ro'): string => {
  const parts = [countLabel(total, 'story', language)];
  if (!complete || !articles.length) return parts[0];

  const kinds = new Map<CountNoun, number>();
  articles.forEach((a) => kinds.set(kindNoun(a), (kinds.get(kindNoun(a)) || 0) + 1));
  if (kinds.size === 1 && articles.length > 1) {
    const [noun] = [...kinds.keys()];
    const plural = countLabel(2, noun, language).replace(/^2\s+/, '');
    parts.push(language === 'en' ? `all ${plural}` : `toate sunt ${plural}`);
  } else if (kinds.size > 1) {
    parts.push([...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([noun, n]) => countLabel(n, noun, language)).join(', '));
  }

  const dated = articles.filter((a) => a.yearStart != null);
  if (dated.length) {
    const from = Math.min(...dated.map((a) => a.yearStart as number));
    const to = Math.max(...dated.map((a) => (a.yearEnd ?? a.yearStart) as number));
    parts.push(from === to ? formatYear(from, language) : `${formatYear(from, language)}–${formatYear(to, language)}`);
  } else if (articles.every((a) => a.timeless)) {
    parts.push(language === 'en' ? 'timeless' : 'atemporale');
  }
  return joinMeta(parts);
};

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
  // Tracked explicitly rather than derived from articles.length. The dedupe
  // in loadMore can leave the list short of a page boundary (an article
  // published mid-browse shifts the offset window), and the derived form
  // then recomputed the *same* page — so "Load more" fetched rows it had
  // already filtered out and appeared to do nothing.
  const [loadedPages, setLoadedPages] = useState(1);
  // End-of-data is decided by a short page from the server, not by comparing
  // articles.length against totalCount. Those can disagree permanently once
  // the dedupe drops a row, which left "Load more" visible forever.
  const [reachedEnd, setReachedEnd] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [otherShelves, setOtherShelves] = useState<Category[]>([]);
  const [journey, setJourney] = useState<{ journey: Journey; stops: Article[] } | null>(null);
  const en = language === 'en';

  // Stable identity so StoryCard's React.memo can skip re-renders — an
  // inline object literal would defeat the shallow prop comparison.
  const cardLinkState = useMemo(() => ({ from: `/category/${id}`, category: id }), [id]);

  // Hoisted so the failure state can re-run it. Takes its own cancellation
  // signal rather than closing over one, so a retry started after the effect
  // has torn down still applies its result.
  const loadData = useCallback(async (isCancelled: () => boolean = () => false) => {
    if (!id) { navigate("/categories"); return; }
    setIsLoading(true);
    setLoadFailed(false);
    setArticles([]);
    setTotalCount(0);
    setLoadedPages(1);
    setReachedEnd(false);
    try {
      const [categoryRes, articlesPage] = await Promise.all([
        supabase.from('categories').select('*').eq('id', id).maybeSingle(),
        fetchArticlesPage(1, CATEGORY_PAGE_SIZE, id),
      ]);
      if (isCancelled()) return;
      if (categoryRes.error) throw categoryRes.error;
      if (!categoryRes.data) { navigate("/categories"); return; }
      setCategory(toCamelCase<Category>(categoryRes.data));
      setArticles(articlesPage.articles);
      setTotalCount(articlesPage.total);
      setReachedEnd(articlesPage.articles.length < CATEGORY_PAGE_SIZE);
    } catch (error) {
      if (isCancelled()) return;
      if (!isAbortError(error)) {
        console.error("Error loading category content:", error);
        setLoadFailed(true);
      }
    } finally {
      if (!isCancelled()) setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    let cancelled = false;
    loadData(() => cancelled);
    return () => { cancelled = true; };
  }, [loadData]);

  // The rest of the page is garnish — the other shelves, and a journey that
  // walks through this one. Each fails quietly by leaving its section off.
  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((cats) => { if (!cancelled) setOtherShelves(cats.filter((c) => c.id !== id)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setJourney(null);
    (async () => {
      const [journeys, index] = await Promise.all([fetchJourneys(), fetchArchiveIndex()]);
      const onShelf = new Set(index.filter((a) => a.categoryId === id).map((a) => a.id));
      // The journey that spends the most stops on this shelf, if it spends
      // at least two there.
      const best = journeys
        .map((j) => ({ j, n: j.stops.filter((s) => onShelf.has(s)).length }))
        .filter((x) => x.n >= 2)
        .sort((a, b) => b.n - a.n)[0];
      if (!best) return;
      const cards = await fetchArticleCardsByIds(best.j.stops);
      const byId = new Map(cards.map((c) => [c.id, c]));
      const stops = best.j.stops.map((s) => byId.get(s)).filter((s): s is Article => !!s);
      if (!cancelled && stops.length >= 2) setJourney({ journey: best.j, stops });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const loadMore = async () => {
    if (!id || isLoadingMore || reachedEnd) return;
    setIsLoadingMore(true);
    try {
      const nextPage = loadedPages + 1;
      const { articles: more, total } = await fetchArticlesPage(nextPage, CATEGORY_PAGE_SIZE, id);
      setArticles(prev => {
        const seen = new Set(prev.map(a => a.id));
        return [...prev, ...more.filter(a => !seen.has(a.id))];
      });
      setTotalCount(total);
      setLoadedPages(nextPage);
      if (more.length < CATEGORY_PAGE_SIZE) setReachedEnd(true);
    } catch (error) {
      if (!isAbortError(error)) console.error("Error loading more articles:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <StoryLoading language={language} className="items-center" style={{ minHeight: '100vh' }} />
    );
  }
  if (loadFailed) {
    return (
      <div className="screen-anim">
        <section className="ed-container" style={{ padding: '80px 0' }}>
          <LoadError onRetry={() => loadData()} />
        </section>
      </div>
    );
  }
  if (!category) return null;

  const categoryName = getLocalized(category, "name", language);
  const pageTitle = categoryName;
  const pageDescription = en
    ? `Stories about ${categoryName} — explore Romania through ${countLabel(totalCount, "story", "en")} curated by The RoStory.`
    : `Povești despre ${categoryName} — descoperă România prin ${countLabel(totalCount, "story", "ro")} pe The RoStory.`;

  // Locale-prefixed throughout. These were hardcoded to the English tree, so
  // /ro/category/x served structured data whose every URL contradicted the
  // page's own canonical — breadcrumbs pointing readers into English and an
  // ItemList of English article URLs on a Romanian page.
  const url = (path: string) => `${SITE_URL}${localizedPath(language, path)}`;

  const breadcrumbLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: en ? "Home" : "Acasă", item: url("/") },
      { "@type": "ListItem", position: 2, name: en ? "Categories" : "Categorii", item: url("/categories") },
      { "@type": "ListItem", position: 3, name: categoryName, item: url(`/category/${category.id}`) },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org", "@type": "ItemList",
    itemListElement: articles.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: url(`/article/${a.id}`), name: getLocalized(a, "title", language) })),
  };

  const art = getCategoryImage(category.slug || categoryName.toLowerCase());
  const journeyPlaces = journey
    ? journey.stops
        .map((s) => placeOf(s, language) || (en ? 'across the country' : 'în toată țara'))
        .filter((p, i, all) => i === 0 || p !== all[i - 1])
    : [];

  return (
    <div className="screen-anim">
      <PageHead title={pageTitle} description={pageDescription} language={language}>
        <script type="application/ld+json">{toJsonLd(breadcrumbLd)}</script>
        <script type="application/ld+json">{toJsonLd(itemListLd)}</script>
      </PageHead>

      <section className="ed-container" style={{ paddingTop: 40, paddingBottom: 'clamp(56px, 7vw, 88px)' }}>
        <nav aria-label={en ? 'Breadcrumb' : 'Navigare'} className="mb-10">
          <ol className="flex flex-wrap items-center gap-2.5 list-none m-0 p-0 font-display italic text-[18px]" style={{ color: 'var(--text-mute)' }}>
            <li><Link to="/" className="transition-colors hover:text-gold" style={{ color: 'var(--text-dim)' }}>{en ? 'Home' : 'Acasă'}</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link to="/categories" className="transition-colors hover:text-gold" style={{ color: 'var(--text-dim)' }}>{en ? 'Categories' : 'Categorii'}</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" style={{ color: 'var(--gold)' }}>{categoryName}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-10 lg:gap-16 items-center">
          <div className="flex flex-col gap-5">
            <p className="sb-kicker">{en ? 'A shelf of the archive' : 'Un raft al arhivei'}</p>
            <h1 className="sb-h1">{categoryName}</h1>
            <p className="sb-lede max-w-[560px]">{categoryDescription(category.slug, categoryName, language)}</p>
            <div className="flex items-center gap-3.5 mt-2">
              <Thread style={{ width: 56 }} />
              <p className="sb-meta">{shelfFacts(articles, totalCount, reachedEnd, language)}</p>
            </div>
          </div>
          <div className="sb-window w-full max-w-[440px] justify-self-center lg:justify-self-end">
            <div className="sb-arch" style={{ aspectRatio: '4 / 4.6' }}>
              <picture>
                <source type="image/avif" srcSet={categoryImageSources(art).avif} sizes="(min-width: 1024px) 440px, 90vw" />
                <source type="image/webp" srcSet={categoryImageSources(art).webp} sizes="(min-width: 1024px) 440px, 90vw" />
                <img src={`${art}.jpg`} alt="" width={1024} height={1024} decoding="async" className="absolute inset-0 w-full h-full object-cover" />
              </picture>
            </div>
          </div>
        </div>
      </section>

      <section className="ed-container" style={{ paddingBottom: 'clamp(56px, 7vw, 88px)' }}>
        <div className="flex flex-wrap justify-between items-end gap-5 mb-2">
          <h2 className="sb-h2" style={{ fontSize: 'clamp(32px, 3.4vw, 46px)' }}>{en ? 'Contents' : 'Cuprins'}</h2>
          {articles.length > 1 && <p className="sb-kicker-sm" style={{ color: 'var(--text-dim)' }}>{en ? 'Newest first' : 'Cele mai noi întâi'}</p>}
        </div>
        <Thread style={{ opacity: 0.35 }} />
        {articles.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center gap-6">
            <p className="font-display italic text-2xl sb-dim">{t("articles.noArticles")}</p>
            <Link to="/categories" className="sb-btn sb-btn-ghost">
              {en ? 'Explore other categories' : 'Explorează alte categorii'}
            </Link>
          </div>
        ) : (
          <div>
            {articles.map((article, i) => (
              <StoryCard
                key={article.id}
                article={article}
                category={category}
                language={language}
                size="row"
                index={i}
                linkState={cardLinkState}
                isArticleFavorited={isFavorited(article.id)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        )}

        {articles.length > 0 && !reachedEnd && (
          <div className="flex justify-center pt-12">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="sb-btn sb-btn-ghost"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="sb-ico animate-spin" aria-hidden="true" />
                  {en ? 'Loading…' : 'Se încarcă…'}
                </>
              ) : (
                // Clamped: totalCount is the server's count for the whole
                // category, while articles.length reflects what survived
                // de-duplication, so the difference can drift negative.
                en
                  ? `Turn the page (${Math.max(0, totalCount - articles.length)} more)`
                  : `Întoarce pagina (încă ${Math.max(0, totalCount - articles.length)})`
              )}
            </button>
          </div>
        )}
      </section>

      {journey && (
        <section className="ed-container" style={{ paddingBottom: 'clamp(64px, 8vw, 104px)' }}>
          <div className="sb-place-card md:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto] md:items-center md:gap-9" style={{ padding: 'clamp(22px, 3vw, 28px) clamp(22px, 3vw, 36px)' }}>
            <MiniMap stories={journey.stops} />
            <div className="flex flex-col gap-2.5">
              <p className="sb-kicker">{en ? 'Follow them as a journey' : 'Urmează-le ca pe o călătorie'}</p>
              <h2 className="sb-h3">{getLocalized(journey.journey, 'title', language)}</h2>
              {getLocalized(journey.journey, 'intro', language) && (
                <p className="sb-dim text-[17px] leading-relaxed">{getLocalized(journey.journey, 'intro', language)}</p>
              )}
              <p className="sb-meta">{countLabel(journey.stops.length, 'stop', language)} · {journeyPlaces.join(' → ')}</p>
            </div>
            <Link to={`/map?journey=${journey.journey.id}`} className="sb-btn justify-self-start">
              {en ? 'Start on the map →' : 'Pornește pe hartă →'}
            </Link>
          </div>
        </section>
      )}

      {otherShelves.length > 0 && (
        <section className="sb-band">
          <div className="ed-container" style={{ paddingTop: 72, paddingBottom: 72 }}>
            <p className="sb-kicker mb-7">{en ? 'Other shelves' : 'Alte rafturi'}</p>
            <ul className="list-none m-0 p-0 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-x-5 gap-y-8">
              {otherShelves.map((c) => {
                const name = getLocalized(c, 'name', language);
                const img = getCategoryImage(c.slug || name.toLowerCase());
                return (
                  <li key={c.id}>
                    <Link to={`/category/${c.id}`} className="sb-card grid gap-2.5 justify-items-center text-center">
                      <div className="sb-arch sb-card-media w-full" style={{ aspectRatio: '3 / 4' }}>
                        <picture>
                          <source type="image/avif" srcSet={categoryImageSources(img).avif} sizes="(min-width: 1024px) 13vw, (min-width: 640px) 23vw, 31vw" />
                          <source type="image/webp" srcSet={categoryImageSources(img).webp} sizes="(min-width: 1024px) 13vw, (min-width: 640px) 23vw, 31vw" />
                          <img src={`${img}.jpg`} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                        </picture>
                      </div>
                      <span className="font-display italic text-[19px] leading-tight" style={{ color: 'var(--parchment)' }}>{name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
};

export default CategoryDetail;
