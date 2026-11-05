import React from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Article, Category, getLocalized } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toneFor, articleExcerpt, articleCoverUrl, countLabel, joinMeta } from "@/lib/article-utils";
import { kindPhrase, placeAndTime, readPhrase, toRoman } from "@/lib/story-facts";
import { storageImage } from "@/lib/image-url";

export interface StoryCardProps {
  article: Article;
  category?: Category;
  language: 'en' | 'ro';
  /**
   * md / lg: the archive card. wide: cover beside the text (Home's featured
   * rail). row: a line of a table of contents (category pages) — pass `index`.
   */
  size?: 'lg' | 'wide' | 'md' | 'row';
  /** Position in a contents list, shown as a Roman numeral (row only). */
  index?: number;
  /** Router state for the article link (e.g. { from: '/' } for back-navigation). */
  linkState?: Record<string, unknown>;
  isArticleFavorited?: boolean;
  onFavoriteToggle?: (e: React.MouseEvent, articleId: string) => void;
}

/**
 * A story as the storybook introduces it: where and when first, then the
 * title, then the story's own first line.
 *
 * The favourite button is a *sibling* of the Link, absolutely positioned
 * over the cover — a <button> nested inside an <a> is invalid HTML and
 * confuses assistive tech.
 */
export const StoryCard = React.memo<StoryCardProps>(({ article, category, language, size = 'md', index = 0, linkState, isArticleFavorited, onFavoriteToggle }) => {
  const title = getLocalized(article, 'title', language);
  const cover = storageImage(articleCoverUrl(article), size === 'row' ? 'thumb' : 'card');
  const where = placeAndTime(article, language);
  const categoryName = category ? getLocalized(category, 'name', language) : '';
  const frames = article.mediaUrls?.length || 0;
  // A visual essay's card has no captions to time, so it counts frames.
  const length = article.type === 'carousel' && frames ? countLabel(frames, 'frame', language) : readPhrase(article, language);
  const first = articleExcerpt(article, language, 150);
  const kind = kindPhrase(article, language);

  const media = (className: string, style?: React.CSSProperties) => (
    <div className={cn('sb-card-media', className)} style={style}>
      {cover ? (
        <img src={cover} alt="" loading="lazy" />
      ) : (
        <div className="ph absolute inset-0" data-tone={toneFor(article.id)} style={{ border: 0 }} />
      )}
      {size !== 'row' && <div className="sb-scrim" style={{ opacity: 0.7 }} />}
      {size !== 'row' && <span className="sb-tag" style={{ position: 'absolute', left: 14, bottom: 14 }}>{kind}</span>}
    </div>
  );

  const heartLabel = isArticleFavorited
    ? (language === 'en' ? `Remove “${title}” from your shelf` : `Scoate „${title}” de pe raftul tău`)
    : (language === 'en' ? `Save “${title}” to your shelf` : `Păstrează „${title}” pe raftul tău`);

  if (size === 'row') {
    return (
      <article className="flex items-center gap-3" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <Link
          to={`/article/${article.id}`}
          state={linkState}
          className="sb-card flex-1 min-w-0 grid items-center gap-4 sm:gap-6 py-6 grid-cols-[40px_76px_minmax(0,1fr)] sm:grid-cols-[56px_112px_minmax(0,1fr)_auto]"
        >
          <span className="sb-numeral text-center" style={{ fontSize: 28 }}>{toRoman(index + 1)}</span>
          {media('sb-frame sb-arch-thumb', { aspectRatio: '1' })}
          <span className="flex flex-col gap-1.5 min-w-0">
            {where && <span className="sb-kicker-sm">{where}</span>}
            <span className="sb-card-title" style={{ margin: 0 }}>{title}</span>
            {first && <span className="sb-card-first hidden sm:block">{first}</span>}
          </span>
          <span className="sb-meta hidden sm:block text-right whitespace-nowrap">{kind}<br />{article.type === 'carousel' ? '' : length}</span>
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
            <Heart className={cn('w-4 h-4', isArticleFavorited && 'fill-current')} />
          </button>
        )}
      </article>
    );
  }

  const heart = onFavoriteToggle && (
    <button
      type="button"
      onClick={(e) => onFavoriteToggle(e, article.id)}
      aria-label={heartLabel}
      aria-pressed={!!isArticleFavorited}
      className="sb-heart"
    >
      <Heart className={cn('w-4 h-4', isArticleFavorited && 'fill-current')} />
    </button>
  );

  if (size === 'wide') {
    return (
      <article className="relative">
        <Link to={`/article/${article.id}`} state={linkState} className="sb-card grid grid-cols-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 items-center">
          {media('sb-frame', { aspectRatio: '4 / 5' })}
          <span className="flex flex-col gap-2">
            {where && <span className="sb-kicker-sm">{where}</span>}
            <span className="sb-card-title" style={{ fontSize: 30, margin: 0 }}>{title}</span>
            {first && <span className="sb-card-first">{first}</span>}
            <span className="sb-meta" style={{ marginTop: 6 }}>{joinMeta([categoryName, length])}</span>
          </span>
        </Link>
        <div className="absolute top-0 left-0 sm:w-[45%] w-full">{heart}</div>
      </article>
    );
  }

  return (
    <article className="relative">
      <Link to={`/article/${article.id}`} state={linkState} className="sb-card block">
        {media('sb-frame', { aspectRatio: size === 'lg' ? '4 / 5' : '4 / 5' })}
        {where && <span className="sb-kicker-sm block" style={{ marginTop: 18 }}>{where}</span>}
        <span className="sb-card-title block" style={!where ? { marginTop: 18 } : undefined}>{title}</span>
        {first && <span className="sb-card-first block">{first}</span>}
        <span className="sb-meta block" style={{ marginTop: 14 }}>{joinMeta([categoryName, length])}</span>
      </Link>
      {heart}
    </article>
  );
});
StoryCard.displayName = 'StoryCard';
