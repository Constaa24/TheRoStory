import React, { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Article, ArticleSubtype, Category, getLocalized, fetchCategories, fetchRelatedArticles } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { useActiveSection } from "@/hooks/use-active-section";
import { Heart, Link2, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StoryCard } from "@/components/ui/story-card";
import { storageImage, storageSrcSet } from "@/lib/image-url";
import { articleCoverUrl, formatArticleDate, countLabel, joinMeta } from "@/lib/article-utils";
import { kindWord, parseStoryChapters, placeOf, readPhrase, splitTitle, toRoman, whenOf } from "@/lib/story-facts";
import { Rosette } from "@/components/story/Ornaments";
import { ChapterPill, useTextSize, type ChapterMark, type TextSize } from "@/components/story/ReadingBar";
import { EssayChapters, PoemPage, StoryScenes } from "@/components/story/StoryProse";
import { PictureBook, type Frame } from "@/components/story/PictureBook";
import { JourneyCard, NearbyCard, NoteCard, PlaceCard, useStoryNeighbours } from "@/components/story/StoryAside";
import { MomentsStrip } from "@/components/story/MomentsStrip";
import { FilmStage } from "@/components/story/FilmStage";

// Comments load on their own, and only as the reader nears them: they sit
// below everything else, and they were the only reason the Radix chunk
// (~24 KB, for the delete-confirmation dialog) and the comments query came
// with every story page, read to the end or not. If the chunk can't load
// (a tab left open across a deploy), the section is simply left out rather
// than taking the story down with it.
const ArticleComments = lazy(() =>
  import("@/components/organisms/ArticleComments")
    .then((m) => ({ default: m.ArticleComments }))
    .catch(() => ({ default: () => null }))
);

/**
 * Comments, mounted once their place is within three screens of the reader.
 * Until then an empty block about the height of the section with no notes
 * yet, so little or nothing moves when the notes arrive.
 */
const CommentsWhenNear: React.FC<{ articleId: string }> = ({ articleId }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setNear(true); },
      { rootMargin: "300% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  const placeholder = <div aria-hidden="true" className="no-print" style={{ minHeight: 260 }} />;
  return (
    <div ref={ref}>
      {near ? (
        <Suspense fallback={placeholder}>
          <ArticleComments articleId={articleId} />
        </Suspense>
      ) : placeholder}
    </div>
  );
};

interface Props {
  article: Article;
  views?: number;
}

type Lang = "en" | "ro";
type Kind = "essay" | "short" | "poem" | "visual" | "film";
const END_ID = "story-end";

const kindOf = (article: Article): Kind => {
  if (article.type === "video") return "film";
  if (article.type === "carousel") return "visual";
  const subtype: ArticleSubtype = (article.subtype as ArticleSubtype | null | undefined) || "essay";
  return subtype === "poetry" ? "poem" : subtype === "short_story" ? "short" : "essay";
};

/**
 * Every picture and film on The RoStory is made with generative AI. The EU
 * AI Act (Article 50(4), applying since 2 August 2026) requires AI-made
 * images and video that resemble real places, people or events to be
 * disclosed as such: clearly, on first sight, and, for creative work, in a
 * way that doesn't get in the way of it. So a story's picture says so in its
 * caption, and a film or a visual essay says so in the facts beside its
 * title. The footer and the Terms ("Pictures and films") say it for the
 * whole site.
 */
const aiPhrase = (language: Lang, film = false) =>
  film
    ? (language === "en" ? "made with AI" : "realizat cu AI")
    : (language === "en" ? "illustrated with AI" : "ilustrat cu AI");

const viewsPhrase = (views: number | undefined, language: Lang) =>
  views !== undefined && views > 0 ? countLabel(views, "view", language) : null;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const formatRuntime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const TEXT_SIZE_ORDER: TextSize[] = ["sm", "md", "lg"];
const textSizeName = (s: TextSize, en: boolean) =>
  s === "sm" ? (en ? "small" : "mic") : s === "lg" ? (en ? "large" : "mare") : (en ? "medium" : "mediu");

const useChapters = (article: Article, language: Lang) => {
  const content = getLocalized(article, "content", language);
  const chapters = useMemo(() => parseStoryChapters(content), [content]);
  const ids = useMemo(() => chapters.map((_, i) => `chapter-${i + 1}`), [chapters]);
  const marks: ChapterMark[] = useMemo(
    () => chapters.map((c, i) => ({ id: ids[i], label: c.title || c.incipit })),
    [chapters, ids],
  );
  const active = useActiveSection(ids);
  return { chapters, ids, marks, active };
};

