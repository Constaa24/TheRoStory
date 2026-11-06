import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Category, Article, Journey, getLocalized, supabase, toCamelCase, fetchArticlesPage, fetchArchiveIndex, fetchArticleCardsByIds, fetchCategories, fetchJourneys, fetchViewCounts } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import { isAbortError, toJsonLd } from "@/lib/utils";
import { PageHead } from "@/components/layout/PageHead";
import { StoryCard } from "@/components/ui/story-card";
import { LoadError } from "@/components/ui/load-error";
import { SITE_URL } from "@/lib/constants";
import { localizedPath } from "@/lib/locale";
import { countLabel, joinMeta, type CountNoun } from "@/lib/article-utils";
import { categoryDescription, categoryImageSources, getCategoryImage } from "@/lib/category-copy";
import { formatYear, kindWord, placeOf } from "@/lib/story-facts";
import { StoryLoading } from "@/components/story/Ornaments";
import { MiniMap } from "@/components/story/MiniMap";

// Fetched in pages so a large category doesn't pull hundreds of full-content
// rows at once; most shelves fit in the first.
const CATEGORY_PAGE_SIZE = 36;

type Sort = 'new' | 'old' | 'era' | 'read';
type Layout = 'grid' | 'list';
const LAYOUT_KEY = 'rostory_shelf_layout';

const kindNoun = (a: Article): CountNoun =>
  a.type === 'video' ? 'film'
    : a.type === 'carousel' ? 'visualEssay'
      : a.subtype === 'poetry' ? 'poem'
        : a.subtype === 'short_story' ? 'shortStory'
          : 'essay';

