import React from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Article, Category, getLocalized } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toneFor, articleExcerpt, articleCoverUrl, countLabel, joinMeta } from "@/lib/article-utils";
import { kindWord, placeAndTime, readPhrase } from "@/lib/story-facts";
import { storageImage } from "@/lib/image-url";

export interface StoryCardProps {
  article: Article;
  category?: Category;
  language: 'en' | 'ro';
  /**
   * md: the archive card (lg: the same with a larger title). row: a line of
   * a contents list (shelf pages in list view) — pass `index`. compact: a
   * small thumbnail line (Home's "Just added").
   */
  size?: 'lg' | 'md' | 'row' | 'compact';
  /** Position in a contents list, shown as 01, 02… (row only). */
  index?: number;
  /** Router state for the article link (e.g. { from: '/' } for back-navigation). */
  linkState?: Record<string, unknown>;
  isArticleFavorited?: boolean;
  onFavoriteToggle?: (e: React.MouseEvent, articleId: string) => void;
}

/**
 * A story as the redesign introduces it: an arched picture with its kind,
 * then where and when, the title, and the story's own first line.
 *
 * The favourite button is a *sibling* of the Link, absolutely positioned
 * over the cover — a <button> nested inside an <a> is invalid HTML and
 * confuses assistive tech.
 */
export const StoryCard = React.memo<StoryCardProps>(({ article, category, language, size = 'md', index = 0, linkState, isArticleFavorited, onFavoriteToggle }) => {
  const title = getLocalized(article, 'title', language);
  const where = placeAndTime(article, language);
  const categoryName = category ? getLocalized(category, 'name', language) : '';
  const frames = article.mediaUrls?.length || 0;
  // A visual essay's card has no captions to time, so it counts frames.
  const length = article.type === 'carousel' && frames ? countLabel(frames, 'frame', language) : readPhrase(article, language);
  const kind = kindWord(article, language);
  const to = `/article/${article.id}`;

  const cover = (surface: 'card' | 'thumb', className: string, style?: React.CSSProperties) => {
    const src = storageImage(articleCoverUrl(article), surface);
    return (
      <span className={className} style={style}>
        {src ? (
          <img src={src} alt="" loading="lazy" className="rs-card-img" />
        ) : (
          <span className="ph absolute inset-0" data-tone={toneFor(article.id)} style={{ border: 0 }} />
        )}
      </span>
    );
  };

  const heartLabel = isArticleFavorited
    ? (language === 'en' ? `Remove “${title}” from your shelf` : `Scoate „${title}” de pe raftul tău`)
    : (language === 'en' ? `Save “${title}” to your shelf` : `Păstrează „${title}” pe raftul tău`);

  if (size === 'compact') {
    return (
      <Link to={to} state={linkState} className="rs-card rs-card-compact">
        {cover('thumb', 'rs-card-thumb', { width: 84, height: 100 })}
        <span className="flex flex-col gap-1 min-w-0">
          {where && <span className="rs-card-where">{where}</span>}
          <span className="rs-card-title" style={{ fontSize: 23, margin: 0, lineHeight: 1.1 }}>{title}</span>
          <span className="rs-card-meta">{joinMeta([kind, length])}</span>
        </span>
      </Link>
    );
  }

  if (size === 'row') {
    return (
      <article className="flex items-center gap-3" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <Link
          to={to}
          state={linkState}
          className="rs-card flex-1 min-w-0 grid items-center py-[22px] gap-[clamp(14px,2vw,24px)] grid-cols-[28px_72px_minmax(0,1fr)] min-[760px]:grid-cols-[36px_96px_minmax(0,1fr)_auto]"
        >
          <span className="rs-card-num">{String(index + 1).padStart(2, '0')}</span>
          {cover('thumb', 'rs-card-thumb', { aspectRatio: '5 / 6' })}
          <span className="flex flex-col gap-1 min-w-0">
            {where && <span className="rs-card-where">{where}</span>}
            <span className="rs-card-title" style={{ fontSize: 'clamp(22px, 2.2vw, 28px)', margin: 0, lineHeight: 1.1 }}>{title}</span>
            <span className="rs-card-first hidden min-[760px]:block" style={{ fontSize: 15.5, lineHeight: 1.55 }}>{articleExcerpt(article, language, 150)}</span>
          </span>
          <span className="rs-card-meta hidden min-[760px]:block text-right whitespace-nowrap">{kind}<br />{length}</span>
        </Link>
        {onFavoriteToggle && (
          <button
            type="button"
            onClick={(e) => onFavoriteToggle(e, article.id)}
            aria-label={heartLabel}
            aria-pressed={!!isArticleFavorited}
            className="sb-icon-btn"
            style={{ width: 40, height: 40, color: isArticleFavorited ? 'var(--gold)' : undefined }}
          >
            <Heart className={cn('w-[15px] h-[15px]', isArticleFavorited && 'fill-current')} strokeWidth={1.75} />
          </button>
        )}
      </article>
    );
  }

  const first = articleExcerpt(article, language, 150);
  return (
    <article className="relative">
      <Link to={to} state={linkState} className="rs-card block">
        <span className="rs-card-frame">
          {cover('card', 'absolute inset-0 block')}
          <span className="sb-scrim" style={{ opacity: 0.75 }} />
          <span className="rs-card-kind">{kind}</span>
        </span>
        {where && <span className="rs-card-where block" style={{ marginTop: 18 }}>{where}</span>}
        <span className="rs-card-title block" style={size === 'lg' ? { fontSize: 'clamp(30px, 3vw, 40px)' } : undefined}>{title}</span>
        {first && (
          <span className="rs-card-first block">
            <span aria-hidden="true" className="rs-card-quote">“</span>{first}
          </span>
        )}
        <span className="rs-card-meta block" style={{ marginTop: 14 }}>{joinMeta([categoryName, length])}</span>
      </Link>
      {onFavoriteToggle && (
        <button
          type="button"
          onClick={(e) => onFavoriteToggle(e, article.id)}
          aria-label={heartLabel}
          aria-pressed={!!isArticleFavorited}
          className={cn('rs-card-heart', isArticleFavorited && 'is-on')}
        >
          <Heart className={cn('w-4 h-4', isArticleFavorited && 'fill-current')} strokeWidth={1.75} />
        </button>
      )}
    </article>
  );
});
StoryCard.displayName = 'StoryCard';