/** The thread under the header that fills as the reader goes down the story. */
const ProgressLine: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0;
      ref.current?.style.setProperty("--story-progress", `${pct}%`);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return <div ref={ref} aria-hidden="true" className="rs-progress no-print"><span className="rs-progress-fill" /></div>;
};

/** The chapter path in the margin: where the reader is in the story. */
const ChapterPath: React.FC<{ marks: ChapterMark[]; active: number; language: Lang }> = ({ marks, active, language }) => (
  <nav aria-label={language === "en" ? "The story so far" : "Povestea până aici"} className="rs-margin-card">
    <p className="rs-eyebrow" style={{ marginBottom: 14 }}>{language === "en" ? "The story so far" : "Povestea până aici"}</p>
    <ol className="sb-path">
      {marks.map((m, i) => (
        <li key={m.id} className={cn("sb-path-step", i < active && "is-done", i === active && "is-now")}>
          <span className="sb-numeral" style={{ fontSize: 14 }} aria-hidden="true">{toRoman(i + 1)}</span>
          <a href={`#${m.id}`} className="sb-path-label" aria-current={i === active ? "step" : undefined}>{m.label}</a>
        </li>
      ))}
    </ol>
  </nav>
);

/** Roughly how much of a film's description shows before "Read more". */
const DESCRIPTION_PREVIEW_CHARS = 600;

/**
 * Keeps whole paragraphs while they fit the budget, then cuts the next one at
 * a word boundary. `truncated` says whether anything was left out, which is
 * what decides whether the reader is offered the rest.
 */
const clampParagraphs = (paragraphs: string[], budget: number): { paragraphs: string[]; truncated: boolean } => {
  const out: string[] = [];
  let used = 0;
  for (const p of paragraphs) {
    if (used + p.length <= budget) {
      out.push(p);
      used += p.length;
      continue;
    }
    // Only start a paragraph that has room to say something; otherwise stop
    // at the end of the last whole one.
    const room = budget - used;
    if (room > 80) {
      const cut = p.slice(0, room);
      const lastSpace = cut.lastIndexOf(" ");
      out.push((lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…");
    }
    return { paragraphs: out, truncated: true };
  }
  return { paragraphs: out, truncated: false };
};

/**
 * The words that go with a film or a visual essay: the first paragraph as
 * its opening line, then the rest, a film's long description folded after
 * the first 600 characters so the page doesn't open on a wall of text.
 */
const MediaText: React.FC<{ article: Article; language: Lang; fold: boolean }> = ({ article, language, fold }) => {
  const en = language === "en";
  const content = getLocalized(article, "content", language);
  const [open, setOpen] = useState(false);
  const id = useId();
  const { dek, rest, preview } = useMemo(() => {
    const paragraphs = content.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const remaining = paragraphs.slice(1);
    return { dek: paragraphs[0] || "", rest: remaining, preview: clampParagraphs(remaining, DESCRIPTION_PREVIEW_CHARS) };
  }, [content]);
  // A visual essay's lines after the first are its captions, shown with the frames.
  const body = fold ? (open ? rest : preview.paragraphs) : [];
  return (
    <div className="sb-prose">
      {dek && <p className="font-display italic" style={{ fontSize: "clamp(22px, 2.2vw, 26px)", lineHeight: 1.45, color: "var(--parchment)" }}>{dek}</p>}
      {fold && (
        <>
          <div id={id}>{body.map((p, i) => <p key={i}>{p}</p>)}</div>
          {preview.truncated && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} className="rs-word no-print" style={{ fontSize: 19 }}>
              {open ? (en ? "Show less" : "Arată mai puțin") : (en ? "Read the whole story" : "Citește toată povestea")}
            </button>
          )}
        </>
      )}
    </div>
  );
};

/** A visual essay's frames and their captions. Captions come from media_captions; essays that pre-date that column carried one caption per line of the text after its first line. */
const framesOf = (article: Article): Frame[] => {
  const urls = article.mediaUrls?.length ? article.mediaUrls : (article.mediaUrl ? [article.mediaUrl] : []);
  const lines = (c?: string | null) => (c || "").split(/\n+/).filter(Boolean).slice(1);
  const enLines = lines(article.contentEn);
  const roLines = lines(article.contentRo);
  return urls.map((url, i) => ({
    url,
    caption: {
      en: (article.mediaCaptions?.[i]?.en || enLines[i] || "").trim(),
      ro: (article.mediaCaptions?.[i]?.ro || roLines[i] || "").trim(),
    },
  }));
};

