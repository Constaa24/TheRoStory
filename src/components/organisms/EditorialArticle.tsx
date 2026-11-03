import React, { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Article, ArticleSubtype, Category, getLocalized, fetchCategories, fetchRelatedArticles } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { useActiveSection } from "@/hooks/use-active-section";
import { Heart, Share2, Printer, Play, Pause, Maximize2, Volume2, VolumeX, Captions, CaptionsOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// Comments load on their own, after the story: they sit below everything
// else, and they were the only reason the Radix chunk (~24 KB, for the
// delete-confirmation dialog) loaded with every story page. If the chunk
// can't load (a tab left open across a deploy), the section is simply left
// out rather than taking the story down with it.
const ArticleComments = lazy(() =>
  import("@/components/organisms/ArticleComments")
    .then((m) => ({ default: m.ArticleComments }))
    .catch(() => ({ default: () => null }))
);
import { StoryCard } from "@/components/ui/story-card";
import { storageImage, storageSrcSet } from "@/lib/image-url";
import { toneFor, articleCoverUrl, formatArticleDate, countLabel } from "@/lib/article-utils";
import { kindPhrase, parseStoryChapters, placeAndTime, placeOf, readPhrase, splitTitle, toRoman } from "@/lib/story-facts";
import { TheEnd, Thread } from "@/components/story/Ornaments";
import { ChapterPill, ReadingBar, useTextSize, type ChapterMark } from "@/components/story/ReadingBar";
import { EssayChapters, PoemPage, StoryScenes } from "@/components/story/StoryProse";
import { PictureBook, type Frame } from "@/components/story/PictureBook";
import { JourneyCard, NearbyCard, NoteCard, PlaceCard, useStoryNeighbours } from "@/components/story/StoryAside";
import { MomentsStrip } from "@/components/story/MomentsStrip";
import { CaptionOverlay, ReadAlong, chapterIndexAt, chapterTitle, useActiveCue, useFilmSubtitles } from "@/components/story/FilmReadAlong";
import type { Cue } from "@/lib/subtitles";

interface Props {
  article: Article;
  views?: number;
}

type Lang = "en" | "ro";

/** Below the sticky navigation (82px) and the reading bar (60px). */
const ASIDE_TOP = 170;
const END_ID = "story-end";

/**
 * A story, told the way its kind is best read: an essay with its chapter
 * path, a short story in a book's column, a poem on its own page in both
 * languages, a visual essay one frame at a time, a film in its frame. Each
 * ends with "The end", the reader's actions, notes from readers and the
 * stories to wander to next.
 */
export const EditorialArticle: React.FC<Props> = ({ article, views }) => {
  const { language, setLanguage } = useLanguage();
  const { handleFavoriteToggle, isFavorited } = useFavorites();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [related, setRelated] = useState<Article[]>([]);
  const neighbours = useStoryNeighbours(article);
  const text = useTextSize();

  useEffect(() => {
    let cancelled = false;
    fetchCategories().then((cats) => { if (!cancelled) setCategories(cats); }).catch(() => {});
    // Pull only `id, title, type, cover columns` for up to 3 related
    // articles — same-category first, supplemented by recent stories from
    // other categories if fewer than 3 match. Replaces a 500-row full-
    // content fetch that fired on every article view.
    fetchRelatedArticles(article.id, article.categoryId, 3)
      .then((rows) => { if (!cancelled) setRelated(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [article.id, article.categoryId]);

  const category = categories.find(c => c.id === article.categoryId);
  const categoryName = category ? getLocalized(category, 'name', language) : null;
  const fav = isFavorited(article.id);
  const en = language === 'en';
  const here = `/article/${article.id}`;
  const linkState = useMemo(() => ({ from: here }), [here]);

  // React Router numbers each in-app history entry (history.state.idx). At 0
  // the reader arrived on this story first — from a shared link or a search
  // engine — and history.length > 1 would have sent "Back to the stories"
  // off the site, back to wherever they came from.
  const onBack = () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/'));
  const onShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: getLocalized(article, 'title', language), url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url)
        .then(() => toast.success(en ? 'Link copied — pass it on.' : 'Link copiat — dă-l mai departe.'))
        .catch(() => {});
    }
  };

  const actions = (printLabel?: string) => (
    <div className="no-print flex flex-wrap justify-center gap-2.5">
      <button type="button" className="sb-btn sb-btn-ghost" aria-pressed={fav} onClick={(e) => handleFavoriteToggle(e, article.id)} style={fav ? { color: 'var(--gold)', borderColor: 'var(--gold-deep)' } : undefined}>
        <Heart className={cn('sb-ico', fav && 'fill-current')} aria-hidden="true" />
        {fav ? (en ? 'On your shelf' : 'Pe raftul tău') : (en ? 'Save to your shelf' : 'Păstrează pe raft')}
      </button>
      <button type="button" className="sb-btn sb-btn-ghost" onClick={onShare}>
        <Share2 className="sb-ico" aria-hidden="true" />
        {en ? 'Pass it on' : 'Dă-o mai departe'}
      </button>
      <button type="button" className="sb-btn sb-btn-ghost" onClick={() => window.print()}>
        <Printer className="sb-ico" aria-hidden="true" />
        {printLabel ?? (en ? 'Print' : 'Tipărește')}
      </button>
    </div>
  );

  const shared: StoryProps = {
    article, language, categoryName, views, neighbours, here, actions,
    onBack, onOtherLanguage: () => setLanguage(en ? 'ro' : 'en'),
    text, fav, onSave: (e) => handleFavoriteToggle(e, article.id),
  };

  const subtype: ArticleSubtype = (article.subtype as ArticleSubtype | null | undefined) || 'essay';
  const isPoem = article.type === 'text' && subtype === 'poetry';

  return (
    <div className="screen-anim">
      {article.type === 'text' && subtype === 'essay' && <EssayStory {...shared} />}
      {article.type === 'text' && subtype === 'short_story' && <ShortStory {...shared} />}
      {isPoem && <PoemStory {...shared} />}
      {article.type === 'carousel' && <VisualStory {...shared} />}
      {article.type === 'video' && <VideoFilm {...shared} />}

      {/* Notes from readers */}
      <Suspense fallback={<div aria-hidden="true" style={{ minHeight: 320 }} />}>
        <ArticleComments articleId={article.id} />
      </Suspense>

      {/* Keep wandering */}
      {related.length > 0 && (
        <section className="no-print sb-section">
          <div className="ed-container">
            <div className="flex flex-wrap justify-between items-end gap-6 mb-12">
              <div className="flex flex-col gap-3">
                <p className="sb-kicker">
                  {isPoem
                    ? (en ? 'More verse from the archive' : 'Mai multe versuri din arhivă')
                    : article.type === 'video' && categoryName
                      ? (en ? `More from ${categoryName}` : `Mai multe din ${categoryName}`)
                      : (en ? 'If you liked this story' : 'Dacă ți-a plăcut povestea')}
                </p>
                <h2 className="sb-h2">
                  {isPoem ? (en ? 'Keep reading.' : 'Citește mai departe.') : (en ? 'Keep wandering.' : 'Continuă să rătăcești.')}
                </h2>
              </div>
              <Link to="/map" className="sb-btn sb-btn-ghost">{en ? 'Open the map →' : 'Deschide harta →'}</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 gap-y-14">
              {related.map(r => (
                <StoryCard
                  key={r.id}
                  article={r}
                  category={categories.find(c => c.id === r.categoryId)}
                  language={language}
                  size="md"
                  linkState={linkState}
                  isArticleFavorited={isFavorited(r.id)}
                  onFavoriteToggle={handleFavoriteToggle}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

type StoryProps = {
  article: Article;
  language: Lang;
  categoryName: string | null;
  views?: number;
  neighbours: ReturnType<typeof useStoryNeighbours>;
  here: string;
  actions: (printLabel?: string) => React.ReactNode;
  onBack: () => void;
  onOtherLanguage: () => void;
  text: ReturnType<typeof useTextSize>;
  fav: boolean;
  onSave: (e: React.MouseEvent) => void;
};

// ── Shared pieces ────────────────────────────────────────────────────

/** "Landmarks · told in 4 chapters · a 3-minute read · 18 June 2026". */
const metaLine = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

/**
 * Every picture and film on The RoStory is made with generative AI. The EU
 * AI Act (Article 50(4), applying since 2 August 2026) requires AI-made
 * images and video that resemble real places, people or events to be
 * disclosed as such: clearly, on first sight, and, for creative work, in a
 * way that doesn't get in the way of it. So each story with a picture or a
 * film says so in its facts line, beside the title. The footer and the
 * Terms ("Pictures and films") say it for the whole site.
 */
const aiPhrase = (language: Lang, film = false) =>
  film
    ? (language === 'en' ? 'made with AI' : 'realizat cu AI')
    : (language === 'en' ? 'illustrated with AI' : 'ilustrat cu AI');

const viewsPhrase = (views: number | undefined, language: Lang) =>
  views !== undefined && views > 0 ? countLabel(views, 'view', language) : null;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The story's title page: where and when, the title and its subtitle, the facts. */
const TitlePage: React.FC<{
  kicker: string;
  title: string;
  meta: string;
  before?: React.ReactNode;
  /** A second title line in the other language (a poem's original title). */
  altTitle?: { text: string; lang: Lang } | null;
}> = ({ kicker, title, meta, before, altTitle }) => {
  const { main, sub } = splitTitle(title);
  return (
    <header className="ed-container" style={{ paddingTop: 'clamp(44px, 6vw, 72px)', paddingBottom: 48 }}>
      <div className="sb-chapter-head" style={{ gap: 18 }}>
        {before}
        <p className="sb-kicker">{kicker}</p>
        <h1 className="sb-h1" style={{ fontSize: 'clamp(48px, 7.4vw, 112px)' }}>
          {main}
          {sub && <span className="sr-only">: {sub}</span>}
        </h1>
        {sub && (
          <p aria-hidden="true" className="font-display italic m-0" style={{ fontSize: 'clamp(24px, 2.4vw, 34px)', lineHeight: 1.25, color: 'var(--text-dim)' }}>
            {sub}
          </p>
        )}
        {altTitle && (
          <p lang={altTitle.lang} className="font-display italic m-0" style={{ fontSize: 'clamp(28px, 3vw, 38px)', color: 'var(--text-dim)' }}>
            {altTitle.text}
          </p>
        )}
        <div className="flex items-center justify-center gap-3.5 mt-2">
          <Thread className="hidden sm:block shrink-0" style={{ width: 48 }} />
          <p className="sb-meta">{meta}</p>
          <Thread className="hidden sm:block shrink-0" style={{ width: 48 }} />
        </div>
      </div>
    </header>
  );
};

const useChapters = (article: Article, language: Lang) => {
  const content = getLocalized(article, 'content', language);
  const chapters = useMemo(() => parseStoryChapters(content), [content]);
  const ids = useMemo(() => chapters.map((_, i) => `chapter-${i + 1}`), [chapters]);
  const marks: ChapterMark[] = useMemo(
    () => chapters.map((c, i) => ({ id: ids[i], label: c.title || c.incipit })),
    [chapters, ids],
  );
  const active = useActiveSection(ids);
  return { chapters, ids, marks, active };
};

/** The chapter path beside an essay: where the reader is in the story. */
const ChapterPath: React.FC<{ marks: ChapterMark[]; active: number; language: Lang }> = ({ marks, active, language }) => (
  <nav aria-label={language === 'en' ? 'The story so far' : 'Povestea până aici'}>
    <p className="sb-kicker-sm mb-4" style={{ color: 'var(--text-mute)' }}>{language === 'en' ? 'The story so far' : 'Povestea până aici'}</p>
    <ol className="sb-path">
      {marks.map((m, i) => (
        <li key={m.id} className={cn('sb-path-step', i < active && 'is-done', i === active && 'is-now')}>
          <span className="sb-numeral" style={{ fontSize: 14 }} aria-hidden="true">{toRoman(i + 1)}</span>
          <a href={`#${m.id}`} className="sb-path-label" aria-current={i === active ? 'step' : undefined}>{m.label}</a>
        </li>
      ))}
    </ol>
  </nav>
);

/** The cards in a story's margin, in the order a reader wants them. */
const MarginCards: React.FC<StoryProps & { placeLabel?: string; noteLabel?: string; showIntro?: boolean; withPlace?: boolean }> = ({
  article, language, neighbours, here, placeLabel, noteLabel, showIntro, withPlace = true,
}) => (
  <>
    {withPlace && <PlaceCard article={article} language={language} label={placeLabel} />}
    {article.location && <NearbyCard county={article.location} stories={neighbours.nearby} language={language} from={here} />}
    {neighbours.journey && <JourneyCard stop={neighbours.journey} language={language} from={here} showIntro={showIntro} />}
    <NoteCard article={article} language={language} label={noteLabel} />
  </>
);

const coverOf = (article: Article, size: 'feature' | 'hero' | 'card' = 'feature') => storageImage(articleCoverUrl(article), size);

// ── An essay ─────────────────────────────────────────────────────────
const EssayStory: React.FC<StoryProps> = (props) => {
  const { article, language, categoryName, views, text } = props;
  const en = language === 'en';
  const { chapters, ids, marks, active } = useChapters(article, language);
  const title = getLocalized(article, 'title', language);
  const cover = coverOf(article);
  const where = placeAndTime(article, language);
  const date = formatArticleDate(article.createdAt, language);

  return (
    <>
      <ReadingBar
        language={language} onBack={props.onBack} chapters={marks} active={active}
        textSize={text.size} onTextSize={text.setSize} onOtherLanguage={props.onOtherLanguage}
        saved={props.fav} onSave={props.onSave}
      />
      <article style={text.style}>
        <TitlePage
          kicker={metaLine([kindPhrase(article, language), where])}
          title={title}
          meta={metaLine([
            categoryName,
            chapters.length > 1 && (en ? `told in ${countLabel(chapters.length, 'chapter', 'en')}` : `spus în ${countLabel(chapters.length, 'chapter', 'ro')}`),
            en ? `a ${readPhrase(article, 'en')}` : lowerFirst(readPhrase(article, 'ro')),
            date,
            viewsPhrase(views, language),
            cover && aiPhrase(language),
          ])}
        />
        {cover && (
          <figure className="ed-container mx-auto" style={{ maxWidth: 1240, marginBottom: 'clamp(40px, 6vw, 72px)' }}>
            <div className="sb-window-shallow">
              <div className="sb-arch sb-arch-shallow aspect-[4/3] sm:aspect-[21/10]">
                <img src={cover} srcSet={storageSrcSet(articleCoverUrl(article), ['card', 'feature'])} sizes="(min-width: 1280px) 1200px, 94vw" alt={title} fetchPriority="high" />
              </div>
            </div>
            {placeOf(article, language) && (
              <figcaption className="sb-kicker-sm text-center mt-3.5" style={{ color: 'var(--text-dim)' }}>{placeOf(article, language)}</figcaption>
            )}
          </figure>
        )}
        <MomentsStrip moments={article.moments} chapterIds={ids} language={language} />
        <div className="ed-container grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_280px] gap-12 xl:gap-14 items-start" style={{ paddingBottom: 40 }}>
          <aside className="hidden xl:block xl:sticky" style={{ top: ASIDE_TOP }}>
            {marks.length > 1 && <ChapterPath marks={marks} active={active} language={language} />}
          </aside>
          <div className="sb-measure w-full">
            <EssayChapters chapters={chapters} ids={ids} language={language} />
            <div id={END_ID} className="mt-[72px]">
              <TheEnd language={language}>
                <p className="sb-meta">{en ? `Told by The RoStory · ${date}` : `Spusă de The RoStory · ${date}`}</p>
              </TheEnd>
            </div>
          </div>
          <aside className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 xl:sticky content-start" style={{ top: ASIDE_TOP }}>
            <MarginCards {...props} />
          </aside>
        </div>
        <section className="ed-container" style={{ paddingTop: 24, paddingBottom: 88 }}>{props.actions()}</section>
      </article>
      <ChapterPill language={language} chapters={marks} active={active} endId={END_ID} />
    </>
  );
};

// ── A short story ────────────────────────────────────────────────────
const ShortStory: React.FC<StoryProps> = (props) => {
  const { article, language, categoryName, views, text } = props;
  const en = language === 'en';
  const { chapters, ids, marks, active } = useChapters(article, language);
  const title = getLocalized(article, 'title', language);
  const cover = coverOf(article);
  const date = formatArticleDate(article.createdAt, language);

  return (
    <>
      <ReadingBar
        language={language} onBack={props.onBack} chapters={marks} active={active}
        textSize={text.size} onTextSize={text.setSize} onOtherLanguage={props.onOtherLanguage}
        saved={props.fav} onSave={props.onSave}
      />
      <article style={text.style}>
        <TitlePage
          before={cover ? (
            <div className="sb-window w-full mb-3.5" style={{ maxWidth: 420 }}>
              <div className="sb-arch" style={{ aspectRatio: '4 / 4.8' }}><img src={cover} srcSet={storageSrcSet(articleCoverUrl(article), ['card', 'feature'])} sizes="(min-width: 480px) 420px, 92vw" alt={title} fetchPriority="high" /></div>
            </div>
          ) : null}
          kicker={metaLine([kindPhrase(article, language), placeAndTime(article, language)])}
          title={title}
          meta={metaLine([
            categoryName,
            chapters.length > 1 && countLabel(chapters.length, 'scene', language),
            en ? `a ${readPhrase(article, 'en')}` : lowerFirst(readPhrase(article, 'ro')),
            date,
            viewsPhrase(views, language),
            cover && aiPhrase(language),
          ])}
        />
        <MomentsStrip moments={article.moments} chapterIds={ids} language={language} />
        <div className="ed-container">
          <div className="sb-measure">
            <StoryScenes chapters={chapters} ids={ids} language={language} />
            <div id={END_ID} className="mt-16">
              <TheEnd language={language} />
            </div>
          </div>
        </div>
        <section className="ed-container" style={{ paddingTop: 56, paddingBottom: 96 }}>
          <div className="sb-measure grid gap-6">
            <PlaceCard article={article} language={language} layout="row" />
            <div className="grid gap-5 sm:grid-cols-2 empty:hidden">
              <MarginCards {...props} withPlace={false} />
            </div>
            {props.actions()}
          </div>
        </section>
      </article>
      <ChapterPill language={language} chapters={marks} active={active} endId={END_ID} />
    </>
  );
};

// ── A poem ───────────────────────────────────────────────────────────
const PoemStory: React.FC<StoryProps> = (props) => {
  const { article, language, categoryName, views, text } = props;
  const en = language === 'en';
  const title = getLocalized(article, 'title', language);
  const other: Lang = en ? 'ro' : 'en';
  const otherTitle = splitTitle(getLocalized(article, 'title', other)).main;
  const cover = coverOf(article);
  const where = placeAndTime(article, language);
  const bilingual = !!article.contentEn?.trim() && !!article.contentRo?.trim() && article.contentEn.trim() !== article.contentRo.trim();
  const stanzas = parseStoryChapters(getLocalized(article, 'content', language))
    .flatMap((c) => c.body.split(/\n\s*\n/))
    .filter((s) => s.trim()).length;

  return (
    <>
      <ReadingBar
        language={language} onBack={props.onBack} chapters={[]} active={0}
        textSize={text.size} onTextSize={text.setSize} onOtherLanguage={props.onOtherLanguage}
        saved={props.fav} onSave={props.onSave}
      />
      <article style={text.style}>
        <TitlePage
          kicker={metaLine([kindPhrase(article, language), where])}
          title={title}
          altTitle={otherTitle && otherTitle !== splitTitle(title).main ? { text: otherTitle, lang: other } : null}
          meta={metaLine([
            categoryName,
            stanzas > 1 && countLabel(stanzas, 'stanza', language),
            bilingual && (en ? 'read in Romanian and English' : 'de citit în română și engleză'),
            formatArticleDate(article.createdAt, language),
            viewsPhrase(views, language),
            cover && aiPhrase(language),
          ])}
        />
        <div className="ed-container grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 lg:gap-14 items-start" style={{ paddingBottom: 72 }}>
          <div id={END_ID}>
            <PoemPage article={article} language={language} footer={where ? <p className="sb-meta">{where}</p> : null} />
          </div>
          <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 content-start">
            {cover && (
              <div className="sb-window" style={{ padding: 8 }}>
                <div className="sb-arch" style={{ aspectRatio: '4 / 5' }}><img src={cover} srcSet={storageSrcSet(articleCoverUrl(article), ['card', 'feature'])} sizes="(min-width: 1024px) 320px, 92vw" alt="" fetchPriority="high" /></div>
              </div>
            )}
            <MarginCards {...props} noteLabel={en ? 'About the poem' : 'Despre poem'} showIntro />
          </aside>
        </div>
        <section className="ed-container" style={{ paddingBottom: 96 }}>
          {props.actions(en ? 'Print the poem' : 'Tipărește poemul')}
        </section>
      </article>
    </>
  );
};

// ── A visual essay ───────────────────────────────────────────────────
const VisualStory: React.FC<StoryProps> = (props) => {
  const { article, language, categoryName, views } = props;
  const en = language === 'en';
  const title = getLocalized(article, 'title', language);
  const content = getLocalized(article, 'content', language);
  const dek = content.split(/\n+/).filter(Boolean)[0] || '';
  const date = formatArticleDate(article.createdAt, language);

  // Captions come from media_captions; essays that pre-date that column
  // carried one caption per line of the text after its first line.
  const frames: Frame[] = useMemo(() => {
    const urls = article.mediaUrls?.length ? article.mediaUrls : (article.mediaUrl ? [article.mediaUrl] : []);
    const lines = (c?: string | null) => (c || '').split(/\n+/).filter(Boolean).slice(1);
    const enLines = lines(article.contentEn);
    const roLines = lines(article.contentRo);
    return urls.map((url, i) => ({
      url,
      caption: {
        en: (article.mediaCaptions?.[i]?.en || enLines[i] || '').trim(),
        ro: (article.mediaCaptions?.[i]?.ro || roLines[i] || '').trim(),
      },
    }));
  }, [article]);

  // The explicit poster first; essays from before the poster field fall
  // back to the first frame.
  const heroSource = article.posterUrl || article.mediaUrl || article.mediaUrls?.[0];
  const hero = storageImage(heroSource, 'hero');
  const where = placeAndTime(article, language);
  const kind = en ? `A visual essay in ${countLabel(frames.length, 'frame', 'en')}` : `Un eseu vizual în ${countLabel(frames.length, 'frame', 'ro')}`;

  return (
    <article>
      <header className="sb-cover relative overflow-hidden">
        <div className="sb-cover-art absolute inset-0">
          {hero
            ? <img src={hero} srcSet={storageSrcSet(heroSource)} sizes="100vw" alt="" fetchPriority="high" className="w-full h-full object-cover" style={{ objectPosition: '50% 40%' }} />
            : <div className="ph w-full h-full" data-tone={toneFor(article.id)} style={{ border: 0 }} />}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(13,11,8,0.35) 0%, rgba(13,11,8,0.25) 40%, rgba(13,11,8,0.92) 100%)' }} />
        </div>
        <div className="ed-container relative flex flex-col justify-between" style={{ minHeight: 'min(760px, calc(100svh - 82px))', paddingTop: 28, paddingBottom: 'clamp(40px, 6vw, 64px)' }}>
          <button type="button" onClick={props.onBack} className="sb-btn-word no-print self-start" style={{ fontSize: 18, color: '#f4ead7' }}>
            ← {en ? 'Back to the stories' : 'Înapoi la povești'}
          </button>
          <div className="flex flex-col gap-5 mt-24" style={{ maxWidth: 980 }}>
            <p className="sb-kicker" style={{ color: '#d9bf8c' }}>{metaLine([kind, where])}</p>
            <h1 className="sb-h1" style={{ fontSize: 'clamp(48px, 8vw, 128px)', color: '#f4ead7' }}>{title}</h1>
            {dek && (
              <p className="sb-lede" style={{ color: 'rgba(244, 234, 215, 0.85)', maxWidth: 720 }}>
                {dek.length > 360 ? `${dek.slice(0, 360).trimEnd()}…` : dek}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3.5 mt-2">
              {frames.length > 0 && (
                <a href="#frames" className="sb-btn no-print">{en ? 'Turn the first page ↓' : 'Întoarce prima pagină ↓'}</a>
              )}
              <p className="sb-meta" style={{ color: 'rgba(244, 234, 215, 0.78)' }}>
                {metaLine([categoryName, en ? `a ${readPhrase(article, 'en')}` : lowerFirst(readPhrase(article, 'ro')), date, viewsPhrase(views, language), (hero || frames.length > 0) && aiPhrase(language)])}
              </p>
            </div>
          </div>
        </div>
      </header>

      <PictureBook frames={frames} title={title} language={language} />

      <section className="ed-container" style={{ paddingTop: 72, paddingBottom: 96 }}>
        <div id={END_ID} className="mb-14">
          <TheEnd language={language}>
            <p className="sb-meta">{en ? `Told in pictures by The RoStory · ${date}` : `Spusă în imagini de The RoStory · ${date}`}</p>
          </TheEnd>
        </div>
        <div className="grid gap-6 md:grid-cols-2 mx-auto" style={{ maxWidth: 1040 }}>
          <MarginCards {...props} placeLabel={en ? 'Where it happened' : 'Unde s-a petrecut'} />
        </div>
        <div className="mt-10">{props.actions()}</div>
      </section>
    </article>
  );
};

// ── A film ───────────────────────────────────────────────────────────

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
      const lastSpace = cut.lastIndexOf(' ');
      out.push((lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…');
    }
    return { paragraphs: out, truncated: true };
  }
  return { paragraphs: out, truncated: false };
};

/** One shared empty list, so a film without subtitles doesn't hand the
 * cue tracker a new array, and new listeners, on every render. */
const NO_CUES: Cue[] = [];

const VideoFilm: React.FC<StoryProps> = (props) => {
  const { article, language, categoryName, views } = props;
  const title = getLocalized(article, 'title', language);
  const content = getLocalized(article, 'content', language);
  // The first paragraph is the synopsis; the rest is the description. The
  // description used to be cut at 600 characters with an ellipsis and no way
  // to read on, so anything past that was unreachable on the page.
  const { dek, rest, preview } = useMemo(() => {
    const paragraphs = content.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const remaining = paragraphs.slice(1);
    return {
      dek: paragraphs[0] || '',
      rest: remaining,
      preview: clampParagraphs(remaining, DESCRIPTION_PREVIEW_CHARS),
    };
  }, [content]);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const descriptionId = useId();
  // A poster can't take a srcset, so its size is chosen once: phones get
  // the 800px rendition instead of the 1600px one (~250 KB saved).
  const [posterSurface] = useState<'card' | 'feature'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches ? 'card' : 'feature'
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);
  // Hover-close grace period: the popup sits a few px above the button, so
  // the cursor briefly leaves the container while crossing the gap. Without
  // a delay, mouseleave fires and the slider snaps shut before the user
  // reaches it. The timer is canceled if mouseenter fires again (popup or
  // button).
  const hideTimerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  // Touch devices don't fire hover events, so the slider needs a tap to open
  // and an outside-tap (or second tap) to close. Detect once and adapt.
  const [isTouch, setIsTouch] = useState(false);

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [article.mediaUrl]);

  // Auto-hiding player chrome: while playing, the controls fade out after a
  // few idle seconds and reappear on mouse movement, so they don't sit over
  // the film. While paused they always stay visible.
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<number | null>(null);
  const CONTROLS_IDLE_MS = 2800;

  const clearControlsTimer = () => {
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  };

  // Show the chrome and, if playing, restart the idle countdown. `delay`
  // lets mouseleave hide a touch quicker than an idle timeout.
  const revealControls = (hideAfter: number = CONTROLS_IDLE_MS) => {
    setControlsVisible(true);
    clearControlsTimer();
    if (playing) {
      controlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
        controlsTimerRef.current = null;
      }, hideAfter);
    }
  };

  // Pause → always show; play → start the idle countdown.
  useEffect(() => {
    if (!playing) {
      clearControlsTimer();
      setControlsVisible(true);
      return;
    }
    clearControlsTimer();
    controlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsTimerRef.current = null;
    }, CONTROLS_IDLE_MS);
  }, [playing]);

  useEffect(() => () => clearControlsTimer(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(hover: none)');
    setIsTouch(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // On touch devices the slider opens on tap; close it when the user taps
  // anywhere outside the volume cluster.
  useEffect(() => {
    if (!showVolume || !isTouch) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!volumeContainerRef.current?.contains(e.target as Node)) {
        setShowVolume(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showVolume, isTouch]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const fullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    // iOS Safari doesn't expose the standard Fullscreen API on arbitrary
    // elements; the video element ships its own `webkitEnterFullscreen`.
    // Try the standard path first, then fall back through the vendor APIs.
    const vAny = v as HTMLVideoElement & {
      webkitRequestFullscreen?: () => void;
      webkitEnterFullscreen?: () => void;
    };
    const enterIOS = () => {
      if (typeof vAny.webkitEnterFullscreen === 'function') {
        try { vAny.webkitEnterFullscreen(); } catch { /* ignore */ }
      }
    };
    if (typeof v.requestFullscreen === 'function') {
      v.requestFullscreen().catch(enterIOS);
      return;
    }
    if (typeof vAny.webkitRequestFullscreen === 'function') {
      vAny.webkitRequestFullscreen();
      return;
    }
    enterIOS();
  };

  const handleVolumeButtonClick = () => {
    // Desktop keeps the quick mute-toggle on click (hover already exposes
    // the slider). Touch has no hover, so tapping the button opens/closes
    // the slider — that's how the user scales volume on mobile.
    if (isTouch) {
      setShowVolume(prev => !prev);
    } else {
      toggleMute();
    }
  };

  const cancelVolumeHide = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleVolumeMouseEnter = () => {
    cancelVolumeHide();
    setShowVolume(true);
  };

  const handleVolumeMouseLeave = () => {
    cancelVolumeHide();
    hideTimerRef.current = window.setTimeout(() => {
      setShowVolume(false);
      hideTimerRef.current = null;
    }, 200);
  };

  useEffect(() => () => cancelVolumeHide(), []);

  // Progress-bar scrubbing. Pointer events + pointer capture let the user
  // click AND drag the playhead, and keep tracking even when the cursor
  // leaves the (thin) bar. touch-action:none on the bar stops the page from
  // scrolling mid-drag on touch devices.
  const scrubbingRef = useRef(false);

  const seekToClientX = (clientX: number) => {
    const bar = progressBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = pct * duration;
    v.currentTime = t;
    setCurrentTime(t); // immediate feedback; don't wait for the timeupdate event
  };

  const handleScrubStart = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    seekToClientX(e.clientX);
  };
  const handleScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbingRef.current) seekToClientX(e.clientX);
  };
  const handleScrubEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    setVolume(val);
    if (val === 0) { v.muted = true; setMuted(true); }
    else if (v.muted) { v.muted = false; setMuted(false); }
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const en = language === 'en';
  const date = formatArticleDate(article.createdAt, language);

  // Subtitles and chapters (migration 20261102140000). Captions are on by
  // default in the page's language, or the other one when that's all there
  // is: the films are narrated, so a reader of the other language needs them.
  const subtitles = useFilmSubtitles(article);
  const subLanguages = (['en', 'ro'] as const).filter((l) => subtitles[l]);
  const [subLangChoice, setSubLangChoice] = useState<'en' | 'ro' | null>(null);
  const subLang: 'en' | 'ro' = subLangChoice && subtitles[subLangChoice] ? subLangChoice : (subtitles[language] ? language : subLanguages[0] ?? language);
  const cues = subtitles[subLang]?.cues ?? NO_CUES;
  const [captionsOn, setCaptionsOn] = useState(true);
  const activeCue = useActiveCue(videoRef, cues);
  const chapters = useMemo(() => [...(article.filmChapters ?? [])].sort((a, b) => a.t - b.t), [article.filmChapters]);
  const chapterIndex = chapterIndexAt(chapters, currentTime);
  const currentChapter = chapterTitle(chapters[chapterIndex], language);

  // In full screen the browser shows only the <video>, so the page's caption
  // layer can't follow it there; the matching <track> takes over instead.
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onChange = () => setVideoFullscreen(document.fullscreenElement === v);
    const onBegin = () => setVideoFullscreen(true);
    const onEnd = () => setVideoFullscreen(false);
    document.addEventListener('fullscreenchange', onChange);
    v.addEventListener('webkitbeginfullscreen', onBegin);
    v.addEventListener('webkitendfullscreen', onEnd);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      v.removeEventListener('webkitbeginfullscreen', onBegin);
      v.removeEventListener('webkitendfullscreen', onEnd);
    };
  }, [article.mediaUrl]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    for (const track of Array.from(v.textTracks)) {
      track.mode = videoFullscreen && captionsOn && track.language === subLang ? 'showing' : 'disabled';
    }
  }, [videoFullscreen, captionsOn, subLang, subtitles]);

  const seekTo = (time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = time;
    setCurrentTime(time);
    if (v.paused) v.play().catch(() => { /* autoplay refused: the reader presses play */ });
  };

  return (
    <article>
      <header className="ed-container" style={{ paddingTop: 28, paddingBottom: 36 }}>
        <button type="button" onClick={props.onBack} className="sb-btn-word no-print" style={{ fontSize: 18 }}>
          ← {en ? 'Back to the stories' : 'Înapoi la povești'}
        </button>
        <div className="flex flex-wrap justify-between items-end gap-5 mt-7">
          <div className="flex flex-col gap-3">
            <p className="sb-kicker">{metaLine([kindPhrase(article, language), placeAndTime(article, language)])}</p>
            <h1 className="sb-h1" style={{ fontSize: 'clamp(46px, 6.6vw, 100px)' }}>{title}</h1>
          </div>
          <p className="sb-meta">
            {metaLine([categoryName, date, viewsPhrase(views, language), !!article.mediaUrl && aiPhrase(language, true)])}
            {/* Real runtime from the player metadata — a word count of the
                synopsis says nothing about how long a film runs. It is only
                known once the metadata loads, so its place is held from the
                start, invisibly and at the end of the line: appearing late,
                it made the line too wide to sit beside the title, and the
                line wrapped below it, pushing the player 39 px down. Tabular
                digits keep the stand-in exactly as wide as a real m:ss. */}
            <span style={{ fontVariantNumeric: 'tabular-nums', visibility: duration > 0 ? undefined : 'hidden' }}>
              {categoryName || date || viewsPhrase(views, language) || article.mediaUrl ? ' · ' : ''}
              <span className="whitespace-nowrap">{duration > 0 ? formatTime(duration) : '0:00'} {en ? 'runtime' : 'durată'}</span>
            </span>
          </p>
        </div>
      </header>

      {/* The player: unchanged in behaviour, framed like a lantern slide. */}
      <section className="ed-container">
        <div
          className="video-frame"
          style={{ aspectRatio: '16/9', borderRadius: 22, background: '#0d0b08' }}
          onMouseMove={() => revealControls()}
          onMouseLeave={() => revealControls(500)}
        >
          {article.mediaUrl ? (
            <>
              <video
                ref={videoRef}
                src={article.mediaUrl}
                poster={storageImage(article.posterUrl, posterSurface)}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ cursor: controlsVisible ? 'pointer' : 'none' }}
                playsInline
                onClick={togglePlay}
              >
                {subLanguages.map((l) => (
                  <track key={l} kind="subtitles" srcLang={l} label={l === 'en' ? 'English' : 'Română'} src={subtitles[l]!.src} />
                ))}
              </video>
              {captionsOn && (
                <CaptionOverlay cue={activeCue >= 0 ? cues[activeCue] : undefined} lifted={controlsVisible} lang={subLang} />
              )}
              {!playing && (
                <button
                  type="button"
                  className="absolute inset-0 grid place-items-center cursor-pointer"
                  style={{ background: 'linear-gradient(180deg, rgba(13,11,8,0.1) 40%, rgba(13,11,8,0.7) 100%)', border: 0 }}
                  onClick={togglePlay}
                  aria-label={en ? 'Play the film' : 'Pornește filmul'}
                >
                  <span className="grid place-items-center transition-transform hover:scale-105" style={{ width: 'clamp(72px, 9vw, 104px)', height: 'clamp(72px, 9vw, 104px)', borderRadius: '50%', border: '1px solid rgba(217, 191, 140, 0.8)', background: 'rgba(13, 11, 8, 0.55)', color: '#d9bf8c' }}>
                    <Play className="w-8 h-8" fill="currentColor" aria-hidden="true" />
                  </span>
                </button>
              )}
              {/* Player chrome — fades out while playing + idle. onFocus/
                  onBlur keep it visible while a keyboard user is tabbing
                  through it (mousemove can't reveal it for them), then
                  resume auto-hide once focus leaves. */}
              <div
                className="absolute left-0 right-0 bottom-0 px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-4"
                style={{
                  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
                  color: '#f4ead7',
                  opacity: controlsVisible ? 1 : 0,
                  pointerEvents: controlsVisible ? 'auto' : 'none',
                  transition: 'opacity 0.3s ease',
                }}
                onFocus={() => { setControlsVisible(true); clearControlsTimer(); }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) revealControls();
                }}
              >
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-9 h-9 grid place-items-center cursor-pointer"
                  style={{ background: 'transparent', border: 0, color: 'inherit' }}
                  aria-label={playing ? (en ? 'Pause' : 'Pauză') : (en ? 'Play' : 'Pornește')}
                >
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="currentColor" />}
                </button>
                <div className="font-ui text-[13px] font-semibold whitespace-nowrap">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                {currentChapter && (
                  <div className="hidden md:block font-display italic text-[16px] truncate max-w-[200px]" style={{ color: '#d9bf8c' }}>
                    {currentChapter}
                  </div>
                )}
                <div
                  ref={progressBarRef}
                  className="flex-1 h-1.5 rounded-full relative cursor-pointer group after:content-[''] after:absolute after:inset-x-0 after:-inset-y-3"
                  style={{ background: 'rgba(244, 234, 215, 0.25)', touchAction: 'none' }}
                  onPointerDown={handleScrubStart}
                  onPointerMove={handleScrubMove}
                  onPointerUp={handleScrubEnd}
                  onPointerCancel={handleScrubEnd}
                  role="slider"
                  aria-label={en ? 'Seek' : 'Derulează'}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration) || 0}
                  aria-valuenow={Math.round(currentTime) || 0}
                  aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}${currentChapter ? ` · ${currentChapter}` : ''}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    const v = videoRef.current;
                    if (!v || !duration) return;
                    // Arrow keys nudge ±5s for keyboard users.
                    if (e.key === 'ArrowRight') { e.preventDefault(); v.currentTime = Math.min(duration, v.currentTime + 5); setCurrentTime(v.currentTime); }
                    else if (e.key === 'ArrowLeft') { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); setCurrentTime(v.currentTime); }
                    // PageDown / PageUp: the next chapter, or back to the start of
                    // this one (then the previous, if already near its start).
                    else if (e.key === 'PageDown' && chapters.length) {
                      e.preventDefault();
                      const next = chapters.find((c) => c.t > v.currentTime + 0.5);
                      if (next) { v.currentTime = next.t; setCurrentTime(next.t); }
                    } else if (e.key === 'PageUp' && chapters.length) {
                      e.preventDefault();
                      const back = [...chapters].reverse().find((c) => c.t < v.currentTime - 2);
                      const t = back ? back.t : 0;
                      v.currentTime = t; setCurrentTime(t);
                    }
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-100" style={{ width: progressPct + '%', background: '#c9a96e' }} />
                  {duration > 0 && chapters.filter((c) => c.t > 0 && c.t < duration).map((c) => (
                    <span
                      key={c.t}
                      aria-hidden="true"
                      className="absolute top-0 bottom-0"
                      style={{ left: `${(c.t / duration) * 100}%`, width: 3, marginLeft: -1.5, background: 'rgba(13, 11, 8, 0.9)' }}
                    />
                  ))}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progressPct}% - 6px)`, background: '#c9a96e', boxShadow: '0 0 4px rgba(0,0,0,0.4)' }}
                  />
                </div>
                {/* Volume */}
                <div
                  ref={volumeContainerRef}
                  className="relative"
                  onMouseEnter={isTouch ? undefined : handleVolumeMouseEnter}
                  onMouseLeave={isTouch ? undefined : handleVolumeMouseLeave}
                >
                  <button
                    type="button"
                    onClick={handleVolumeButtonClick}
                    className="w-9 h-9 grid place-items-center cursor-pointer"
                    style={{ background: 'transparent', border: 0, color: 'inherit' }}
                    aria-label={isTouch ? (en ? 'Volume' : 'Volum') : (muted ? (en ? 'Unmute' : 'Pornește sunetul') : (en ? 'Mute' : 'Oprește sunetul'))}
                    aria-expanded={isTouch ? showVolume : undefined}
                  >
                    {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  {showVolume && (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-3 rounded-xl flex flex-col items-center gap-2"
                      style={{ background: 'rgba(13,11,8,0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(201,169,110,0.3)' }}
                    >
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={muted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="volume-slider"
                        style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 4, height: 80, accentColor: '#c9a96e', cursor: 'pointer' }}
                        aria-label={en ? 'Volume' : 'Volum'}
                      />
                      {isTouch && (
                        <button
                          type="button"
                          onClick={toggleMute}
                          className="grid place-items-center cursor-pointer"
                          style={{ background: 'transparent', border: 0, color: 'inherit', padding: 2 }}
                          aria-label={muted ? (en ? 'Unmute' : 'Pornește sunetul') : (en ? 'Mute' : 'Oprește sunetul')}
                        >
                          {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {subLanguages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCaptionsOn((on) => !on)}
                    className="w-9 h-9 grid place-items-center cursor-pointer"
                    style={{ background: 'transparent', border: 0, color: 'inherit' }}
                    aria-pressed={captionsOn}
                    aria-label={en ? 'Subtitles' : 'Subtitrare'}
                    title={captionsOn
                      ? (en ? `Subtitles on (${subLang === 'en' ? 'English' : 'Romanian'})` : `Subtitrare pornită (${subLang === 'en' ? 'engleză' : 'română'})`)
                      : (en ? 'Subtitles off' : 'Subtitrare oprită')}
                  >
                    {captionsOn ? <Captions className="w-5 h-5" /> : <CaptionsOff className="w-5 h-5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={fullscreen}
                  className="w-9 h-9 grid place-items-center cursor-pointer"
                  style={{ background: 'transparent', border: 0, color: 'inherit' }}
                  aria-label={en ? 'Full screen' : 'Ecran complet'}
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="ph w-full h-full" data-tone={toneFor(article.id)} style={{ border: 0 }} />
          )}
        </div>
        {article.mediaUrl && (cues.length > 0 || chapters.length > 0) && (
          <ReadAlong
            cues={cues}
            chapters={chapters}
            active={activeCue}
            playing={playing}
            onSeek={seekTo}
            subLang={subLang}
            languages={subLanguages}
            onSubLang={setSubLangChoice}
            language={language}
          />
        )}
      </section>

      {/* The story the film tells, and its margin. */}
      <section className="ed-container" style={{ paddingTop: 'clamp(56px, 7vw, 80px)', paddingBottom: 'clamp(64px, 8vw, 96px)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,680px)_320px] gap-12 lg:gap-[72px] justify-center items-start">
          <div className="flex flex-col gap-6" id={END_ID}>
            <p className="sb-kicker">{en ? 'The story' : 'Povestea'}</p>
            <div className="sb-prose">
              {dek && (
                <p className="font-display italic" style={{ fontSize: 'clamp(22px, 2.2vw, 26px)', lineHeight: 1.45, color: 'var(--parchment)' }}>{dek}</p>
              )}
              <div id={descriptionId}>
                {(descriptionOpen ? rest : preview.paragraphs).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>
            {preview.truncated && (
              <button
                type="button"
                onClick={() => setDescriptionOpen((open) => !open)}
                aria-expanded={descriptionOpen}
                aria-controls={descriptionId}
                className="sb-btn-word no-print self-start"
              >
                {descriptionOpen
                  ? (en ? 'Show less' : 'Arată mai puțin')
                  : (en ? 'Read the whole story' : 'Citește toată povestea')}
              </button>
            )}
            <div className="mt-2">{props.actions()}</div>
          </div>
          <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 content-start">
            <MarginCards {...props} placeLabel={en ? 'Where it’s told' : 'Unde se spune'} />
          </aside>
        </div>
      </section>
    </article>
  );
};
