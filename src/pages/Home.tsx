import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Category, Article, ArchiveEntry, getLocalized, fetchCategories, fetchArticlesPage, fetchRandomArticle, fetchLatestArticleCards, fetchArchiveIndex, supabase } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { useCooldown } from "@/hooks/use-cooldown";
import { ArrowRight } from "lucide-react";
import { isAbortError, toJsonLd } from "@/lib/utils";
import { toast } from "sonner";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/layout/PageHead";
import { StoryCard } from "@/components/ui/story-card";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { localizedPath } from "@/lib/locale";
import { storageImage, storageSrcSet } from "@/lib/image-url";
import { toneFor, articleExcerpt, articleCoverUrl, countLabel } from "@/lib/article-utils";
import { kindPhrase, placeAndTime, placeOf, splitOpening } from "@/lib/story-facts";
import { countyCentre } from "@/lib/atlas/projection";
import { ChapterHead, Divider, Knot, Motif, Thread } from "@/components/story/Ornaments";

const PAGE_SIZE = 9;

// How many of the newest stories the ticker carries.
const TICKER_SIZE = 12;

// Hoisted so StoryCard's React.memo can actually skip re-renders — an inline
// `{{ from: '/' }}` literal would be a new object identity every render.
const HOME_LINK_STATE = { from: '/' };

