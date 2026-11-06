import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Category, Article, ArchiveEntry, getLocalized, fetchCategories, fetchArticlesPage, fetchRandomArticle, fetchArchiveIndex, supabase } from "@/lib/supabase";
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
import { kindWord, placeAndTime } from "@/lib/story-facts";
import { countyCentre } from "@/lib/atlas/projection";
import { Knot, Motif, Thread } from "@/components/story/Ornaments";

const PAGE_SIZE = 9;

/** The newest story leads the front page and the next four sit beside it. */
const FRONT_COUNT = 5;

/** How many of the newest stories the ticker carries. */
const TICKER_SIZE = 12;

// Hoisted so StoryCard's React.memo can actually skip re-renders — an inline
// `{{ from: '/' }}` literal would be a new object identity every render.
const HOME_LINK_STATE = { from: '/' };

const NewsletterForm: React.FC<{ language: 'en' | 'ro' }> = ({ language }) => {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { remaining: cooldown, start: setCooldown } = useCooldown();
  const en = language === 'en';

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
      setEmail("");
      setCooldown(30);
      setSent(true);
    } catch (err) {
      if (!isAbortError(err)) console.error('Newsletter subscribe failed:', err);
      toast.error(en
        ? 'Could not subscribe right now. Please try again later.'
        : 'Abonarea nu a funcționat. Te rugăm să încerci mai târziu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // The form gives way to the next step, said where the reader is looking.
  if (sent) {
    return (
      <p role="status" className="m-0 font-display italic" style={{ fontSize: 26, lineHeight: 1.3, color: 'var(--parchment)' }}>
        {en ? 'Almost there — check your inbox to confirm.' : 'Aproape gata — verifică-ți inboxul pentru confirmare.'}
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={onSubmit}>
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
      <label htmlFor="nl-email" style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>
        {en ? 'Your email address' : 'Adresa ta de email'}
      </label>
      <div className="flex flex-wrap gap-2.5">
        <input
          id="nl-email"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={en ? 'you@example.com' : 'tu@exemplu.ro'}
          className="sb-input"
          style={{ flex: '1 1 240px', width: 'auto', minHeight: 50, background: 'var(--ink-2)' }}
        />
        <button type="submit" className="rs-btn" disabled={isSubmitting || cooldown > 0} style={{ minHeight: 50 }}>
          {isSubmitting
            ? (en ? 'Sending…' : 'Se trimite…')
            : cooldown > 0
              ? (en ? `Wait ${cooldown}s` : `Așteaptă ${cooldown}s`)
              : (en ? 'Send me the letters' : 'Trimite-mi scrisorile')}
        </button>
      </div>
      <p className="m-0" style={{ fontFamily: 'var(--ui)', fontSize: 12.5, fontWeight: 500, lineHeight: 1.5, color: 'var(--text-mute)' }}>
        {en
          ? 'We’ll send a link to confirm first. Leave any time. For readers aged 16 and over. '
          : 'Îți trimitem întâi un link de confirmare. Pleci oricând. Pentru cititori de la 16 ani. '}
        <Link to="/privacy" className="rs-underline">{en ? 'Privacy' : 'Confidențialitate'}</Link>.
      </p>
    </form>
  );
};

/**
 * The front page, reading-first (the redesign's HomeReading): the title,
 * then the newest story leading with the next four beside it, then the
 * whole archive by shelf, a page at a time, and the monthly letter.
 */
const Home: React.FC = () => {
  const { language, t } = useLanguage();
  const { handleFavoriteToggle, isFavorited } = useFavorites();
  const navigate = useNavigate();
  const en = language === 'en';
  const [categories, setCategories] = useState<Category[]>([]);
  const [front, setFront] = useState<Article[] | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => {
    try { return localStorage.getItem('rostory_selected_category'); } catch { return null; }
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = (() => {
    const raw = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  })();
  const setCurrentPage = useCallback((nextPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextPage <= 1) next.delete('page');
      else next.set('page', String(nextPage));
      return next;
    }, { replace: false });
  }, [setSearchParams]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // "All" pages through the archive after the five already on the front
  // page; a shelf pages through everything on it.
  const skip = selectedCategory ? 0 : FRONT_COUNT;
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount - skip) / PAGE_SIZE));
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const handleRandomStory = async () => {
    const a = await fetchRandomArticle().catch(() => null);
    if (a) navigate(`/article/${a.id}`, { state: HOME_LINK_STATE });
  };

  const toArchive = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleCategoryChange = (catId: string | null) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
    toArchive();
  };

  // Paging the grid swaps the content above the pager; bring the reader back to
  // the top of the results instead of leaving them stranded at the controls.
  const goToPage = (next: number) => {
    setCurrentPage(next);
    toArchive();
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

  // The newest five, whole (the lead shows its opening lines).
  useEffect(() => {
    let cancelled = false;
    fetchArticlesPage(1, FRONT_COUNT, null)
      .then(({ articles }) => { if (!cancelled) setFront(articles); })
      .catch((error) => {
        if (!isAbortError(error)) console.error('Error fetching the newest stories:', error);
        if (!cancelled) setFront([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchArticlesPage(currentPage, PAGE_SIZE, selectedCategory, skip)
      .then(({ articles, total }) => {
        if (cancelled) return;
        setArticles(articles);
        setTotalCount(total);
      })
      .catch((error) => {
        if (isAbortError(error) || cancelled) return;
        // A page past the end is refused outright (PostgREST: "range not
        // satisfiable"), so there is no total to clamp against: start over
        // from the first page.
        if ((error as { code?: string })?.code === 'PGRST103' && currentPage > 1) {
          setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('page'); return next; }, { replace: true });
          return;
        }
        console.error('Error fetching articles:', error);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [currentPage, selectedCategory, skip, setSearchParams]);

  // A page past the end (an old ?page= link, or an archive that has since
  // shrunk) showed an empty archive with no pager to get back. Land on the
  // last page instead, without adding a history entry.
  useEffect(() => {
    if (isLoading || totalCount === 0 || currentPage <= totalPages) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (totalPages <= 1) next.delete('page');
      else next.set('page', String(totalPages));
      return next;
    }, { replace: true });
  }, [isLoading, totalCount, currentPage, totalPages, setSearchParams]);

  // The light index of every published story: the facts line under the
  // title, the counts on the shelf chips and the ticker. null while loading;
  // [] when it failed, which removes the ticker rather than leaving it empty.
  const [archiveIndex, setArchiveIndex] = useState<ArchiveEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchArchiveIndex()
      .then((rows) => { if (!cancelled) setArchiveIndex(rows); })
      .catch((error) => {
        if (!isAbortError(error)) console.error('Error fetching the archive index:', error);
        if (!cancelled) setArchiveIndex([]);
      });
    return () => { cancelled = true; };
  }, []);

  // The index is newest first, so the ticker is its head. A short list would
  // leave the strip half-empty mid-loop, so it repeats until one copy is
  // comfortably wider than a desktop screen.
  const tickerStories = useMemo(() => archiveIndex?.slice(0, TICKER_SIZE) ?? null, [archiveIndex]);
  const tickerLoop = useMemo(() => {
    if (!tickerStories?.length) return [];
    let loop = tickerStories;
    while (loop.length < 8) loop = loop.concat(tickerStories);
    return loop;
  }, [tickerStories]);

  const facts = useMemo(() => {
    if (!archiveIndex?.length) return null;
    const counties = new Set(archiveIndex.map((a) => a.location).filter((l): l is string => !!l && !!countyCentre(l)));
    const byCategory = new Map<string, number>();
    archiveIndex.forEach((a) => byCategory.set(a.categoryId, (byCategory.get(a.categoryId) || 0) + 1));
    return { total: archiveIndex.length, counties: counties.size, byCategory };
  }, [archiveIndex]);

  const pageTitle = en ? 'Stories of Romania' : 'Povești din România';
  const pageDescription = en
    ? 'Discover the culture, history, and traditions of Romania through visual stories — articles, films, and picture galleries from many corners of the country.'
    : 'Descoperă cultura, istoria și tradițiile României prin povești vizuale — articole, filme și galerii de imagini din multe colțuri ale țării.';

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

  const lead = front?.[0];
  const recent = front?.slice(1) ?? [];
  const leadCover = lead ? articleCoverUrl(lead) : undefined;
  const leadKind = lead ? kindWord(lead, language) : '';

  const chip = (id: string | null, name: string, n: number | undefined) => (
    <button
      key={id ?? 'all'}
      type="button"
      onClick={() => handleCategoryChange(id)}
      aria-pressed={selectedCategory === id}
      className="rs-chip shrink-0"
    >
      {name}
      {n != null && <span className="rs-chip-n">{n}</span>}
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

      <div className="rs-in">
        {/* I. THE TITLE */}
        <section className="ed-container" style={{ paddingTop: 'clamp(40px, 6vw, 88px)', paddingBottom: 'clamp(40px, 5vw, 64px)' }}>
          <p className="rs-eyebrow" style={{ marginBottom: 22 }}>{en ? 'An archive of the Romanian imagination' : 'O arhivă a imaginației românești'}</p>
          <div className="grid grid-cols-1 min-[1000px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-[clamp(28px,4vw,64px)] items-end">
            {/* Sized against the viewport's height as well as its width, so
                the buttons stay on the first screen of a 1366x768 laptop. */}
            <h1 className="rs-display" style={{ fontSize: 'clamp(54px, min(8vw, 14vh), 128px)', lineHeight: 0.93, letterSpacing: '-0.025em' }}>
              {en ? 'The land remembers, in a hundred ' : 'Pământul își amintește, în o sută de '}
              <em>{en ? 'quiet voices.' : 'voci tăcute.'}</em>
            </h1>
            <div className="flex flex-col gap-[22px] pb-2.5">
              <p className="rs-lede">
                {en
                  ? 'A living archive of histories, traditions, and visual stories — gathered village by village, century by century, across the country we call home.'
                  : 'O arhivă vie de istorii, tradiții și povești vizuale — adunate sat cu sat, secol cu secol, prin țara pe care o numim acasă.'}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className="rs-btn" onClick={() => navigate('/map')}>
                  {en ? 'Open the map' : 'Deschide harta'}
                  <ArrowRight className="w-[15px] h-[15px]" strokeWidth={2} aria-hidden="true" />
                </button>
                <button type="button" className="rs-btn rs-btn-ghost" onClick={handleRandomStory}>
                  {en ? 'A story at random' : 'O poveste la întâmplare'}
                </button>
              </div>
              {/* The line holds its height until the counts arrive, so
                  nothing below it moves. */}
              <div className="flex items-center gap-3.5" style={{ minHeight: 20 }}>
                <Thread style={{ width: 56, opacity: 0.45 }} />
                <p className="m-0" style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 500, color: 'var(--text-mute)' }}>
                  {facts && (en
                    ? `${countLabel(facts.total, 'story', 'en')}, from ${facts.counties} of Romania’s 42 counties`
                    : `${countLabel(facts.total, 'story', 'ro')}, din ${facts.counties} dintre cele 42 de județe ale României`)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* II. THE FRONT PAGE: the newest story leads, the next four beside it. */}
        <section className="ed-container" style={{ paddingBottom: 'clamp(64px, 8vw, 112px)' }}>
          <div className="grid grid-cols-1 min-[1000px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-[clamp(36px,5vw,72px)] items-start">
            {lead ? (
              <article>
                <Link to={`/article/${lead.id}`} state={HOME_LINK_STATE} className="rs-card block">
                  <div style={{ padding: 10, border: '1px solid var(--line)', borderRadius: '50% 50% 24px 24px / 18% 18% 24px 24px' }}>
                    <div className="relative overflow-hidden" style={{ aspectRatio: '5 / 4', borderRadius: '50% 50% 14px 14px / 18% 18% 14px 14px', background: 'var(--paper)' }}>
                      {leadCover ? (
                        <img
                          src={storageImage(leadCover, 'feature')}
                          srcSet={storageSrcSet(leadCover, ['card', 'feature'])}
                          sizes="(min-width: 1000px) 55vw, 94vw"
                          alt=""
                          fetchPriority="high"
                          className="rs-card-img"
                        />
                      ) : (
                        <div className="ph absolute inset-0" data-tone={toneFor(lead.id)} style={{ border: 0 }} />
                      )}
                      <div className="sb-scrim" />
                      {/* On a phone the whole label ran to two lines in the
                          pill; the heading beside it already says these are
                          new, so there it names the format alone. */}
                      <span className="rs-card-kind left-[14px] bottom-[14px] sm:left-[22px] sm:bottom-[22px]" style={{ padding: '6px 14px' }}>
                        <span className="hidden sm:inline">{en ? 'The newest' : 'Cea mai nouă'} · {leadKind.charAt(0).toLowerCase() + leadKind.slice(1)}</span>
                        <span className="sm:hidden">{leadKind}</span>
                      </span>
                    </div>
                  </div>
                  {placeAndTime(lead, language) && (
                    <p className="rs-card-where m-0" style={{ marginTop: 26, fontSize: 13 }}>{placeAndTime(lead, language)}</p>
                  )}
                  <h2 className="rs-display" style={{ margin: '10px 0 16px', fontSize: 'clamp(38px, 4.2vw, 62px)', lineHeight: 1 }}>
                    {getLocalized(lead, 'title', language)}
                  </h2>
                  <p className="rs-lede max-w-[620px]">{articleExcerpt(lead, language, 240)}</p>
                  <span className="inline-flex items-center gap-2 mt-[18px]" style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                    {en ? 'Begin the story →' : 'Începe povestea →'}
                  </span>
                </Link>
              </article>
            ) : (
              // Holds the lead's place while it loads.
              <div aria-hidden="true" className="animate-pulse" style={{ aspectRatio: '5 / 4', borderRadius: '50% 50% 24px 24px / 18% 18% 24px 24px', background: 'var(--paper)' }} />
            )}

            <aside aria-labelledby="just-added">
              <div className="flex items-baseline justify-between gap-3 mb-[18px]">
                <h2 id="just-added" className="rs-display" style={{ fontSize: 34, lineHeight: 1, letterSpacing: 0 }}>{en ? 'Just added' : 'Abia adăugate'}</h2>
                <span style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--text-mute)' }}>{en ? 'Newest first' : 'Cele mai noi întâi'}</span>
              </div>
              <Thread style={{ opacity: 0.4 }} />
              {/* Holds the four places while they load, so nothing jumps. */}
              {front === null && [0, 1, 2, 3].map((i) => (
                <div key={i} aria-hidden="true" style={{ padding: '20px 0', borderBottom: '1px dashed var(--line)' }}>
                  <div className="animate-pulse" style={{ height: 84, borderRadius: 14, background: 'var(--paper)' }} />
                </div>
              ))}
              {recent.map((s) => (
                <div key={s.id} style={{ padding: '20px 0', borderBottom: '1px dashed var(--line)' }}>
                  <StoryCard article={s} category={categoryMap.get(s.categoryId)} language={language} size="compact" linkState={HOME_LINK_STATE} />
                </div>
              ))}
              <button type="button" className="rs-word mt-5" onClick={handleRandomStory}>
                {en ? 'Tell me a story at random' : 'Spune-mi o poveste la întâmplare'}
                <Knot style={{ width: 8, height: 8 }} />
              </button>
            </aside>
          </div>
        </section>

        {/* THE TICKER: the newest stories, each a link. Two copies of the list,
            each carrying its own trailing gap, make the -50% loop seamless.
            Only the first occurrence of each story is exposed: the second copy
            and any padding repeats are hidden from assistive tech and the tab
            order, so each story is announced and reachable once. It stops
            under the pointer or keyboard focus, and stands still (and scrolls
            by hand) for readers who ask for reduced motion. The strip holds
            its height while loading and is removed only when there is nothing
            to show. */}
        {tickerStories?.length !== 0 && (
          <section aria-label={en ? 'Recently told' : 'Povestite de curând'}>
            <Thread style={{ opacity: 0.3 }} />
            <div className="flex items-center" style={{ minHeight: 72 }}>
              <p className="rs-eyebrow shrink-0 pl-[var(--gutter)] pr-6 hidden sm:block" style={{ color: 'var(--text-mute)' }}>
                {en ? 'Recently told' : 'Povestite de curând'}
              </p>
              <div className="ticker overflow-hidden flex-1 min-w-0" style={{ padding: '20px 0' }}>
                {tickerStories && (
                  <div className="ticker-track" style={{ gap: 0 }}>
                    {[0, 1].map((copy) => (
                      <div key={copy} className="flex gap-7 pr-7" aria-hidden={copy === 1 ? true : undefined}>
                        {tickerLoop.map((story, i) => {
                          const isRepeat = copy === 1 || i >= tickerStories.length;
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
                                {story.location && <span style={{ color: 'var(--text-mute)' }}>{story.location} · </span>}
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

        {/* THE EPIGRAPH, between two bands of cross-stitch. */}
        <section className="text-center" style={{ paddingTop: 'clamp(56px, 7vw, 88px)', paddingBottom: 'clamp(64px, 8vw, 104px)' }}>
          <div className="ed-container">
            <Motif className="mx-auto mb-11" style={{ maxWidth: 320 }} />
            <blockquote className="m-0 mx-auto max-w-[920px]">
              <p className="rs-display" style={{ fontSize: 'clamp(28px, 3.4vw, 46px)', lineHeight: 1.22, letterSpacing: '-0.01em' }}>
                {en
                  ? '“We don’t keep an archive because the past is finished. We keep one because it isn’t.”'
                  : '„Nu ținem o arhivă pentru că trecutul s-a încheiat. O ținem pentru că nu s-a încheiat.”'}
              </p>
            </blockquote>
            <Motif className="mx-auto mt-11" style={{ maxWidth: 320 }} />
          </div>
        </section>

        {/* III. THE ARCHIVE */}
        <section id="explore" className="rs-band" style={{ scrollMarginTop: 72 }}>
          <div className="ed-container" style={{ paddingBlock: 'clamp(56px, 7vw, 96px)' }}>
            <div className="flex flex-wrap items-end justify-between gap-5 mb-9">
              <div>
                <p className="rs-eyebrow" style={{ marginBottom: 12 }}>{en ? 'The archive' : 'Arhiva'}</p>
                <h2 className="rs-display" style={{ fontSize: 'clamp(40px, 4.6vw, 68px)', lineHeight: 1 }}>{en ? 'From the field.' : 'Din teren.'}</h2>
              </div>
              <button type="button" className="rs-btn rs-btn-ghost" style={{ minHeight: 46 }} onClick={() => navigate('/categories')}>
                {en ? 'All shelves →' : 'Toate rafturile →'}
              </button>
            </div>

            {/* The shelves as chips, each with how many stories it holds —
                one row that scrolls sideways on a phone. */}
            <div
              role="group"
              aria-label={en ? 'Show stories from' : 'Arată poveștile din'}
              className="flex gap-2.5 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1"
              style={{ marginBottom: 'clamp(36px, 5vw, 56px)' }}
            >
              {chip(null, en ? 'All' : 'Toate', facts?.total)}
              {categories.map((c) => chip(c.id, getLocalized(c, 'name', language), facts ? facts.byCategory.get(c.id) || 0 : undefined))}
            </div>

            {isLoading ? (
              <div className="grid gap-x-11 gap-y-14 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rs-card-frame animate-pulse" />
                ))}
              </div>
            ) : articles.length > 0 ? (
              <>
                <div className="grid gap-x-11 gap-y-14 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                  {articles.map((article) => (
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

                {totalPages > 1 && (
                  <nav aria-label={en ? 'Pages' : 'Pagini'} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4" style={{ marginTop: 'clamp(48px, 6vw, 72px)' }}>
                    <button type="button" className="rs-btn rs-btn-ghost" style={{ minHeight: 46 }} onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                      {en ? '← Newer' : '← Mai noi'}
                    </button>
                    <span className="order-first w-full text-center sm:order-none sm:w-auto" style={{ fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>
                      {en ? `Page ${currentPage} of ${totalPages}` : `Pagina ${currentPage} din ${totalPages}`}
                    </span>
                    <button type="button" className="rs-btn rs-btn-ghost" style={{ minHeight: 46 }} onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                      {en ? 'Earlier stories →' : 'Povești mai vechi →'}
                    </button>
                  </nav>
                )}
              </>
            ) : selectedCategory ? (
              <div className="py-16 text-center" style={{ border: '1px dashed var(--gold-deep)', borderRadius: 24 }}>
                <p className="m-0 font-display italic" style={{ fontSize: 26, color: 'var(--text-dim)' }}>{t('articles.noArticles')}</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* IV. THE DISPATCH */}
        <section className="ed-container" style={{ paddingTop: 'clamp(64px, 8vw, 112px)' }}>
          <div
            className="grid grid-cols-1 min-[900px]:grid-cols-2 items-center gap-[clamp(28px,4vw,56px)]"
            style={{ padding: 'clamp(28px, 5vw, 64px)', border: '1.5px dashed var(--gold-deep)', borderRadius: 24, background: 'var(--paper)' }}
          >
            <div>
              <p className="rs-eyebrow" style={{ marginBottom: 12 }}>{en ? 'The dispatch' : 'Buletinul'}</p>
              <h2 className="rs-display" style={{ margin: '0 0 12px', fontSize: 'clamp(34px, 3.6vw, 52px)', lineHeight: 1.02 }}>
                {en ? 'One letter a month, from the road.' : 'O scrisoare pe lună, de pe drum.'}
              </h2>
              <p className="m-0" style={{ fontSize: 18, color: 'var(--text-dim)' }}>
                {en ? 'Field notes, pictures, and the occasional recipe. Free.' : 'Note de teren, imagini și, ocazional, o rețetă. Gratuit.'}
              </p>
            </div>
            <NewsletterForm language={language} />
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;
