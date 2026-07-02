import React from "react";
import { Link } from "react-router-dom";
import { Heart, Play, Images } from "lucide-react";
import { Article, Category, getLocalized } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  toneFor,
  readMinutes,
  placeLabel,
  articleExcerpt,
  articleCoverUrl,
  getArticleKindLabel,
} from "@/lib/article-utils";

export interface StoryCardProps {
  article: Article;
  category?: Category;
  language: 'en' | 'ro';
  /** Cover aspect + title size. Home's grid uses md; its featured rail uses lg/wide. */
  size?: 'lg' | 'wide' | 'md';
  /** Router state for the article link (e.g. { from: '/' } for back-navigation). */
  linkState?: Record<string, unknown>;
  isArticleFavorited: boolean;
  onFavoriteToggle: (e: React.MouseEvent, articleId: string) => void;
}

/**
 * Shared article card for listing surfaces (Home grid/featured rail,
 * CategoryDetail grid). The favorite button is a *sibling* of the Link,
 * absolutely positioned over the cover — a <button> nested inside an <a>
 * is invalid HTML and confuses assistive tech.
 */
export const StoryCard = React.memo<StoryCardProps>(({ article, category, language, size = 'md', linkState, isArticleFavorited, onFavoriteToggle }) => {
  const dims = size === 'lg'
    ? { aspect: '4/5', titleSize: 38 }
    : size === 'wide'
      ? { aspect: '16/10', titleSize: 28 }
      : { aspect: '3/4', titleSize: 22 };
  const tone = toneFor(article.id);
  const cover = articleCoverUrl(article);

  return (
    <div className="relative group">
      <Link
        to={`/article/${article.id}`}
        state={linkState}
        className="block cursor-pointer"
        style={{ color: 'inherit', textDecoration: 'none' }}
      >
      <div
        className="ph relative overflow-hidden"
        data-tone={tone}
        data-label={placeLabel(article) || (category ? getLocalized(category, 'name', language).toUpperCase() : '')}
        style={{ aspectRatio: dims.aspect }}
      >
        {cover && (
          <img
            src={cover}
            alt={getLocalized(article, 'title', language)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            loading="lazy"
            style={{ filter: 'grayscale(0.15) contrast(1.05)' }}
          />
        )}
        {cover && (
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
            FILM
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
      </div>

      <div className="pt-5">
        <div className="flex items-center gap-3.5 font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
          {category && <span style={{ color: 'var(--gold)' }}>{getLocalized(category, 'name', language)}</span>}
          {category && <span>·</span>}
          <span>{getArticleKindLabel(article, language)}</span>
          {/* readMinutes is word-count based — meaningless for films, where
              the content is just a synopsis. */}
          {article.type !== 'video' && (
            <>
              <span>·</span>
              <span>{readMinutes(article, language)} {language === 'en' ? 'min read' : 'min citire'}</span>
            </>
          )}
        </div>
        <h3
          className="font-display italic font-medium m-0 mt-3 mb-2"
          style={{ fontSize: dims.titleSize, lineHeight: 1.1, color: 'var(--text)', textWrap: 'balance' as React.CSSProperties['textWrap'] }}
        >
          {getLocalized(article, 'title', language)}
        </h3>
        <p className="text-ink-dim m-0" style={{ fontSize: 16 }}>
          {articleExcerpt(article, language, 140)}
        </p>
      </div>
      </Link>
      <button
        onClick={(e) => onFavoriteToggle(e, article.id)}
        aria-label={
          isArticleFavorited
            ? (language === 'en' ? 'Remove from favorites' : 'Elimină de la favorite')
            : (language === 'en' ? 'Add to favorites' : 'Adaugă la favorite')
        }
        aria-pressed={isArticleFavorited}
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
  );
});
StoryCard.displayName = 'StoryCard';