const NewsletterForm: React.FC<{ language: 'en' | 'ro' }> = ({ language }) => {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { remaining: cooldown, start: setCooldown } = useCooldown();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || isSubmitting || cooldown > 0) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('newsletter-subscribe', {
        body: { email: trimmed, website, language },
      });
      if (error || !data?.ok) throw error ?? new Error('Subscribe failed');
      toast.success(language === 'en'
        ? 'Almost there — check your inbox to confirm.'
        : 'Aproape gata — verifică-ți inboxul pentru confirmare.');
      setEmail("");
      setCooldown(30);
    } catch (err) {
      if (!isAbortError(err)) console.error('Newsletter subscribe failed:', err);
      toast.error(language === 'en'
        ? 'Could not subscribe right now. Please try again later.'
        : 'Abonarea nu a funcționat. Te rugăm să încerci mai târziu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="nl-website">Website</label>
        <input
          id="nl-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <label htmlFor="nl-email" className="sb-label">
        {language === 'en' ? 'Your email address' : 'Adresa ta de email'}
      </label>
      <div className="flex flex-wrap gap-2.5">
        <input
          id="nl-email"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={language === 'en' ? 'you@example.com' : 'tu@exemplu.ro'}
          className="sb-input"
          style={{ flex: '1 1 240px', width: 'auto' }}
        />
        <button
          type="submit"
          className="sb-btn"
          disabled={isSubmitting || cooldown > 0}
          style={{ minHeight: 50 }}
        >
          {isSubmitting
            ? (language === 'en' ? 'Sending…' : 'Se trimite…')
            : cooldown > 0
              ? (language === 'en' ? `Wait ${cooldown}s` : `Așteaptă ${cooldown}s`)
              : (language === 'en' ? 'Send me the letters' : 'Trimite-mi scrisorile')}
        </button>
      </div>
      <p className="sb-meta">
        {language === 'en'
          ? 'We’ll send a link to confirm first. Leave any time. '
          : 'Îți trimitem întâi un link de confirmare. Pleci oricând. '}
        <Link to="/privacy" className="sb-link">
          {language === 'en' ? 'Privacy' : 'Confidențialitate'}
        </Link>.
      </p>
    </form>
  );
};

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
  // null while loading; [] when there is nothing to show (or the fetch
  // failed), which removes the strip rather than leaving it empty.
  const [tickerStories, setTickerStories] = useState<Article[] | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

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

  // Paging the grid swaps the content above the pager; bring the reader back to
  // the top of the results instead of leaving them stranded at the controls.
  const goToPage = (next: number) => {
    setCurrentPage(next);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  useEffect(() => {
    fetchCategories().then((cats) => {
      setCategories(cats);
      // The selected filter is restored from localStorage; if that category
      // was deleted since the last visit, drop the filter instead of leaving
      // the user on a permanent "no stories" view with no highlighted pill.
      setSelectedCategory((prev) => (prev && !cats.some((c) => c.id === prev) ? null : prev));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (selectedCategory) localStorage.setItem('rostory_selected_category', selectedCategory);
      else localStorage.removeItem('rostory_selected_category');
    } catch { /* ignore */ }
  }, [selectedCategory]);

  useEffect(() => {
    let cancelled = false;
    fetchLatestArticleCards(TICKER_SIZE)
      .then((rows) => { if (!cancelled) setTickerStories(rows); })
      .catch((error) => {
        if (!isAbortError(error)) console.error('Error fetching ticker stories:', error);
        if (!cancelled) setTickerStories([]);
      });
    return () => { cancelled = true; };
  }, []);

  // A short list would leave the strip half-empty mid-loop, so it repeats
  // until one copy is comfortably wider than a desktop viewport.
  const tickerLoop = useMemo(() => {
    if (!tickerStories?.length) return [];
    let loop = tickerStories;
    while (loop.length < 8) loop = loop.concat(tickerStories);
    return loop;
  }, [tickerStories]);

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

  // The light index of every published story: the facts line under the
  // hero, the counts on the shelf chips, and the castle picture's own story.
  const [archiveIndex, setArchiveIndex] = useState<ArchiveEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchArchiveIndex()
      .then((rows) => { if (!cancelled) setArchiveIndex(rows); })
      .catch((error) => { if (!isAbortError(error)) console.error('Error fetching the archive index:', error); });
    return () => { cancelled = true; };
  }, []);

  const facts = useMemo(() => {
    if (!archiveIndex?.length) return null;
    const counties = new Set(archiveIndex.map((a) => a.location).filter((l): l is string => !!l && !!countyCentre(l)));
    const byCategory = new Map<string, number>();
    archiveIndex.forEach((a) => byCategory.set(a.categoryId, (byCategory.get(a.categoryId) || 0) + 1));
    // The hero shows Peleș, so its caption leads to Peleș's story — when
    // the archive has one.
    const peles = archiveIndex.find((a) => /pele[sșş]/i.test(`${a.titleEn} ${a.titleRo}`));
    return { total: archiveIndex.length, counties: counties.size, byCategory, pelesId: peles?.id ?? null };
  }, [archiveIndex]);

  const pageTitle = language === 'en' ? 'Stories of Romania' : 'Povești din România';
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

  // The spread shows the three newest stories — only meaningful when viewing
  // the full archive. When a category is selected, treat the request as a
  // filter and route every article into the archive grid so users don't get
  // an empty section.
  //
  // It is labelled as what it is ("Just added"). An editorial pick needs a
  // featured flag on the article, which does not exist yet. The spread needs
  // a full set of three: with fewer published stories than that, promoting
  // them all left the archive below as a bare heading with no cards, no
  // pager, and no empty state — so a young archive showed a visibly broken
  // section. Below the threshold, everything goes to the grid instead.
  const FEATURED_COUNT = 3;
  const showFeatured =
    selectedCategory === null && currentPage === 1 && articles.length > FEATURED_COUNT;
  const featured = showFeatured ? articles[0] : undefined;
  const second = showFeatured ? articles[1] : undefined;
  const third = showFeatured ? articles[2] : undefined;
  // Articles shown in the spread are excluded from the grid below so page 1
  // doesn't render the same three stories twice.
  const latest = showFeatured ? articles.slice(FEATURED_COUNT) : articles;

  const en = language === 'en';
  const featuredWhere = featured ? placeAndTime(featured, language) : null;
  const featuredOpening = featured ? splitOpening(articleExcerpt(featured, language, 240), 3) : null;
  const featuredKind = featured ? kindPhrase(featured, language) : '';
  const scrollToArchive = () => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });

  const chip = (id: string | null, name: string, n: number | undefined) => (
    <button
      key={id ?? 'all'}
      type="button"
      onClick={() => handleCategoryChange(id)}
      aria-pressed={selectedCategory === id}
      className="sb-chip shrink-0"
    >
      {name}
      {n != null && <span className="sb-chip-n">{n}</span>}
    </button>
  );

  return (
    <>
      <PageHead
        title={pageTitle}
        description={pageDescription}
        language={language}
        canonical={`${SITE_URL}${localizedPath(language, '/')}${currentPage > 1 ? `?page=${currentPage}` : ''}`}
        alternatePath={currentPage > 1 ? `/?page=${currentPage}` : '/'}
      >
        <script type="application/ld+json">{toJsonLd(organizationLd)}</script>
      </PageHead>

      <div className="screen-anim">
        {/* I. THE TITLE PAGE — the words on one side, the castle in a lit
            window on the other (above the words on a phone). */}
        <section className="ed-container" style={{ paddingTop: 'clamp(32px, 6vw, 72px)', paddingBottom: 'clamp(56px, 7vw, 96px)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 lg:gap-16 items-center">
            <div className="flex flex-col gap-6">
              <p className="sb-kicker">{en ? 'An archive of the Romanian imagination' : 'O arhivă a imaginației românești'}</p>
              {/* Sized against the viewport's height as well as its width, so
                  the buttons stay on the first screen of a 1366x768 laptop. */}
              <h1 className="sb-h1" style={{ fontSize: 'clamp(46px, min(6.4vw, 11vh), 100px)' }}>
                {en ? 'The land remembers, in a hundred quiet voices.' : 'Pământul își amintește, în o sută de voci tăcute.'}
              </h1>
              <p className="sb-lede max-w-[540px]">
                {en
                  ? 'A living archive of histories, traditions, and visual stories — gathered village by village, century by century, across the country we call home.'
                  : 'O arhivă vie de istorii, tradiții și povești vizuale — adunate sat cu sat, secol cu secol, prin țara pe care o numim acasă.'}
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mt-1.5">
                <button type="button" className="sb-btn" onClick={() => navigate('/map')}>
                  {en ? 'Open the map' : 'Deschide harta'}
                  <ArrowRight className="sb-ico" aria-hidden="true" />
                </button>
                <button type="button" className="sb-btn sb-btn-ghost" onClick={scrollToArchive}>
                  {en ? 'Browse the archive' : 'Explorează arhiva'}
                </button>
                <button type="button" className="sb-btn-word self-center sm:ml-2" onClick={handleRandomStory}>
                  {en ? 'Tell me a story at random' : 'Spune-mi o poveste la întâmplare'}
                  <Knot style={{ width: 8, height: 8 }} />
                </button>
              </div>
              {facts && (
                <div className="flex items-center gap-3.5 mt-4 justify-center sm:justify-start">
                  <Thread className="hidden sm:block" style={{ width: 56 }} />
                  <p className="sb-meta">
                    {en
                      ? `${countLabel(facts.total, 'story', 'en')}, from ${facts.counties} of Romania’s 42 counties`
                      : `${countLabel(facts.total, 'story', 'ro')}, din ${facts.counties} dintre cele 42 de județe ale României`}
                  </p>
                </div>
              )}
            </div>
            <figure className="m-0 w-full max-w-[520px] justify-self-center lg:justify-self-end">
              <div className="sb-window">
                <div className="sb-arch" style={{ aspectRatio: '4 / 5' }}>
                  <picture>
                    <source type="image/avif" srcSet="/hero/castle.avif" />
                    <source type="image/webp" srcSet="/hero/castle.webp" />
                    <img
                      src="/hero/castle.jpg"
                      alt={en ? 'Peleș Castle among the fir forests of Sinaia' : 'Castelul Peleș printre brazii Sinaiei'}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                  </picture>
                </div>
              </div>
              <figcaption className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 mt-4 px-2.5">
                <span className="sb-kicker-sm" style={{ color: 'var(--text-dim)' }}>{en ? 'Peleș Castle, Sinaia' : 'Castelul Peleș, Sinaia'}</span>
                {facts?.pelesId && (
                  <Link to={`/article/${facts.pelesId}`} state={HOME_LINK_STATE} className="sb-btn-word" style={{ fontSize: 19 }}>
                    {en ? 'Read where a king built a dream →' : 'Citește unde un rege și-a clădit visul →'}
                  </Link>
                )}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* TICKER — the newest stories, each a link. Two copies of the list,
            each carrying its own trailing gap, make the -50% loop seamless.
            Only the first occurrence of each story is exposed: the second copy
            and any padding repeats are hidden from assistive tech and the tab
            order, so each story is announced and reachable once. The strip
            holds its height while loading and is removed only when there is
            nothing to show. */}
        {tickerStories?.length !== 0 && (
          <section aria-label={en ? 'Recently told' : 'Povestite de curând'}>
            <Thread style={{ opacity: 0.3 }} />
            <div className="flex items-center" style={{ minHeight: 72 }}>
              <p className="sb-kicker-sm shrink-0 pl-[var(--gutter)] pr-6 hidden sm:block" style={{ color: 'var(--text-mute)' }}>
                {en ? 'Recently told' : 'Povestite de curând'}
              </p>
              <div className="ticker overflow-hidden flex-1 min-w-0" style={{ padding: '20px 0' }}>
                {tickerStories && (
                  <div className="ticker-track" style={{ gap: 0 }}>
                    {[0, 1].map((copy) => (
                      <div key={copy} className="flex gap-7 pr-7" aria-hidden={copy === 1 ? true : undefined}>
                        {tickerLoop.map((story, i) => {
                          const isRepeat = copy === 1 || i >= tickerStories.length;
                          const place = placeOf(story, language);
                          return (
                            <div
                              key={`${story.id}-${i}`}
                              className="flex items-center gap-7 whitespace-nowrap"
                              aria-hidden={isRepeat && copy === 0 ? true : undefined}
                              style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 22 }}
                            >
                              <Link
                                to={`/article/${story.id}`}
                                state={HOME_LINK_STATE}
                                tabIndex={isRepeat ? -1 : undefined}
                                className="transition-opacity hover:opacity-75"
                                style={{ color: 'var(--gold)' }}
                              >
                                {place && <span style={{ color: 'var(--text-mute)' }}>{place} · </span>}
                                {getLocalized(story, 'title', language)}
                              </Link>
                              <Knot small style={{ opacity: 0.7 }} />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Thread style={{ opacity: 0.3 }} />
          </section>
        )}

        {/* II. NEWLY TOLD */}
        {featured && featuredOpening && (
          <section className="sb-section">
            <div className="ed-container">
              <ChapterHead
                className="mb-12 md:mb-16"
                kicker={en ? 'Just added' : 'Abia adăugate'}
                title={en ? 'Three new stories from the archive.' : 'Trei povești noi din arhivă.'}
              />
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-14 lg:gap-[72px] items-start">
                <Link to={`/article/${featured.id}`} state={HOME_LINK_STATE} className="sb-card grid gap-5">
                  <div className="sb-window-shallow">
                    <div className="sb-arch sb-arch-shallow sb-card-media" style={{ aspectRatio: '5 / 4' }}>
                      {/* articleCoverUrl never returns the raw video file for
                          films — posterUrl || mediaUrl rendered a broken <img>
                          when a video had no poster. */}
                      {articleCoverUrl(featured) ? (
                        <img src={storageImage(articleCoverUrl(featured), 'feature')} srcSet={storageSrcSet(articleCoverUrl(featured), ['card', 'feature'])} sizes="(min-width: 1024px) 55vw, 94vw" alt="" loading="lazy" />
                      ) : (
                        <div className="ph absolute inset-0" data-tone={toneFor(featured.id)} style={{ border: 0 }} />
                      )}
                      <div className="sb-scrim" />
                      <span className="sb-tag" style={{ position: 'absolute', left: 22, bottom: 22, marginRight: 22 }}>
                        {en ? 'The newest' : 'Cea mai nouă'} · {featuredKind.charAt(0).toLowerCase() + featuredKind.slice(1)}
                      </span>
                    </div>
                  </div>
                  {featuredWhere && <p className="sb-kicker mt-2">{featuredWhere}</p>}
                  <h3 className="sb-h2" style={{ fontSize: 'clamp(36px, 4vw, 58px)' }}>{getLocalized(featured, 'title', language)}</h3>
                  {featuredOpening[0] && (
                    <p className="sb-lede max-w-[620px]">
                      <span className="sb-incipit">{featuredOpening[0]}</span>{featuredOpening[1]}
                    </p>
                  )}
                  <span className="sb-btn-word">{en ? 'Begin the story →' : 'Începe povestea →'}</span>
                </Link>

                <div className="flex flex-col gap-12 lg:pt-3">
                  {[second, third].filter((s): s is Article => !!s).map((s, i) => (
                    <React.Fragment key={s.id}>
                      {i > 0 && <Divider />}
                      <StoryCard
                        article={s}
                        category={categoryMap.get(s.categoryId)}
                        language={language}
                        size="wide"
                        linkState={HOME_LINK_STATE}
                        isArticleFavorited={isFavorited(s.id)}
                        onFavoriteToggle={handleFavoriteToggle}
                      />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* THE EPIGRAPH */}
        <section className="text-center" style={{ paddingTop: 'clamp(56px, 7vw, 88px)', paddingBottom: 'clamp(64px, 8vw, 104px)' }}>
          <div className="ed-container">
            <Motif className="mx-auto mb-11" style={{ maxWidth: 320 }} />
            <blockquote className="m-0 mx-auto max-w-[920px]">
              <p className="sb-h2" style={{ fontSize: 'clamp(28px, 3.4vw, 46px)', lineHeight: 1.22 }}>
                {en
                  ? '“We don’t keep an archive because the past is finished. We keep one because it isn’t.”'
                  : '„Nu ținem o arhivă pentru că trecutul s-a încheiat. O ținem pentru că nu s-a încheiat.”'}
              </p>
            </blockquote>
            <Motif className="mx-auto mt-11" style={{ maxWidth: 320 }} />
          </div>
        </section>

        {/* III. THE ARCHIVE */}
        <section id="explore" className="sb-section sb-band">
          <div className="ed-container">
            <div className="flex flex-wrap justify-between items-end gap-6 mb-9">
              <div className="flex flex-col gap-3">
                <p className="sb-kicker">{en ? 'The archive' : 'Arhiva'}</p>
                <h2 className="sb-h2">{en ? 'From the field.' : 'Din teren.'}</h2>
                <p className="sb-dim text-[19px]">{en ? 'Every story, newest first.' : 'Toate poveștile, începând cu cele mai noi.'}</p>
              </div>
              <button type="button" className="sb-btn sb-btn-ghost" onClick={() => navigate('/categories')}>
                {en ? 'All categories →' : 'Toate categoriile →'}
              </button>
            </div>

            {/* The shelves as chips, each with how many stories it holds —
                one row that scrolls sideways on a phone. */}
            <div
              role="group"
              aria-label={en ? 'Show stories from' : 'Arată poveștile din'}
              className="flex gap-2.5 mb-14 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1"
            >
              {chip(null, en ? 'All' : 'Toate', facts?.total)}
              {categories.map((c) => chip(c.id, getLocalized(c, 'name', language), facts ? facts.byCategory.get(c.id) || 0 : undefined))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 gap-y-14 md:gap-y-[72px]">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="sb-frame animate-pulse" style={{ aspectRatio: '4/5' }} />
                ))}
              </div>
            ) : (articles.length > 0 ? (
              <>
                {latest.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 gap-y-14 md:gap-y-[72px]">
                    {latest.map(article => (
                      <StoryCard
                        key={article.id}
                        article={article}
                        category={categoryMap.get(article.categoryId)}
                        language={language}
                        size="md"
                        linkState={HOME_LINK_STATE}
                        isArticleFavorited={isFavorited(article.id)}
                        onFavoriteToggle={handleFavoriteToggle}
                      />
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <nav aria-label={en ? 'Pages' : 'Pagini'} className="flex flex-wrap items-center justify-between sm:justify-center gap-x-4 gap-y-3 sm:gap-6 mt-16 md:mt-20">
                    <button
                      type="button"
                      className="sb-btn sb-btn-ghost"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      {en ? '← Newer' : '← Mai noi'}
                    </button>
                    <p className="sb-kicker-sm text-center w-full sm:w-auto order-first sm:order-none" style={{ color: 'var(--text-dim)' }}>
                      {en ? `Page ${currentPage} of ${totalPages}` : `Pagina ${currentPage} din ${totalPages}`}
                    </p>
                    <button
                      type="button"
                      className="sb-btn sb-btn-ghost"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      {en ? 'Earlier stories →' : 'Povești mai vechi →'}
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <div className="py-24 text-center">
                <p className="font-display italic text-2xl sb-dim">{t('articles.noArticles')}</p>
              </div>
            ))}
          </div>
        </section>

        {/* IV. THE DISPATCH — a letter, with the logo as its stamp. */}
        <section className="sb-section">
          <div className="ed-container">
            <div
              className="relative"
              style={{ border: '1.5px dashed var(--gold-deep)', borderRadius: 24, padding: 'clamp(28px, 5vw, 64px)', background: 'var(--paper)' }}
            >
              <div
                aria-hidden="true"
                className="absolute hidden sm:grid place-items-center"
                style={{ top: -22, right: 40, width: 92, height: 108, background: 'var(--ink-2)', border: '2px dotted var(--gold-deep)', borderRadius: 6, transform: 'rotate(5deg)' }}
              >
                <picture>
                  <source type="image/webp" srcSet="/logo-128.webp" />
                  <img src="/logo-128.png" alt="" width={60} height={60} className="w-[60px] h-auto" />
                </picture>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
                <div className="flex flex-col gap-3.5">
                  <p className="sb-kicker">{en ? 'The dispatch' : 'Buletinul'}</p>
                  <h2 className="sb-h2" style={{ fontSize: 'clamp(32px, 3.6vw, 50px)' }}>
                    {en ? 'One letter a month, from the road.' : 'O scrisoare pe lună, de pe drum.'}
                  </h2>
                  <p className="sb-dim text-[19px]">
                    {en ? 'Field notes, photographs, and the occasional recipe. Free.' : 'Note de teren, fotografii și, ocazional, o rețetă. Gratuit.'}
                  </p>
                </div>
                <NewsletterForm language={language} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;