/**
 * The line beside a shelf's title: how many stories, in which forms, from
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

/** A shelf (the redesign's Shelves detail): its stories, by kind and in the reader's order. */
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
  const [moreFailed, setMoreFailed] = useState(false);
  const [otherShelves, setOtherShelves] = useState<Category[]>([]);
  const [journey, setJourney] = useState<{ journey: Journey; stops: Article[] } | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  const [views, setViews] = useState<Record<string, number> | null>(null);
  const [layout, setLayoutState] = useState<Layout>(() => {
    try { return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const en = language === 'en';

  const setLayout = (next: Layout) => {
    setLayoutState(next);
    try { localStorage.setItem(LAYOUT_KEY, next); } catch { /* ignore */ }
  };

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
    setMoreFailed(false);
    setKind(null);
    setViews(null);
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

  // "Most read" needs the counts, fetched the first time it is chosen.
  useEffect(() => {
    if (sort !== 'read' || views || !articles.length) return;
    let cancelled = false;
    fetchViewCounts(articles.map((a) => a.id))
      .then((v) => { if (!cancelled) setViews(v); })
      .catch(() => { if (!cancelled) setViews({}); });
    return () => { cancelled = true; };
  }, [sort, views, articles]);

  const loadMore = useCallback(async () => {
    if (!id || isLoadingMore || reachedEnd) return;
    setIsLoadingMore(true);
    setMoreFailed(false);
    try {
      const nextPage = loadedPages + 1;
      const { articles: more, total } = await fetchArticlesPage(nextPage, CATEGORY_PAGE_SIZE, id);
      setArticles((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...more.filter((a) => !seen.has(a.id))];
      });
      setTotalCount(total);
      setLoadedPages(nextPage);
      setViews(null);
      if (more.length < CATEGORY_PAGE_SIZE) setReachedEnd(true);
    } catch (error) {
      if (!isAbortError(error)) console.error("Error loading more articles:", error);
      setMoreFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [id, isLoadingMore, reachedEnd, loadedPages]);

  // An order other than newest first, or a kind filter, ranks the whole
  // shelf: the pages not loaded yet come in first, or "Oldest first" would
  // only have reversed the newest page. (A failed page stops the chain; the
  // "Load more" button is still there to try again.)
  useEffect(() => {
    if ((sort === 'new' && !kind) || isLoading || reachedEnd || isLoadingMore || moreFailed) return;
    void loadMore();
  }, [sort, kind, isLoading, reachedEnd, isLoadingMore, moreFailed, loadMore]);

  const kinds = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of articles) {
      const k = kindNoun(a);
      if (!seen.has(k)) seen.set(k, kindWord(a, language));
    }
    return [...seen.entries()];
  }, [articles, language]);

  const items = useMemo(() => {
    const list = (kind ? articles.filter((a) => kindNoun(a) === kind) : articles).slice();
    if (sort === 'old') list.reverse();
    // Undated stories (legends) go to the end of the timeline.
    if (sort === 'era') list.sort((a, b) => (a.yearStart ?? Infinity) - (b.yearStart ?? Infinity));
    if (sort === 'read' && views) list.sort((a, b) => (views[b.id] || 0) - (views[a.id] || 0));
    return list;
  }, [articles, kind, sort, views]);

  if (isLoading) {
    return <StoryLoading language={language} className="items-center" style={{ minHeight: '100vh' }} />;
  }
  if (loadFailed) {
    return (
      <div className="rs-in">
        <section className="ed-container" style={{ padding: '80px 0' }}>
          <LoadError onRetry={() => loadData()} />
        </section>
      </div>
    );
  }
  if (!category) return null;

  const categoryName = getLocalized(category, "name", language);
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
      { "@type": "ListItem", position: 1, name: en ? "Shelves" : "Rafturi", item: url("/categories") },
      { "@type": "ListItem", position: 2, name: categoryName, item: url(`/category/${category.id}`) },
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
    <div className="rs-in">
      <PageHead title={categoryName} description={pageDescription} language={language}>
        <script type="application/ld+json">{toJsonLd(breadcrumbLd)}</script>
        <script type="application/ld+json">{toJsonLd(itemListLd)}</script>
      </PageHead>

      {/* The shelf's picture, faint behind its name. */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <picture aria-hidden="true">
          <source type="image/avif" srcSet={categoryImageSources(art).avif} sizes="100vw" />
          <source type="image/webp" srcSet={categoryImageSources(art).webp} sizes="100vw" />
          <img src={`${art}.jpg`} alt="" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.22, filter: 'blur(2px) saturate(.8)' }} />
        </picture>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, var(--ink) 92%)' }} />
        <div className="ed-container relative grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_auto] gap-x-16 gap-y-8 items-end" style={{ paddingTop: 'clamp(32px, 5vw, 64px)', paddingBottom: 'clamp(40px, 5vw, 64px)' }}>
          <div>
            <nav aria-label={en ? 'Breadcrumb' : 'Fir de navigare'}>
              <ol className="rs-crumbs">
                <li><Link to="/categories">{en ? 'Shelves' : 'Rafturi'}</Link></li>
                <li aria-hidden="true" style={{ color: 'var(--text-mute)' }}>/</li>
                <li aria-current="page" style={{ color: 'var(--gold)' }}>{categoryName}</li>
              </ol>
            </nav>
            <h1 className="rs-display" style={{ margin: '0 0 18px', fontSize: 'clamp(52px, 7vw, 108px)', lineHeight: 0.94, letterSpacing: '-0.025em' }}>{categoryName}</h1>
            <p className="m-0 max-w-[620px]" style={{ fontSize: 20, lineHeight: 1.55, color: 'var(--text)', textWrap: 'pretty' }}>
              {categoryDescription(category.slug, categoryName, language)}
            </p>
          </div>
          <div className="flex flex-col gap-3.5 items-start">
            <span className="font-display italic" style={{ fontSize: 26, color: 'var(--gold-2)' }}>{shelfFacts(articles, totalCount, reachedEnd, language)}</span>
            <Link to={`/map${category.slug ? `?theme=${encodeURIComponent(category.slug)}` : ''}`} className="rs-btn rs-btn-ghost" style={{ minHeight: 46, background: 'var(--overlay-nav)' }}>
              {en ? 'See this shelf on the map' : 'Vezi raftul pe hartă'}
            </Link>
          </div>
        </div>
      </section>

      <section className="ed-container" style={{ paddingTop: 28 }}>
        {articles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-9" style={{ borderBottom: '1px dashed var(--line)' }}>
            <div role="group" aria-label={en ? 'Kind of story' : 'Fel de poveste'} className="flex flex-wrap gap-2">
              <button type="button" className="rs-chip" style={{ minHeight: 38 }} aria-pressed={kind === null} onClick={() => setKind(null)}>
                {en ? 'Everything' : 'Toate'}
              </button>
              {kinds.length > 1 && kinds.map(([k, label]) => (
                <button key={k} type="button" className="rs-chip" style={{ minHeight: 38 }} aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="shelf-sort" style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 700, color: 'var(--text-mute)' }}>{en ? 'Sort' : 'Ordonează'}</label>
              <select id="shelf-sort" className="rs-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="new">{en ? 'Newest first' : 'Cele mai noi'}</option>
                <option value="old">{en ? 'Oldest first' : 'Cele mai vechi'}</option>
                <option value="era">{en ? 'By era' : 'După epocă'}</option>
                <option value="read">{en ? 'Most read' : 'Cele mai citite'}</option>
              </select>
              <div role="group" aria-label={en ? 'Layout' : 'Aranjare'} className="inline-flex p-[3px]" style={{ border: '1px solid var(--line)', borderRadius: 999 }}>
                <button type="button" className="rs-seg-icon" aria-pressed={layout === 'grid'} aria-label={en ? 'Grid' : 'Grilă'} onClick={() => setLayout('grid')}>
                  <LayoutGrid className="w-[15px] h-[15px]" strokeWidth={1.75} />
                </button>
                <button type="button" className="rs-seg-icon" aria-pressed={layout === 'list'} aria-label={en ? 'List' : 'Listă'} onClick={() => setLayout('list')}>
                  <List className="w-[15px] h-[15px]" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center" style={{ padding: '64px 20px', border: '1px dashed var(--gold-deep)', borderRadius: 24 }}>
            <p className="m-0 mb-2 font-display italic" style={{ fontSize: 30, color: 'var(--parchment)' }}>
              {articles.length ? (en ? 'Nothing on this part of the shelf yet.' : 'Încă nimic pe această parte a raftului.') : t("articles.noArticles")}
            </p>
            <p className="m-0" style={{ fontSize: 16, color: 'var(--text-dim)' }}>
              {en ? 'Try another kind of story, or come back next month.' : 'Încearcă alt fel de poveste sau revino luna viitoare.'}
            </p>
          </div>
        ) : layout === 'grid' ? (
          <div className="grid gap-x-10 gap-y-14 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {items.map((article) => (
              <StoryCard
                key={article.id}
                article={article}
                category={category}
                language={language}
                size="md"
                linkState={cardLinkState}
                isArticleFavorited={isFavorited(article.id)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--line-soft)' }}>
            {items.map((article, i) => (
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
            <button type="button" onClick={loadMore} disabled={isLoadingMore} className="rs-btn rs-btn-ghost">
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
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

        {journey && (
          <div
            className="grid grid-cols-1 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto] md:items-center gap-6 md:gap-9"
            style={{ marginTop: 'clamp(56px, 7vw, 88px)', padding: 'clamp(22px, 3vw, 28px) clamp(22px, 3vw, 36px)', border: '1px solid var(--line)', borderRadius: 24, background: 'var(--paper)' }}
          >
            <MiniMap stories={journey.stops} />
            <div className="flex flex-col gap-2.5">
              <p className="rs-eyebrow">{en ? 'Follow them as a journey' : 'Urmează-le ca pe o călătorie'}</p>
              <h2 className="rs-display" style={{ fontSize: 32, lineHeight: 1.05, letterSpacing: 0 }}>{getLocalized(journey.journey, 'title', language)}</h2>
              {getLocalized(journey.journey, 'intro', language) && (
                <p className="m-0" style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text-dim)' }}>{getLocalized(journey.journey, 'intro', language)}</p>
              )}
              <p className="m-0" style={{ fontFamily: 'var(--ui)', fontSize: 12.5, fontWeight: 500, color: 'var(--text-mute)' }}>
                {countLabel(journey.stops.length, 'stop', language)} · {journeyPlaces.join(' → ')}
              </p>
            </div>
            <Link to={`/map?journey=${journey.journey.id}`} className="rs-btn justify-self-start">
              {en ? 'Start on the map →' : 'Pornește pe hartă →'}
            </Link>
          </div>
        )}

        {otherShelves.length > 0 && (
          <div style={{ marginTop: 'clamp(56px, 7vw, 88px)' }}>
            <p className="rs-eyebrow" style={{ marginBottom: 16 }}>{en ? 'The other shelves' : 'Celelalte rafturi'}</p>
            <ul className="flex flex-wrap gap-2.5 list-none m-0 p-0">
              {otherShelves.map((c) => {
                const name = getLocalized(c, 'name', language);
                const img = getCategoryImage(c.slug || name.toLowerCase());
                return (
                  <li key={c.id}>
                    <Link to={`/category/${c.id}`} className="rs-pill-link">
                      <span className="relative block overflow-hidden" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--paper)' }}>
                        <picture>
                          <source type="image/avif" srcSet={categoryImageSources(img).avif} sizes="36px" />
                          <source type="image/webp" srcSet={categoryImageSources(img).webp} sizes="36px" />
                          <img src={`${img}.jpg`} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                        </picture>
                      </span>
                      {name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};

export default CategoryDetail;