/**
 * A story (the redesign's StoryPage), one page for every kind: the title
 * with where, when and when published, then the film or the frames, the
 * words with the margin beside them (the chapters, the place on the map,
 * stories nearby, the writer's note, how it was made), the readers' notes,
 * and more from the same shelf.
 */
export const EditorialArticle: React.FC<Props> = ({ article, views }) => {
  const { language, setLanguage } = useLanguage();
  const { handleFavoriteToggle, isFavorited } = useFavorites();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [related, setRelated] = useState<Article[]>([]);
  const [runtime, setRuntime] = useState(0);
  const neighbours = useStoryNeighbours(article);
  const text = useTextSize();
  const kind = kindOf(article);
  const isText = kind === "essay" || kind === "short" || kind === "poem";
  const { chapters, ids, marks, active } = useChapters(article, language);

  useEffect(() => {
    let cancelled = false;
    fetchCategories().then((cats) => { if (!cancelled) setCategories(cats); }).catch(() => {});
    // Pull only `id, title, type, cover columns` for up to 3 related
    // articles — same-category first, supplemented by recent stories from
    // other categories if fewer than 3 match.
    fetchRelatedArticles(article.id, article.categoryId, 3)
      .then((rows) => { if (!cancelled) setRelated(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [article.id, article.categoryId]);

  const category = categories.find((c) => c.id === article.categoryId);
  const categoryName = category ? getLocalized(category, "name", language) : null;
  const fav = isFavorited(article.id);
  const en = language === "en";
  const here = `/article/${article.id}`;
  const linkState = useMemo(() => ({ from: here }), [here]);
  const onDuration = useCallback((s: number) => setRuntime(s), []);

  // React Router numbers each in-app history entry (history.state.idx). At 0
  // the reader arrived on this story first — from a shared link or a search
  // engine — and going back would have sent them off the site.
  const onBack = () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate("/"));

  // A phone hands the link to its share sheet; elsewhere it is copied.
  const canShare = typeof navigator !== "undefined" && !!navigator.share && !!window.matchMedia?.("(pointer: coarse)").matches;
  const onShare = () => {
    const url = window.location.href;
    if (canShare) {
      navigator.share({ title: getLocalized(article, "title", language), url }).catch(() => {});
    } else {
      // A browser that blocks the clipboard (or has none, outside https)
      // used to make the button do nothing at all; now it says so.
      const failed = () => toast.error(en ? "Couldn't copy the link. Copy it from the address bar." : "Linkul nu a putut fi copiat. Copiază-l din bara de adrese.");
      if (!navigator.clipboard) { failed(); return; }
      navigator.clipboard.writeText(url)
        .then(() => toast.success(en ? "Link copied — pass it on." : "Link copiat — dă-l mai departe."))
        .catch(failed);
    }
  };

  const title = getLocalized(article, "title", language);
  const { main, sub } = splitTitle(title);
  const other: Lang = en ? "ro" : "en";
  const otherTitle = kind === "poem" ? splitTitle(getLocalized(article, "title", other)).main : "";
  const coverSrc = articleCoverUrl(article);
  const showHero = isText && !!coverSrc;
  const frames = useMemo(() => (kind === "visual" ? framesOf(article) : []), [kind, article]);
  const place = placeOf(article, language);
  const when = whenOf(article, language);
  const length = kind === "film"
    ? (runtime > 0 ? (en ? `${formatRuntime(runtime)} runtime` : `durată ${formatRuntime(runtime)}`) : null)
    : kind === "visual"
      ? countLabel(frames.length, "frame", language)
      : (en ? readPhrase(article, "en") : lowerFirst(readPhrase(article, "ro")));
  const published = joinMeta([
    formatArticleDate(article.createdAt, language),
    length,
    viewsPhrase(views, language),
    (kind === "film" || (kind === "visual" && frames.length > 0)) && aiPhrase(language, kind === "film"),
  ]);
  const journey = neighbours.journey;
  const sizeIndex = TEXT_SIZE_ORDER.indexOf(text.size);

  return (
    <div className="rs-in">
      <ProgressLine />

      {/* A stop on a journey: where the reader is, and where it goes next. */}
      {journey && (
        <div className="ed-container no-print" style={{ paddingTop: 16 }}>
          <div className="rs-journey-strip">
            <span style={{ color: "var(--gold)" }}>{getLocalized(journey.journey, "title", language)}</span>
            <span>{en ? `Stop ${journey.index + 1} of ${journey.journey.stops.length}` : `Oprirea ${journey.index + 1} din ${journey.journey.stops.length}`}</span>
            {journey.next ? (
              <Link to={`/article/${journey.next.id}`} state={linkState} className="rs-journey-next">
                {en ? "Next stop" : "Următoarea oprire"}: {splitTitle(getLocalized(journey.next, "title", language)).main} →
              </Link>
            ) : (
              <Link to={`/map?journey=${journey.journey.id}&stop=${journey.index + 1}`} className="rs-journey-next">
                {en ? "Back to the journey on the map →" : "Înapoi la călătorie, pe hartă →"}
              </Link>
            )}
          </div>
        </div>
      )}

      <header className="ed-container" style={{ paddingTop: "clamp(32px, 5vw, 64px)", paddingBottom: "clamp(32px, 4vw, 48px)" }}>
        <div className={cn("grid grid-cols-1 items-center gap-[clamp(32px,5vw,72px)]", showHero && "min-[1000px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]")}>
          <div className="flex flex-col gap-5">
            <nav aria-label={en ? "Breadcrumb" : "Fir de navigare"} className="rs-story-crumbs no-print">
              <button type="button" onClick={onBack} className="rs-crumb-back">← {en ? "Back" : "Înapoi"}</button>
              <span aria-hidden="true">·</span>
              {category && categoryName ? <Link to={`/category/${category.id}`} className="rs-crumb-shelf">{categoryName}</Link> : null}
              {category && categoryName && <span aria-hidden="true">·</span>}
              <span>{kindWord(article, language)}</span>
            </nav>
            <h1 className="rs-display" style={{ fontSize: isText ? "clamp(44px, 5.6vw, 84px)" : "clamp(48px, 6.4vw, 100px)", lineHeight: 0.98, letterSpacing: "-0.022em" }}>
              {main}
              {sub && <span className="sr-only">: {sub}</span>}
            </h1>
            {sub && (
              <p aria-hidden="true" className="m-0 font-display italic" style={{ fontSize: "clamp(22px, 2.2vw, 30px)", lineHeight: 1.25, color: "var(--text-dim)" }}>{sub}</p>
            )}
            {otherTitle && otherTitle !== main && (
              <p lang={other} className="m-0 font-display italic" style={{ fontSize: "clamp(24px, 2.6vw, 34px)", lineHeight: 1.2, color: "var(--text-dim)" }}>{otherTitle}</p>
            )}
            <dl className="rs-facts">
              {place && (<><dt>{en ? "Where" : "Unde"}</dt><dd>{place}</dd></>)}
              {when && (<><dt>{en ? "When" : "Când"}</dt><dd>{when}</dd></>)}
              <dt>{en ? "Published" : "Publicată"}</dt><dd>{published}</dd>
            </dl>
            <div className="no-print flex flex-wrap gap-2.5 mt-1">
              <button type="button" className={cn("rs-act", fav && "is-on")} aria-pressed={fav} onClick={(e) => handleFavoriteToggle(e, article.id)}>
                <Heart className={cn("w-[15px] h-[15px]", fav && "fill-current")} strokeWidth={1.75} aria-hidden="true" />
                {fav ? (en ? "On your shelf" : "Pe raftul tău") : (en ? "Save to your shelf" : "Păstrează pe raft")}
              </button>
              <button type="button" className="rs-act" onClick={onShare}>
                <Link2 className="w-[15px] h-[15px]" strokeWidth={1.75} aria-hidden="true" />
                {canShare ? (en ? "Pass it on" : "Dă-o mai departe") : (en ? "Copy link" : "Copiază linkul")}
              </button>
              <button type="button" className="rs-act is-dim" lang={other} onClick={() => setLanguage(other)}>
                {en ? "Citește în română" : "Read in English"}
              </button>
              {isText && (
                <button type="button" className="rs-act is-dim" style={{ paddingInline: 14 }} onClick={() => text.setSize(TEXT_SIZE_ORDER[(sizeIndex + 1) % TEXT_SIZE_ORDER.length])}>
                  Aa<span className="sr-only">: {en ? "text size" : "mărimea textului"} {textSizeName(text.size, en)}</span>
                </button>
              )}
              <button type="button" className="rs-act is-dim" style={{ paddingInline: 14 }} onClick={() => window.print()} aria-label={en ? "Print" : "Tipărește"} title={en ? "Print" : "Tipărește"}>
                <Printer className="w-[15px] h-[15px]" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
          {showHero && (
            <figure className="m-0" style={{ padding: 10, border: "1px solid var(--line)", borderRadius: "50% 50% 24px 24px / 26% 26% 24px 24px" }}>
              <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 4.6", borderRadius: "50% 50% 14px 14px / 30% 30% 14px 14px", background: "var(--paper)" }}>
                <img
                  src={storageImage(coverSrc, "feature")}
                  srcSet={storageSrcSet(coverSrc, ["card", "feature"])}
                  sizes="(min-width: 1000px) 45vw, 94vw"
                  alt={title}
                  fetchPriority="high"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <figcaption className="text-center" style={{ padding: "12px 8px 2px", fontFamily: "var(--ui)", fontSize: 12, fontWeight: 500, color: "var(--text-mute)" }}>
                {en ? "An AI illustration, not a photograph." : "O ilustrație AI, nu o fotografie."}
              </figcaption>
            </figure>
          )}
        </div>
      </header>

      {(kind === "essay" || kind === "short") && <MomentsStrip moments={article.moments} chapterIds={ids} language={language} />}
      {kind === "film" && <FilmStage article={article} language={language} onDuration={onDuration} />}
      {kind === "visual" && <PictureBook frames={frames} title={title} language={language} />}

      <div className="ed-container rs-story-grid" style={{ paddingTop: "clamp(40px, 5vw, 72px)" }}>
        <div className="rs-story-main min-w-0">
          <div style={text.style}>
            {kind === "essay" && <EssayChapters chapters={chapters} ids={ids} language={language} />}
            {kind === "short" && <StoryScenes chapters={chapters} ids={ids} language={language} />}
            {kind === "poem" && <PoemPage article={article} language={language} />}
            {kind === "film" && <MediaText article={article} language={language} fold />}
            {kind === "visual" && <MediaText article={article} language={language} fold={false} />}
          </div>
          {/* The rosette closes every story. */}
          <div id={END_ID} className="max-w-[680px] flex flex-col items-center text-center gap-3" style={{ margin: "64px 0 48px" }}>
            <Rosette size="lg" />
            <p className="rs-display m-0" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: 0 }}>{en ? "The end" : "Sfârșit"}</p>
          </div>
          <CommentsWhenNear articleId={article.id} />
        </div>

        <aside className="rs-aside">
          {marks.length > 1 && (kind === "essay" || kind === "short") && (
            <div className="hidden min-[1100px]:block"><ChapterPath marks={marks} active={active} language={language} /></div>
          )}
          <PlaceCard article={article} language={language} label={en ? "Place & time" : "Loc și timp"} />
          {article.location && <NearbyCard county={article.location} stories={neighbours.nearby} language={language} from={here} />}
          {journey && <JourneyCard stop={journey} language={language} from={here} showIntro={kind === "poem"} />}
          <NoteCard article={article} language={language} label={kind === "poem" ? (en ? "About the poem" : "Despre poem") : undefined} />
          <div className="rs-margin-card is-dashed">
            <p className="rs-eyebrow" style={{ marginBottom: 8 }}>{en ? "How this was made" : "Cum a fost făcută"}</p>
            <p className="m-0" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-dim)" }}>
              {en
                ? "Researched and written by hand from archives and field notes. The pictures and films are made with AI tools and marked as illustrations."
                : "Documentată și scrisă de mână, din arhive și note de teren. Imaginile și filmele sunt realizate cu instrumente AI și marcate ca ilustrații."}
            </p>
            <Link to="/terms#pictures" className="rs-underline inline-flex items-center min-h-[28px] mt-1.5" style={{ fontFamily: "var(--ui)", fontSize: 13, fontWeight: 700 }}>
              {en ? "About the pictures" : "Despre imagini"}
            </Link>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="no-print ed-container" style={{ paddingTop: "clamp(64px, 8vw, 112px)" }}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <h2 className="rs-display" style={{ fontSize: "clamp(36px, 4vw, 52px)", lineHeight: 1 }}>
              {categoryName && related.every((r) => r.categoryId === article.categoryId)
                ? `${en ? "More from" : "Mai mult din"} ${categoryName}`
                : (en ? "Keep wandering." : "Continuă să rătăcești.")}
            </h2>
            {category && (
              <Link to={`/category/${category.id}`} className="rs-btn rs-btn-ghost" style={{ minHeight: 44 }}>
                {en ? "The whole shelf →" : "Tot raftul →"}
              </Link>
            )}
          </div>
          <div className="grid gap-x-9 gap-y-12 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            {related.map((r) => (
              <StoryCard
                key={r.id}
                article={r}
                category={categories.find((c) => c.id === r.categoryId)}
                language={language}
                size="md"
                linkState={linkState}
                isArticleFavorited={isFavorited(r.id)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        </section>
      )}

      {marks.length > 1 && (kind === "essay" || kind === "short") && (
        <ChapterPill language={language} chapters={marks} active={active} endId={END_ID} />
      )}
    </div>
  );
};
