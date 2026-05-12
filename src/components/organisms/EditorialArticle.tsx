import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Article, Category, getLocalized, parseChapters, fetchCategories, fetchPublicContent } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useFavorites } from "@/hooks/use-favorites";
import { ArrowLeft, Heart, Share2, Printer, Play, Pause, Maximize2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArticleComments } from "@/components/organisms/ArticleComments";

interface Props {
  article: Article;
  views?: number;
}

const TONES = ["warm", "forest", "sky", "oxblood", "bone"] as const;
const toneFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return TONES[Math.abs(h) % TONES.length];
};

const readMinutes = (article: Article, language: 'en' | 'ro') => {
  const text = getLocalized(article, 'content', language);
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 220));
};

const placeLabel = (article: Article) => (article.location || '').toUpperCase();

const formatDate = (iso: string, lang: 'en' | 'ro') => {
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
};

export const EditorialArticle: React.FC<Props> = ({ article, views }) => {
  const { language } = useLanguage();
  const { handleFavoriteToggle, isFavorited } = useFavorites();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [related, setRelated] = useState<Article[]>([]);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [article.id]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    // Related-articles selection: same-category first (up to 3); if fewer
    // than 3 match, fill the remainder with a stable shuffle of other
    // published articles so we always show three thumbnails.
    fetchPublicContent()
      .then(({ articles }) => {
        const sameCategory = articles
          .filter(a => a.id !== article.id && a.categoryId === article.categoryId)
          .slice(0, 3);
        if (sameCategory.length >= 3) {
          setRelated(sameCategory);
          return;
        }
        const pool = articles.filter(
          a => a.id !== article.id && a.categoryId !== article.categoryId
        );
        // Deterministic shuffle keyed off article.id so the list is stable
        // across renders (Mulberry32 seeded from a hash of article.id).
        let seed = 0;
        for (let i = 0; i < article.id.length; i++) {
          seed = ((seed << 5) - seed + article.id.charCodeAt(i)) | 0;
        }
        const rand = () => {
          seed = (seed + 0x6d2b79f5) | 0;
          let t = seed;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        setRelated([...sameCategory, ...pool.slice(0, 3 - sameCategory.length)]);
      })
      .catch(() => {});
  }, [article.id, article.categoryId]);

  const category = categories.find(c => c.id === article.categoryId);
  const fav = isFavorited(article.id);

  const kindLabel = article.type === 'video'
    ? (language === 'en' ? 'Film' : 'Film')
    : article.type === 'carousel'
      ? (language === 'en' ? 'Photo essay' : 'Eseu foto')
      : (language === 'en' ? 'Long read' : 'Lectură lungă');

  return (
    <div className="screen-anim pb-20">
      <div className="read-progress" style={{ width: progress + '%' }} />

      {article.type === 'text' && <TextArticle article={article} category={category} views={views} />}
      {article.type === 'carousel' && <PhotoEssay article={article} category={category} views={views} />}
      {article.type === 'video' && <VideoFilm article={article} category={category} views={views} />}

      {/* Footer actions */}
      <section style={{ padding: '60px 0', borderTop: '1px solid var(--line-soft)' }}>
        <div className="ed-container max-w-[760px] mx-auto flex flex-wrap justify-between items-center gap-6">
          <div className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
            {kindLabel} · {readMinutes(article, language)} {language === 'en' ? 'min read' : 'min citire'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => handleFavoriteToggle(e, article.id)}
              className="pill cursor-pointer"
              style={{ color: fav ? 'var(--gold)' : 'var(--text-dim)' }}
            >
              <Heart className={cn('w-3 h-3', fav && 'fill-current')} /> {language === 'en' ? 'Save' : 'Salvează'}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: getLocalized(article, 'title', language), url: window.location.href }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText(window.location.href);
                }
              }}
              className="pill cursor-pointer"
            >
              <Share2 className="w-3 h-3" /> {language === 'en' ? 'Share' : 'Distribuie'}
            </button>
            <button onClick={() => window.print()} className="pill cursor-pointer">
              <Printer className="w-3 h-3" /> {language === 'en' ? 'Print' : 'Tipărește'}
            </button>
          </div>
        </div>
      </section>

      {/* Comments */}
      <ArticleComments articleId={article.id} />

      {/* Related */}
      {related.length > 0 && (
        <section style={{ padding: '100px 0 60px' }}>
          <div className="ed-container">
            <div className="flex flex-wrap justify-between items-end gap-6 mb-12">
              <div>
                <div className="eyebrow mb-3.5">{language === 'en' ? 'Related reading' : 'Lecturi conexe'}</div>
                <h2
                  className="font-display italic font-medium m-0"
                  style={{ fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1.05, color: 'var(--parchment)' }}
                >
                  {language === 'en' ? 'Keep wandering.' : 'Continuă să rătăcești.'}
                </h2>
              </div>
              <button onClick={() => navigate('/map')} className="btn-ed btn-ed-ghost">
                {language === 'en' ? 'Open the map →' : 'Deschide harta →'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {related.map(r => {
                const cat = categories.find(c => c.id === r.categoryId);
                const tone = toneFor(r.id);
                const cover = r.mediaUrl || r.posterUrl || r.mediaUrls?.[0];
                return (
                  <a key={r.id} href={`/article/${r.id}`} onClick={(e) => { e.preventDefault(); navigate(`/article/${r.id}`); }} className="block group" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div className="ph relative" data-tone={tone} data-label={placeLabel(r)} style={{ aspectRatio: '3/4' }}>
                      {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="pt-5">
                      <div className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
                        {cat && <span style={{ color: 'var(--gold)' }}>{getLocalized(cat, 'name', language)}</span>}
                      </div>
                      <h3 className="font-display italic font-medium m-0 mt-3" style={{ fontSize: 22, lineHeight: 1.1, color: 'var(--text)' }}>
                        {getLocalized(r, 'title', language)}
                      </h3>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

// ── Shared masthead ──────────────────────────────────────────────────
const ArticleMasthead: React.FC<{ article: Article; category?: Category; kindLabel: string }> = ({ article, category, kindLabel }) => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  return (
    <header style={{ padding: '60px 0 40px', borderBottom: '1px solid var(--line-soft)' }}>
      <div className="ed-container">
        <button
          onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/'))}
          className="flex items-center gap-2 mb-8 transition-colors hover:text-gold cursor-pointer"
          style={{ color: 'var(--text-dim)', background: 'transparent', border: 0, fontFamily: 'var(--ui)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {language === 'en' ? 'Back' : 'Înapoi'}
        </button>
        <div className="flex flex-wrap items-center gap-3.5 mb-8">
          <span className="pill" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>{kindLabel}</span>
          {category && <span className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>{getLocalized(category, 'name', language)}</span>}
          {article.location && (
            <>
              <span className="font-ui text-[11px]" style={{ color: 'var(--text-mute)' }}>·</span>
              <span className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>{article.location}</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

const Byline: React.FC<{ article: Article; views?: number }> = ({ article, views }) => {
  const { language } = useLanguage();
  return (
    <div className="ed-container" style={{ paddingTop: 28, paddingBottom: 36 }}>
      <div className="max-w-[760px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div>
          <div className="eyebrow mb-2">{language === 'en' ? 'Written by' : 'Text de'}</div>
          <div className="font-display italic" style={{ fontSize: 22, color: 'var(--text)' }}>The RoStory</div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-3 md:text-right">
          <div className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
            {formatDate(article.createdAt, language)} · {readMinutes(article, language)} {language === 'en' ? 'min read' : 'min citire'}
            {views !== undefined && views > 0 && (
              <> · {views.toLocaleString()} {language === 'en' ? 'views' : 'vizualizări'}</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Variant A: TEXT ARTICLE (long-form essay) ───────────────────────
const TextArticle: React.FC<{ article: Article; category?: Category; views?: number }> = ({ article, category, views }) => {
  const { language } = useLanguage();
  const title = getLocalized(article, 'title', language);
  const content = getLocalized(article, 'content', language);
  const chapters = useMemo(() => parseChapters(content).filter(Boolean), [content]);
  const tone = toneFor(article.id);
  const cover = article.mediaUrl;

  return (
    <article>
      <ArticleMasthead article={article} category={category} kindLabel={language === 'en' ? 'Long read' : 'Lectură lungă'} />

      {/* Title */}
      <section style={{ padding: '60px 0 40px' }}>
        <div className="ed-container">
          <div className="max-w-[880px] mx-auto text-center">
            <h1
              className="font-display italic font-medium m-0"
              style={{
                fontSize: 'clamp(56px, 8vw, 110px)',
                lineHeight: 0.95,
                letterSpacing: '-0.015em',
                color: 'var(--parchment)',
                textWrap: 'balance' as React.CSSProperties['textWrap'],
              }}
            >
              {title}
            </h1>
          </div>
        </div>
      </section>

      <Byline article={article} views={views} />

      {/* Lead image */}
      {cover && (
        <section className="ed-container" style={{ paddingBottom: 60 }}>
          <div className="ph relative" data-tone={tone} data-label={placeLabel(article)} style={{ aspectRatio: '21/10', maxWidth: 1180, margin: '0 auto' }}>
            <img src={cover} alt={title} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </section>
      )}

      {/* Body */}
      <section style={{ padding: '20px 0 60px' }}>
        <div className="ed-container">
          <div className="max-w-[720px] mx-auto" style={{ fontSize: 20, lineHeight: 1.75, color: 'var(--text)' }}>
            {chapters.length > 1 ? (
              chapters.map((chapter, i) => (
                <ChapterBlock key={i} index={i} text={chapter} />
              ))
            ) : (
              <BodyContent text={content} />
            )}
          </div>
        </div>
      </section>
    </article>
  );
};

const ChapterBlock: React.FC<{ index: number; text: string }> = ({ index, text }) => {
  const { language } = useLanguage();
  return (
    <>
      {index > 0 && (
        <h2
          className="font-display italic font-medium"
          style={{ fontSize: 40, lineHeight: 1.1, marginTop: 64, marginBottom: 24, color: 'var(--parchment)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
        >
          {language === 'en' ? `${romanNumeral(index + 1)}.` : `${romanNumeral(index + 1)}.`}
        </h2>
      )}
      <BodyContent text={text} dropcap={index === 0} />
    </>
  );
};

const BodyContent: React.FC<{ text: string; dropcap?: boolean }> = ({ text, dropcap }) => {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((p, i) => {
        if (p.startsWith('> ')) {
          return (
            <blockquote key={i} className="pull">
              {p.replace(/^>\s*/, '')}
            </blockquote>
          );
        }
        const cls = i === 0 && dropcap ? 'dropcap' : '';
        return (
          <p key={i} className={cls} style={{ marginTop: i === 0 ? 0 : '1em', textWrap: 'pretty' as React.CSSProperties['textWrap'] }}>
            {p}
          </p>
        );
      })}
    </>
  );
};

const romanNumeral = (n: number): string => {
  const map: Array<[number, string]> = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  let num = n;
  for (const [v, s] of map) {
    while (num >= v) { result += s; num -= v; }
  }
  return result;
};

// ── Variant B: PHOTO ESSAY ───────────────────────────────────────────
const PhotoEssay: React.FC<{ article: Article; category?: Category; views?: number }> = ({ article, category, views }) => {
  const { language } = useLanguage();
  const title = getLocalized(article, 'title', language);
  const content = getLocalized(article, 'content', language);
  const dek = content.split(/\n+/).filter(Boolean)[0] || '';
  const tone = toneFor(article.id);
  const navigate = useNavigate();

  // Build scenes from media
  const scenes = useMemo(() => {
    const urls = article.mediaUrls || (article.mediaUrl ? [article.mediaUrl] : []);
    const captions = article.mediaCaptions || [];
    const captionTexts = content.split(/\n+/).filter(Boolean).slice(1);
    return urls.map((url, i) => ({
      url,
      caption: (captions[i]?.[language] || captionTexts[i] || '').trim(),
      tone: TONES[i % TONES.length],
      aspect: i % 3 === 0 ? '21/10' : i % 3 === 1 ? '16/9' : '4/3',
    }));
  }, [article, content, language]);

  return (
    <article>
      {/* Cinematic title — full bleed */}
      <section className="relative overflow-hidden" style={{ height: '100vh', minHeight: 720, borderBottom: '1px solid var(--line-soft)' }}>
        <div className="absolute inset-0">
          {article.mediaUrl ? (
            <img src={article.mediaUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="ph w-full h-full" data-tone={tone} data-label={placeLabel(article)} style={{ border: 0 }} />
          )}
          <div className="absolute inset-0" style={{ background: 'var(--scrim-cinematic)' }} />
        </div>

        <div className="ed-container relative h-full flex flex-col justify-between" style={{ paddingTop: 32, paddingBottom: 56 }}>
          <button
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/'))}
            className="flex items-center gap-2 self-start cursor-pointer transition-colors"
            style={{ color: 'var(--parchment)', background: 'transparent', border: 0, fontFamily: 'var(--ui)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {language === 'en' ? 'Back' : 'Înapoi'}
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-3.5 mb-7">
              <span className="pill" style={{ color: 'var(--gold)', borderColor: 'var(--gold)', background: 'var(--overlay-dark)' }}>
                {language === 'en' ? 'Photo essay' : 'Eseu foto'}
              </span>
              {category && (
                <span className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--parchment)' }}>
                  {getLocalized(category, 'name', language)} {article.location && `· ${article.location}`}
                </span>
              )}
            </div>
            <h1
              className="font-display italic font-medium m-0"
              style={{
                fontSize: 'clamp(72px, 11vw, 180px)',
                lineHeight: 0.9,
                letterSpacing: '-0.02em',
                color: 'var(--parchment)',
                textWrap: 'balance' as React.CSSProperties['textWrap'],
                maxWidth: 1100,
              }}
            >
              {title}
            </h1>
            <div className="flex flex-wrap gap-8 mt-10 items-center font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--parchment)' }}>
              <span>{scenes.length} {language === 'en' ? 'frames' : 'cadre'}</span>
              <span>{readMinutes(article, language)} {language === 'en' ? 'min read' : 'min citire'}</span>
              {views !== undefined && views > 0 && <span>{views.toLocaleString()} {language === 'en' ? 'views' : 'vizualizări'}</span>}
              <span>{language === 'en' ? 'Scroll to begin ↓' : 'Derulează pentru a începe ↓'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Dek + byline */}
      <section style={{ padding: '80px 0 60px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="max-w-[920px] mx-auto grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-14 items-start">
            <p
              className="m-0 font-display italic"
              style={{
                fontSize: 24,
                lineHeight: 1.5,
                color: 'var(--text)',
                textWrap: 'pretty' as React.CSSProperties['textWrap'],
              }}
            >
              {dek.length > 320 ? dek.slice(0, 320) + '…' : dek}
            </p>
            <div className="flex flex-col gap-5">
              <div>
                <div className="eyebrow">{language === 'en' ? 'Photographs' : 'Fotografii'}</div>
                <div className="font-display italic mt-1" style={{ fontSize: 20 }}>The RoStory</div>
              </div>
              <div className="rule" />
              <div className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                {formatDate(article.createdAt, language)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scenes */}
      {scenes.map((sc, i) => (
        <PhotoScene key={i} scene={sc} idx={i + 1} total={scenes.length} layout={i % 3} />
      ))}

      {/* Closing */}
      <section style={{ padding: '120px 0', textAlign: 'center' }}>
        <div className="ed-container">
          <div className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.22em', color: 'var(--text-mute)' }}>
            {language === 'en' ? 'End of essay' : 'Sfârșitul eseului'} · {placeLabel(article) || 'THE ROSTORY'}
          </div>
        </div>
      </section>
    </article>
  );
};

const PhotoScene: React.FC<{ scene: { url: string; caption: string; tone: string; aspect: string }; idx: number; total: number; layout: number }> = ({ scene, idx, total, layout }) => {
  const indexLabel = `${String(idx).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  const text = scene.caption;

  const Image = (
    <div className="ph relative" data-tone={scene.tone as 'warm'} data-label="" style={{ aspectRatio: scene.aspect }}>
      <img src={scene.url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
    </div>
  );

  if (layout === 0) {
    return (
      <section style={{ padding: '80px 0', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="relative" style={{ marginInline: 'var(--gutter)' }}>{Image}</div>
        <div className="ed-container mt-7">
          <div className="flex flex-wrap justify-between items-start gap-12">
            {text && (
              <p
                className="font-display italic m-0 max-w-[720px] line-clamp-5"
                title={text}
                style={{ fontSize: 'clamp(28px, 3vw, 38px)', lineHeight: 1.25, color: 'var(--parchment)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
              >
                {text}
              </p>
            )}
            <span className="font-ui text-[11px] whitespace-nowrap" style={{ letterSpacing: '0.22em', color: 'var(--gold)' }}>{indexLabel}</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: '80px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div className="ed-container">
        <div className={cn('grid items-center gap-14 grid-cols-1', layout === 1 ? 'md:grid-cols-[1.4fr_1fr]' : 'md:grid-cols-[1fr_1.4fr]')}>
          {layout === 1 ? Image : null}
          <div>
            <span className="font-ui text-[11px] block mb-5" style={{ letterSpacing: '0.22em', color: 'var(--gold)' }}>{indexLabel}</span>
            {text && (
              <p
                className="font-display italic m-0 line-clamp-8"
                title={text}
                style={{ fontSize: 'clamp(26px, 2.6vw, 34px)', lineHeight: 1.3, color: 'var(--parchment)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
              >
                {text}
              </p>
            )}
          </div>
          {layout === 2 ? Image : null}
        </div>
      </div>
    </section>
  );
};

// ── Variant C: VIDEO FILM ────────────────────────────────────────────
const VideoFilm: React.FC<{ article: Article; category?: Category; views?: number }> = ({ article, category, views }) => {
  const { language } = useLanguage();
  const title = getLocalized(article, 'title', language);
  const content = getLocalized(article, 'content', language);
  const dek = content.split(/\n+/).filter(Boolean)[0] || '';
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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
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

  return (
    <article>
      <ArticleMasthead article={article} category={category} kindLabel={language === 'en' ? 'Film' : 'Film'} />

      {/* Title + player */}
      <section style={{ padding: '40px 0' }}>
        <div className="ed-container">
          <div className="max-w-[1200px] mx-auto">
            <h1
              className="font-display italic font-medium m-0"
              style={{ fontSize: 'clamp(56px, 8vw, 110px)', lineHeight: 0.95, letterSpacing: '-0.015em', color: 'var(--parchment)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
            >
              {title}
            </h1>

            <div className="video-frame mt-8" style={{ aspectRatio: '16/9' }}>
              {article.mediaUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={article.mediaUrl}
                    poster={article.posterUrl}
                    className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                    playsInline
                    onClick={togglePlay}
                  />
                  {!playing && (
                    <div className="play" onClick={togglePlay}>
                      <div className="play-btn">
                        <Play className="w-7 h-7" style={{ color: 'var(--gold)' }} fill="currentColor" />
                      </div>
                    </div>
                  )}
                  {/* Player chrome */}
                  <div
                    className="absolute left-0 right-0 bottom-0 px-6 py-5 flex items-center gap-4"
                    style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))' }}
                  >
                    <button
                      onClick={togglePlay}
                      className="w-9 h-9 grid place-items-center cursor-pointer"
                      style={{ background: 'transparent', border: 0, color: 'var(--parchment)' }}
                      aria-label={playing ? 'Pause' : 'Play'}
                    >
                      {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="currentColor" />}
                    </button>
                    <div className="font-ui text-[11px]" style={{ letterSpacing: '0.18em', color: 'var(--parchment)' }}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                    <div
                      ref={progressBarRef}
                      className="flex-1 h-1.5 rounded-full relative cursor-pointer group"
                      style={{ background: 'rgba(255,255,255,0.2)' }}
                      onClick={handleSeek}
                    >
                      <div className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-100" style={{ width: progressPct + '%', background: 'var(--gold)' }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ left: `calc(${progressPct}% - 6px)`, background: 'var(--gold)', boxShadow: '0 0 4px rgba(0,0,0,0.4)' }}
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
                        onClick={handleVolumeButtonClick}
                        className="w-9 h-9 grid place-items-center cursor-pointer"
                        style={{ background: 'transparent', border: 0, color: 'var(--parchment)' }}
                        aria-label={isTouch ? 'Volume' : (muted ? 'Unmute' : 'Mute')}
                        aria-expanded={isTouch ? showVolume : undefined}
                      >
                        {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      {showVolume && (
                        <div
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-3 rounded-lg flex flex-col items-center gap-2"
                          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={muted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="volume-slider"
                            style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 4, height: 80, accentColor: 'var(--gold)', cursor: 'pointer' }}
                            aria-label="Volume"
                          />
                          {isTouch && (
                            <button
                              onClick={toggleMute}
                              className="grid place-items-center cursor-pointer"
                              style={{ background: 'transparent', border: 0, color: 'var(--parchment)', padding: 2 }}
                              aria-label={muted ? 'Unmute' : 'Mute'}
                            >
                              {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={fullscreen}
                      className="w-9 h-9 grid place-items-center cursor-pointer"
                      style={{ background: 'transparent', border: 0, color: 'var(--parchment)' }}
                      aria-label="Fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="ph w-full h-full" data-tone={toneFor(article.id)} data-label={placeLabel(article)} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Synopsis + transcript */}
      <section style={{ padding: '60px 0 80px' }}>
        <div className="ed-container">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-20 items-start">
            <div>
              <div className="eyebrow mb-4">{language === 'en' ? 'Synopsis' : 'Sinopsis'}</div>
              <p
                className="font-display italic m-0"
                style={{ fontSize: 28, lineHeight: 1.35, color: 'var(--parchment)', textWrap: 'pretty' as React.CSSProperties['textWrap'] }}
              >
                {dek}
              </p>

              {content.length > dek.length && (
                <div className="mt-12 px-8 py-8" style={{ borderLeft: '2px solid var(--gold)', background: 'var(--overlay-ticker)' }}>
                  <div className="eyebrow mb-3">{language === 'en' ? 'From the description' : 'Din descriere'}</div>
                  <p className="font-serif-ed m-0" style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text)' }}>
                    {content.slice(dek.length, dek.length + 600).trim()}
                    {content.length > dek.length + 600 ? '…' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Captions list — derived from mediaCaptions if present */}
            <aside>
              <div className="eyebrow mb-4">{language === 'en' ? 'Field log' : 'Jurnal de teren'}</div>
              <div style={{ border: '1px solid var(--line)', background: 'var(--overlay-panel-soft)' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="font-display italic" style={{ fontSize: 19, color: 'var(--parchment)' }}>
                    {article.location || (language === 'en' ? 'On location' : 'În locație')}
                  </div>
                  <div className="font-ui text-[11px] uppercase mt-1" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                    {formatDate(article.createdAt, language)}
                  </div>
                </div>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="font-display italic" style={{ fontSize: 19, color: 'var(--parchment)' }}>
                    {readMinutes(article, language)} {language === 'en' ? 'min film' : 'min film'}
                  </div>
                </div>
                {views !== undefined && views > 0 && (
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <div className="font-display italic" style={{ fontSize: 19, color: 'var(--parchment)' }}>
                      {views.toLocaleString()} {language === 'en' ? 'views' : 'vizualizări'}
                    </div>
                  </div>
                )}
                <div className="px-6 py-4">
                  <div className="font-display italic" style={{ fontSize: 19, color: 'var(--parchment)' }}>
                    {category ? getLocalized(category, 'name', language) : (language === 'en' ? 'Story' : 'Poveste')}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </article>
  );
};

export default EditorialArticle;
