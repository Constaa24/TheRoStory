import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { getLocalized, Article, Category, CHAPTER_DELIMITER, Comment } from "@/lib/supabase";
import { toggleFavorite, isArticleFavorited, fetchComments, postComment, deleteComment, updateComment, fetchPublicContent, fetchArticleViews, incrementView } from "@/lib/supabase";
import { isAbortError } from "@/lib/utils";
import { useReadingProgress, getReadingTimeMinutes } from "@/hooks/use-reading-progress";

/** Convert 1..N integer to a Roman numeral, used for chapter labels. */
const toRoman = (n: number): string => {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  let remaining = n;
  for (const [val, sym] of map) {
    while (remaining >= val) {
      result += sym;
      remaining -= val;
    }
  }
  return result || "I";
};

// Use the shared cache exposed by `fetchPublicContent` so admin edits
// (which call `invalidatePublicContentCache`) immediately invalidate
// related-article lookups here too. Previously we had a separate
// module-level cache that could go stale relative to the home page.
const getCachedPublicContent = () => fetchPublicContent();
import { motion } from "framer-motion";
import { X, BookOpen, Heart, Video, Eye, MessageSquare, Send, MapPin, Share2, Facebook, Link as LinkIcon, Images, Pencil, Trash2, Check, Play, LayoutGrid, Maximize2 } from "lucide-react";
import { ImageLightbox } from "@/components/organisms/ImageLightbox";

/** Format seconds as M:SS — used for video duration display. */
const formatDuration = (seconds: number | null): string | null => {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@/components/ui/carousel";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

interface ParchmentArticleProps {
  article: Article;
  views?: number;
  incrementViewOnOpen?: boolean;
  onClose: () => void;
}

export const ParchmentArticle: React.FC<ParchmentArticleProps> = ({
  article,
  views: initialViews = 0,
  incrementViewOnOpen = true,
  onClose
}) => {
  const { language, t } = useLanguage();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(0);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [commentsLoadError, setCommentsLoadError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const COMMENT_COOLDOWN_KEY = `rostory_last_comment_${article.id}`;
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isDeletingComment, setIsDeletingComment] = useState<string | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [views, setViews] = useState(initialViews);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  // Video-specific UI state (used only by video stories)
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  // Carousel-specific UI state (used only by carousel stories)
  const [carouselSlide, setCarouselSlide] = useState(0);
  const [showMosaic, setShowMosaic] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);
  const currentArticleIdRef = useRef(article.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Array<HTMLDivElement | null>>([]);
  const commentsAnchorRef = useRef<HTMLDivElement>(null);
  const readingProgress = useReadingProgress(scrollRef);

  const articleCategory = useMemo(
    () => allCategories.find(c => c.id === article.categoryId) || null,
    [allCategories, article.categoryId]
  );

  const fullBodyText = useMemo(
    () => getLocalized(article, "content", language),
    [article, language]
  );

  const readingMinutes = useMemo(
    () => getReadingTimeMinutes(fullBodyText),
    [fullBodyText]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Close the article modal on Escape key — standard modal expectation.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    currentArticleIdRef.current = article.id;
  }, [article.id]);

  useEffect(() => {
    let cancelled = false;

    const syncViews = async () => {
      if (initialViews > 0) {
        setViews(initialViews);
      }

      if (incrementViewOnOpen) {
        // Optimistically reflect the open-count increment, then sync with DB.
        if (initialViews > 0 && !cancelled) {
          setViews(initialViews + 1);
        }
        await incrementView(article.id);
      }

      // When parent doesn't provide views, or after incrementing, fetch the latest count once.
      if (initialViews === 0 || incrementViewOnOpen) {
        const latest = await fetchArticleViews(article.id);
        if (!cancelled) {
          if (latest > 0 || initialViews === 0) {
            setViews(latest);
          } else if (incrementViewOnOpen && initialViews > 0) {
            setViews(initialViews + 1);
          } else {
            setViews(initialViews);
          }
        }
      }
    };

    void syncViews();
    return () => { cancelled = true; };
  }, [article.id, initialViews, incrementViewOnOpen]);

  // Scroll to top + reset per-article UI state when article changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
    setVideoStarted(false);
    setVideoDuration(null);
    setCarouselSlide(0);
    setShowMosaic(false);
    setLightboxIndex(null);
  }, [article.id]);

  // Track active chapter (for the table of contents) via IntersectionObserver
  useEffect(() => {
    if (!scrollRef.current || chapterRefs.current.length === 0) return;
    const root = scrollRef.current;
    const observer = new IntersectionObserver(
      entries => {
        // Find the topmost intersecting chapter
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const idx = Number(visible.target.getAttribute('data-chapter-index'));
          if (!Number.isNaN(idx)) setActiveChapterIndex(idx);
        }
      },
      { root, rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );
    chapterRefs.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [article.id, language]);

  const scrollToChapter = (index: number) => {
    const el = chapterRefs.current[index];
    if (el && scrollRef.current) {
      const top = el.offsetTop - 32;
      scrollRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const scrollToComments = () => {
    if (commentsAnchorRef.current && scrollRef.current) {
      const top = commentsAnchorRef.current.offsetTop - 32;
      scrollRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setCommentsLoadError(null);

      // Run all three independent fetches in parallel
      const [favResult, commentsResult, relatedResult] = await Promise.allSettled([
        user ? isArticleFavorited(user.id, article.id) : Promise.resolve(false),
        fetchComments(article.id, 0),
        getCachedPublicContent(),
      ]);

      if (cancelled) return;

      // Handle favorites
      if (favResult.status === 'fulfilled') {
        setIsFavorited(favResult.value);
      } else {
        setIsFavorited(false);
      }

      // Handle comments
      if (commentsResult.status === 'fulfilled') {
        setComments(commentsResult.value.comments);
        setCommentsTotal(commentsResult.value.total);
        setCommentsPage(0);
      } else if (!isAbortError(commentsResult.reason)) {
        console.error("Error loading comments:", commentsResult.reason);
        setCommentsLoadError(language === 'en' ? "Failed to load comments. Please try again." : "Comentariile nu au putut fi încărcate. Încearcă din nou.");
      }

      // Handle related articles + capture categories for the eyebrow label
      if (relatedResult.status === 'fulfilled') {
        const data = relatedResult.value;
        setAllCategories(data.categories || []);
        const filtered = data.articles
          .filter(a => a.id !== article.id)
          .filter(a => a.categoryId === article.categoryId)
          .slice(0, 3);
        if (filtered.length < 3) {
          const pool = data.articles
            .filter(a => a.id !== article.id && a.categoryId !== article.categoryId);
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          const others = pool.slice(0, 3 - filtered.length);
          setRelatedArticles([...filtered, ...others]);
        } else {
          setRelatedArticles(filtered);
        }
      } else if (!isAbortError(relatedResult.reason)) {
        console.error("Error loading related stories:", relatedResult.reason);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [user, article.id, article.categoryId, language]);

  const handleShare = (platform: 'facebook' | 'x' | 'copy') => {
    const url = `${window.location.origin}/article/${article.id}`;
    const text = `${getLocalized(article, "title", language)} - The RoStory`;

    if (platform === 'copy') {
      navigator.clipboard.writeText(url).then(
        () => toast.success(t("share.copied")),
        () => toast.error(language === 'en' ? "Failed to copy link" : "Nu s-a putut copia link-ul")
      );
      return;
    }

    let shareUrl = "";
    if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    } else if (platform === 'x') {
      shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    }

    if (shareUrl) {
      const popup = window.open(shareUrl, '_blank', 'width=600,height=400,noopener,noreferrer');
      if (!popup) {
        // Popup was blocked — fall back to navigating in a new tab
        window.open(shareUrl, '_blank');
      }
    }
  };

  const loadComments = async (targetArticleId: string = article.id): Promise<boolean> => {
    try {
      const data = await fetchComments(targetArticleId, 0);
      if (!mountedRef.current || currentArticleIdRef.current !== targetArticleId) return false;
      setComments(data.comments);
      setCommentsTotal(data.total);
      setCommentsPage(0);
      setCommentsLoadError(null);
      return true;
    } catch (error) {
      if (!mountedRef.current || currentArticleIdRef.current !== targetArticleId) return false;
      if (!isAbortError(error)) {
        console.error("Error refreshing comments:", error);
        setCommentsLoadError(language === 'en' ? "Failed to refresh comments." : "Comentariile nu au putut fi reîmprospătate.");
      }
      return false;
    }
  };

  const loadMoreComments = async () => {
    if (isLoadingMoreComments || comments.length >= commentsTotal) return;
    setIsLoadingMoreComments(true);
    try {
      const nextPage = commentsPage + 1;
      const data = await fetchComments(article.id, nextPage);
      if (!mountedRef.current || currentArticleIdRef.current !== article.id) return;
      setComments(prev => [...prev, ...data.comments]);
      setCommentsTotal(data.total);
      setCommentsPage(nextPage);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading more comments:", error);
        toast.error(language === 'en' ? "Failed to load more comments" : "Nu s-au putut încărca mai multe comentarii");
      }
    } finally {
      if (mountedRef.current) setIsLoadingMoreComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!user) {
      toast.error(language === 'en' ? "Please log in to comment" : "Vă rugăm să vă autentificați pentru a comenta");
      login();
      return;
    }

    if (!newComment.trim()) return;

    if (newComment.trim().length > 1000) {
      toast.error(language === 'en' ? "Comment must be under 1000 characters" : "Comentariul trebuie să aibă sub 1000 de caractere");
      return;
    }

    const now = Date.now();
    const cooldownMs = 10_000;
    const lastCommentTime = parseInt(localStorage.getItem(COMMENT_COOLDOWN_KEY) || '0', 10);
    if (now - lastCommentTime < cooldownMs) {
      const secsLeft = Math.ceil((cooldownMs - (now - lastCommentTime)) / 1000);
      toast.error(language === 'en' ? `Please wait ${secsLeft}s before posting again` : `Așteaptă ${secsLeft}s înainte de a posta din nou`);
      return;
    }

    setIsPosting(true);
    try {
      const success = await postComment({
        articleId: article.id,
        userId: user.id,
        userDisplayName: user.displayName || user.email?.split('@')[0],
        content: newComment.trim()
      });

      if (success) {
        localStorage.setItem(COMMENT_COOLDOWN_KEY, String(Date.now()));
        setNewComment("");
        await loadComments(article.id);
        toast.success(language === 'en' ? "Comment posted" : "Comentariu postat");
      } else {
        toast.error(language === 'en' ? "Failed to post comment" : "Eroare la postarea comentariului");
      }
    } catch {
      toast.error(language === 'en' ? "Failed to post comment" : "Eroare la postarea comentariului");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    setIsDeletingComment(commentId);
    try {
      const success = await deleteComment(commentId, user.id);
      if (success) {
        await loadComments(article.id);
        toast.success(language === 'en' ? "Comment deleted" : "Comentariu șters");
      } else {
        toast.error(language === 'en' ? "Failed to delete comment" : "Eroare la ștergerea comentariului");
      }
    } catch {
      toast.error(language === 'en' ? "Failed to delete comment" : "Eroare la ștergerea comentariului");
    } finally {
      setIsDeletingComment(null);
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!user || !editContent.trim()) return;
    if (editContent.trim().length > 1000) {
      toast.error(language === 'en' ? "Comment must be under 1000 characters" : "Comentariul trebuie să aibă sub 1000 de caractere");
      return;
    }
    setIsPosting(true);
    try {
      const success = await updateComment(commentId, user.id, editContent.trim());
      if (success) {
        setEditingCommentId(null);
        setEditContent("");
        await loadComments(article.id);
        toast.success(language === 'en' ? "Comment updated" : "Comentariu actualizat");
      } else {
        toast.error(language === 'en' ? "Failed to update comment" : "Eroare la actualizarea comentariului");
      }
    } catch {
      toast.error(language === 'en' ? "Failed to update comment" : "Eroare la actualizarea comentariului");
    } finally {
      setIsPosting(false);
    }
  };

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error(language === 'en' ? "Please log in to favorite articles" : "Vă rugăm să vă autentificați pentru a salva articolele favorite");
      login();
      return;
    }

    setIsFavoriting(true);
    try {
      const added = await toggleFavorite(user.id, article.id);
      setIsFavorited(added);
      toast.success(added 
        ? (language === 'en' ? "Added to favorites" : "Adăugat la favorite")
        : (language === 'en' ? "Removed from favorites" : "Eliminat de la favorite")
      );
    } catch {
      toast.error(language === 'en' ? "Failed to update favorites" : "Eroare la actualizarea favoritelor");
    } finally {
      setIsFavoriting(false);
    }
  };

  const isVideo = article.type === 'video';
  const isCarousel = article.type === 'carousel';

  // Chapter list (used for the table-of-contents rail in long text articles)
  const textChapters = useMemo(() => {
    if (article.type !== 'text') return [];
    const content = getLocalized(article, "content", language);
    return content.includes(CHAPTER_DELIMITER)
      ? content.split(CHAPTER_DELIMITER).filter((ch: string) => ch.trim())
      : [content];
  }, [article, language]);

  const showChapterToc = article.type === 'text' && textChapters.length >= 3;

  const renderTextStory = () => {
    const content = getLocalized(article, "content", language);
    const chapters = content.includes(CHAPTER_DELIMITER)
      ? content.split(CHAPTER_DELIMITER).filter((ch: string) => ch.trim())
      : [content];

    // Render a chapter's body. Paragraphs are split on blank lines.
    // A leading "> " on a paragraph promotes it to a pull-quote.
    const renderChapterBody = (chapter: string, isFirst: boolean) => {
      const paragraphs = chapter
        .trim()
        .split(/\n\s*\n/)
        .filter(p => p.trim().length > 0);

      return (
        <div className="space-y-6">
          {paragraphs.map((rawPara, pIdx) => {
            const trimmed = rawPara.trim();
            if (trimmed.startsWith("> ")) {
              return (
                <blockquote key={pIdx} className="pull-quote">
                  {trimmed.slice(2).trim()}
                </blockquote>
              );
            }
            const isOpening = isFirst && pIdx === 0;
            return (
              <p
                key={pIdx}
                className={`font-serif text-lg md:text-xl leading-[1.85] text-secondary-foreground/90 whitespace-pre-wrap ${
                  isOpening ? "drop-cap" : ""
                }`}
              >
                {trimmed}
              </p>
            );
          })}
        </div>
      );
    };

    return (
      <div className="space-y-12">
        {/* Magazine-style header */}
        <header className="text-center space-y-6 max-w-3xl mx-auto">
          {articleCategory && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="article-eyebrow"
            >
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" />
                {getLocalized(articleCategory, "name", language)}
                {' · '}
                {language === 'en' ? "Story" : "Poveste"}
              </span>
            </motion.p>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl md:text-7xl font-serif font-black italic text-secondary-foreground leading-[1.05] tracking-tight"
          >
            {getLocalized(article, "title", language)}
          </motion.h1>

          <div className="chapter-ornament">✦</div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-serif italic text-muted-foreground">
            <span>
              {new Date(article.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'ro-RO', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {readingMinutes} {language === 'en'
                ? `min read`
                : `min de citit`}
            </span>
            {article.location && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-accent">
                  <MapPin className="h-3 w-3" />
                  {article.location}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {views}
            </span>
          </div>
        </header>

        {/* Cinematic hero image */}
        {article.mediaUrl && (
          <motion.figure
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="-mx-8 md:-mx-16 relative group"
          >
            <div className="overflow-hidden relative aspect-[16/9] md:aspect-[21/9] bg-secondary/30">
              <img
                src={article.mediaUrl}
                alt={getLocalized(article, "title", language)}
                className="w-full h-full object-cover grayscale-[0.15] group-hover:grayscale-0 group-hover:scale-[1.02] transition-all duration-1000 ease-out"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
            </div>
            {article.location && (
              <figcaption className="text-center text-xs font-serif italic text-muted-foreground mt-3">
                {article.location}
              </figcaption>
            )}
          </motion.figure>
        )}

        {/* Chapters */}
        <div className="max-w-[680px] mx-auto space-y-16">
          {chapters.map((chapter: string, index: number) => (
            <motion.section
              key={index}
              ref={el => { chapterRefs.current[index] = el; }}
              data-chapter-index={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              {chapters.length > 1 && (
                <div className="text-center mb-8">
                  <div className="chapter-roman">{toRoman(index + 1)}</div>
                  <div className="chapter-ornament">✦</div>
                </div>
              )}
              {renderChapterBody(chapter, index === 0)}
            </motion.section>
          ))}
        </div>
      </div>
    );
  };

  const renderVideoStory = () => {
    const description = getLocalized(article, "content", language);
    const articleDate = new Date(article.createdAt);
    const locale = language === 'en' ? 'en-US' : 'ro-RO';

    return (
      <div className="space-y-12">
        <header className="text-center space-y-6 max-w-3xl mx-auto">
          {articleCategory && (
            <p className="article-eyebrow">
              <span className="inline-flex items-center gap-1.5">
                <Video className="h-3 w-3" />
                {getLocalized(articleCategory, "name", language)}
                {' · '}
                {language === 'en' ? "Video Story" : "Poveste Video"}
              </span>
            </p>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl md:text-7xl font-serif font-black italic text-secondary-foreground leading-[1.05] tracking-tight"
          >
            {getLocalized(article, "title", language)}
          </motion.h1>

          <div className="chapter-ornament">✦</div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-serif italic text-muted-foreground">
            <span>{articleDate.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            {formatDuration(videoDuration) && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatDuration(videoDuration)}</span>
              </>
            )}
            {article.location && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-accent">
                  <MapPin className="h-3 w-3" />
                  {article.location}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {views}
            </span>
          </div>
        </header>

        {/* Cinematic full-bleed video */}
        <motion.figure
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="-mx-8 md:-mx-16 relative group"
        >
          <div className="relative aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden bg-black">
            <video
              ref={videoElRef}
              src={article.mediaUrl || undefined}
              poster={article.posterUrl || undefined}
              controls={videoStarted}
              preload="metadata"
              playsInline
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.duration && Number.isFinite(v.duration)) setVideoDuration(v.duration);
              }}
              onPlay={() => setVideoStarted(true)}
              className="w-full h-full object-cover"
            />
            {/* Custom parchment-styled poster overlay (only before first play) */}
            {!videoStarted && (
              <div
                className="video-poster-overlay group/poster"
                onClick={() => {
                  setVideoStarted(true);
                  videoElRef.current?.play().catch(() => {});
                }}
                role="button"
                aria-label={language === 'en' ? "Play video" : "Redă video"}
              >
                <div className="video-poster-play-button">
                  <Play className="h-8 w-8 fill-current ml-1" />
                </div>
                <p className="video-poster-label">
                  {language === 'en' ? "Watch story" : "Vizionează povestea"}
                  {formatDuration(videoDuration) && (
                    <span className="opacity-80"> · {formatDuration(videoDuration)}</span>
                  )}
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          </div>
          {article.location && (
            <figcaption className="text-center text-xs font-serif italic text-muted-foreground mt-3">
              {article.location}
            </figcaption>
          )}
        </motion.figure>

        {/* Editorial-column description */}
        {description && description.trim() && (
          <div className="max-w-[680px] mx-auto space-y-6">
            <div className="text-center">
              <p className="article-eyebrow">
                {language === 'en' ? "About this story" : "Despre această poveste"}
              </p>
            </div>
            {description
              .trim()
              .split(/\n\s*\n/)
              .filter(p => p.trim().length > 0)
              .map((rawPara, idx) => {
                const trimmed = rawPara.trim();
                if (trimmed.startsWith("> ")) {
                  return (
                    <blockquote key={idx} className="pull-quote">
                      {trimmed.slice(2).trim()}
                    </blockquote>
                  );
                }
                return (
                  <p
                    key={idx}
                    className={`font-serif text-lg md:text-xl leading-[1.85] text-secondary-foreground/90 whitespace-pre-wrap ${
                      idx === 0 ? "drop-cap" : ""
                    }`}
                  >
                    {trimmed}
                  </p>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  const renderCarouselStory = () => {
    const description = getLocalized(article, "content", language);
    const images = article.mediaUrls || [];
    const captions = article.mediaCaptions || [];
    const articleDate = new Date(article.createdAt);
    const locale = language === 'en' ? 'en-US' : 'ro-RO';

    const captionFor = (idx: number): string => {
      const c = captions[idx];
      if (!c) return "";
      return language === 'en' ? (c.en || c.ro || "") : (c.ro || c.en || "");
    };

    const lightboxImages = images.map((url, i) => ({
      url,
      caption: captionFor(i) || undefined,
    }));

    return (
      <div className="space-y-12">
        <header className="text-center space-y-6 max-w-3xl mx-auto">
          {articleCategory && (
            <p className="article-eyebrow">
              <span className="inline-flex items-center gap-1.5">
                <Images className="h-3 w-3" />
                {getLocalized(articleCategory, "name", language)}
                {' · '}
                {language === 'en' ? "Photo Story" : "Poveste Foto"}
              </span>
            </p>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl md:text-7xl font-serif font-black italic text-secondary-foreground leading-[1.05] tracking-tight"
          >
            {getLocalized(article, "title", language)}
          </motion.h1>

          <div className="chapter-ornament">✦</div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-serif italic text-muted-foreground">
            <span>{articleDate.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span aria-hidden="true">·</span>
            <span>{images.length} {language === 'en' ? (images.length === 1 ? "image" : "images") : (images.length === 1 ? "imagine" : "imagini")}</span>
            {article.location && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-accent">
                  <MapPin className="h-3 w-3" />
                  {article.location}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {views}
            </span>
          </div>
        </header>

        {/* View toggle: carousel ↔ mosaic */}
        {images.length > 1 && (
          <div className="flex justify-center -mt-4">
            <div className="inline-flex rounded-full border border-border bg-background/60 p-1">
              <button
                type="button"
                onClick={() => setShowMosaic(false)}
                className={`px-4 py-1.5 rounded-full text-xs font-serif italic transition-colors flex items-center gap-1.5 ${
                  !showMosaic ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={!showMosaic}
              >
                <Images className="h-3.5 w-3.5" />
                {language === 'en' ? "Story" : "Poveste"}
              </button>
              <button
                type="button"
                onClick={() => setShowMosaic(true)}
                className={`px-4 py-1.5 rounded-full text-xs font-serif italic transition-colors flex items-center gap-1.5 ${
                  showMosaic ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={showMosaic}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {language === 'en' ? "View all" : "Vezi tot"}
              </button>
            </div>
          </div>
        )}

        {/* Full-bleed gallery */}
        {showMosaic ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="-mx-8 md:-mx-16"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {images.map((url, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="group relative aspect-[4/5] overflow-hidden bg-secondary/30"
                  aria-label={language === 'en' ? `Open image ${index + 1}` : `Deschide imaginea ${index + 1}`}
                >
                  <img
                    src={url}
                    alt={captionFor(index) || `${getLocalized(article, "title", language)} - ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Maximize2 className="h-6 w-6 text-white drop-shadow-md" />
                  </div>
                  {captionFor(index) && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-[11px] font-serif italic line-clamp-2">
                      {captionFor(index)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.figure
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="-mx-8 md:-mx-16 relative"
          >
            <Carousel
              className="w-full"
              opts={{ loop: false }}
              setApi={(api) => {
                if (!api) return;
                api.on("select", () => setCarouselSlide(api.selectedScrollSnap()));
              }}
            >
              <CarouselContent>
                {images.length === 0 && (
                  <CarouselItem>
                    <div className="relative aspect-[16/9] md:aspect-[21/9] w-full bg-black/5 flex items-center justify-center">
                      <div className="text-center space-y-2 text-muted-foreground">
                        <Images className="h-12 w-12 mx-auto opacity-30" />
                        <p className="font-serif italic">{language === 'en' ? 'No images available' : 'Nicio imagine disponibilă'}</p>
                      </div>
                    </div>
                  </CarouselItem>
                )}
                {images.map((url, index) => (
                  <CarouselItem key={index}>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      className="block w-full relative aspect-[16/9] md:aspect-[21/9] overflow-hidden bg-black group/slide"
                      aria-label={language === 'en' ? "Expand image" : "Mărește imaginea"}
                    >
                      <img
                        src={url}
                        alt={captionFor(index) || `${getLocalized(article, "title", language)} - ${index + 1}`}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/slide:scale-[1.02]"
                        loading={index === 0 ? "eager" : "lazy"}
                        decoding="async"
                      />
                      <div className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover/slide:opacity-100 transition-opacity">
                        <Maximize2 className="h-4 w-4" />
                      </div>
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 && (
                <>
                  <CarouselPrevious className="hidden md:flex left-4 bg-black/40 border-white/20 text-white hover:bg-black/60 hover:text-white" />
                  <CarouselNext className="hidden md:flex right-4 bg-black/40 border-white/20 text-white hover:bg-black/60 hover:text-white" />
                </>
              )}
            </Carousel>

            {/* Caption + index indicator */}
            <div className="text-center pt-4 px-8 md:px-16 space-y-1.5 min-h-[3.5rem]">
              <p className="text-xs font-serif italic text-muted-foreground">
                {carouselSlide + 1} / {images.length}
              </p>
              {captionFor(carouselSlide) && (
                <p className="font-serif italic text-base md:text-lg text-secondary-foreground/85 max-w-2xl mx-auto">
                  {captionFor(carouselSlide)}
                </p>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="px-8 md:px-16 pt-4 overflow-x-auto custom-scrollbar">
                <div className="flex items-center justify-start md:justify-center gap-2 pb-2">
                  {images.map((url, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setCarouselSlide(index)}
                      className={`carousel-thumb ${
                        carouselSlide === index ? "carousel-thumb-active" : "carousel-thumb-inactive"
                      }`}
                      aria-label={language === 'en' ? `Go to image ${index + 1}` : `Mergi la imaginea ${index + 1}`}
                      aria-current={carouselSlide === index ? "true" : undefined}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.figure>
        )}

        {/* Editorial-column description */}
        {description && description.trim() && (
          <div className="max-w-[680px] mx-auto space-y-6">
            <div className="text-center">
              <p className="article-eyebrow">
                {language === 'en' ? "Photographer's note" : "Notă de la fotograf"}
              </p>
            </div>
            {description
              .trim()
              .split(/\n\s*\n/)
              .filter(p => p.trim().length > 0)
              .map((rawPara, idx) => {
                const trimmed = rawPara.trim();
                if (trimmed.startsWith("> ")) {
                  return (
                    <blockquote key={idx} className="pull-quote">
                      {trimmed.slice(2).trim()}
                    </blockquote>
                  );
                }
                return (
                  <p
                    key={idx}
                    className={`font-serif text-lg md:text-xl leading-[1.85] text-secondary-foreground/90 whitespace-pre-wrap ${
                      idx === 0 ? "drop-cap" : ""
                    }`}
                  >
                    {trimmed}
                  </p>
                );
              })}
          </div>
        )}

        {/* Lightbox — full-screen image viewer */}
        <ImageLightbox
          images={lightboxImages}
          startIndex={lightboxIndex ?? 0}
          open={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          language={language}
        />
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-primary/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="parchment-effect burnt-edge w-full max-w-4xl max-h-[90vh] flex flex-col rounded-sm overflow-hidden relative shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Reading progress bar — fills as the reader scrolls */}
          <div
            className="reading-progress-bar"
            style={{ width: `${readingProgress * 100}%` }}
            aria-hidden="true"
          />

          <div className="absolute top-0 left-0 w-full h-2 bg-secondary/50 torn-edge rotate-180 z-20" />
          <div className="absolute bottom-0 left-0 w-full h-2 bg-secondary/50 torn-edge z-20" />

        {/* Compact top header — only shown on mobile/tablet (the desktop
            right-rail covers the same actions, and the magazine eyebrow
            inside the article body covers the category/type label). */}
        <div className="lg:hidden flex items-center justify-between p-6 border-b border-secondary-foreground/10 bg-secondary/20">
          <div className="flex items-center gap-3">
            {article.type === 'video' ? (
              <Video className="h-6 w-6 text-accent" />
            ) : article.type === 'carousel' ? (
              <Images className="h-6 w-6 text-accent" />
            ) : (
              <BookOpen className="h-6 w-6 text-accent" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-serif italic text-accent uppercase tracking-widest">
                {article.type === 'video' ? 'Romanian Video Story' : article.type === 'carousel' ? 'Romanian Photo Story' : 'Romanian Story'}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-tighter">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {views}</span>
                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {commentsTotal}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent" aria-label={t("share.title")}>
                  <Share2 className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[110]">
                <DropdownMenuItem onClick={() => handleShare('copy')} className="flex items-center gap-2 cursor-pointer">
                  <LinkIcon className="h-4 w-4" />
                  {t("share.copyLink")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare('facebook')} className="flex items-center gap-2 cursor-pointer">
                  <Facebook className="h-4 w-4" />
                  {t("share.facebook")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare('x')} className="flex items-center gap-2 cursor-pointer">
                  <svg 
                    viewBox="0 0 24 24" 
                    aria-hidden="true" 
                    className="h-4 w-4 fill-current"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                  </svg>
                  {t("share.twitter")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteToggle}
              disabled={isFavoriting}
              aria-label={isFavorited ? t("article.unfavorite") : t("article.favorite")}
              aria-pressed={isFavorited}
              className={isFavorited ? "text-red-500 hover:text-red-600 bg-red-50/50" : "text-muted-foreground hover:text-red-500 hover:bg-red-50/50"}
            >
              <Heart className={isFavorited ? "h-6 w-6 fill-current" : "h-6 w-6"} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-accent/10" aria-label={t("article.close")}>
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Chapter table of contents — only for text articles with 3+ chapters */}
        {showChapterToc && (
          <nav
            aria-label={language === 'en' ? "Chapters" : "Capitole"}
            className="hidden lg:flex flex-col items-center gap-2 absolute left-3 top-1/2 -translate-y-1/2 z-30 bg-background/80 backdrop-blur-md rounded-full p-2 shadow-lg border border-border"
          >
            <span className="text-[9px] font-sans uppercase tracking-widest text-muted-foreground font-bold py-1">
              {language === 'en' ? "TOC" : "Cap."}
            </span>
            {textChapters.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToChapter(idx)}
                aria-label={language === 'en' ? `Go to chapter ${idx + 1}` : `Mergi la capitolul ${idx + 1}`}
                aria-current={activeChapterIndex === idx ? "true" : undefined}
                className={`h-7 w-7 flex items-center justify-center rounded-full font-serif italic text-[11px] transition-colors ${
                  activeChapterIndex === idx
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/10 hover:text-accent"
                }`}
              >
                {toRoman(idx + 1)}
              </button>
            ))}
          </nav>
        )}

        {/* Desktop floating action rail */}
        <div className="action-rail">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFavoriteToggle}
            disabled={isFavoriting}
            aria-label={isFavorited ? t("article.unfavorite") : t("article.favorite")}
            aria-pressed={isFavorited}
            className={isFavorited
              ? "text-red-500 hover:text-red-600 bg-red-50/50 rounded-full h-10 w-10"
              : "text-muted-foreground hover:text-red-500 hover:bg-red-50/50 rounded-full h-10 w-10"}
          >
            <Heart className={isFavorited ? "h-5 w-5 fill-current" : "h-5 w-5"} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-accent rounded-full h-10 w-10"
                aria-label={t("share.title")}
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[110]">
              <DropdownMenuItem onClick={() => handleShare('copy')} className="flex items-center gap-2 cursor-pointer">
                <LinkIcon className="h-4 w-4" />
                {t("share.copyLink")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('facebook')} className="flex items-center gap-2 cursor-pointer">
                <Facebook className="h-4 w-4" />
                {t("share.facebook")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('x')} className="flex items-center gap-2 cursor-pointer">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                </svg>
                {t("share.twitter")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={scrollToComments}
            className="text-muted-foreground hover:text-accent rounded-full h-10 w-10"
            aria-label={language === 'en' ? "Jump to comments" : "Sari la comentarii"}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <div className="h-px w-6 bg-border my-1" aria-hidden="true" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-accent rounded-full h-10 w-10"
            aria-label={t("article.close")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 md:p-16 custom-scrollbar relative">
          <article className="max-w-4xl mx-auto">
            {isCarousel ? renderCarouselStory() : isVideo ? renderVideoStory() : renderTextStory()}

            {/* End-of-article ornament — magazine "FIN" flourish */}
            <div className="article-end-ornament">
              <span className="text-sm tracking-[0.4em] uppercase font-bold text-accent">
                {t("parchment.theEnd")}
              </span>
            </div>

            {/* Inline share row — "loved this? share it" */}
            <div className="max-w-[680px] mx-auto pt-2 pb-12 text-center space-y-4">
              <p className="text-xs font-sans uppercase tracking-[0.25em] text-muted-foreground font-bold">
                {language === 'en' ? "Enjoyed this story?" : "Ți-a plăcut povestea?"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFavoriteToggle}
                  disabled={isFavoriting}
                  className={`rounded-full font-serif italic ${
                    isFavorited ? "text-red-500 border-red-200 bg-red-50/50" : ""
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 mr-2 ${isFavorited ? "fill-current" : ""}`} />
                  {isFavorited
                    ? (language === 'en' ? "Saved" : "Salvat")
                    : (language === 'en' ? "Save" : "Salvează")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare('copy')}
                  className="rounded-full font-serif italic"
                >
                  <LinkIcon className="h-3.5 w-3.5 mr-2" />
                  {t("share.copyLink")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare('facebook')}
                  className="rounded-full font-serif italic"
                  aria-label={t("share.facebook")}
                >
                  <Facebook className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare('x')}
                  className="rounded-full font-serif italic"
                  aria-label={t("share.twitter")}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </Button>
              </div>
            </div>

            {/* Comments Section — darker parchment background */}
            <section
              ref={commentsAnchorRef}
              className="mt-12 -mx-8 md:-mx-16 px-8 md:px-16 py-12 bg-secondary/20 border-t border-secondary-foreground/10"
            >
              <div className="max-w-[680px] mx-auto">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="h-px flex-1 bg-secondary-foreground/15 max-w-12" />
                  <MessageSquare className="h-4 w-4 text-accent" />
                  <h3 className="text-2xl font-serif italic font-bold text-secondary-foreground">
                    {language === 'en' ? 'The Conversation' : 'Conversația'}
                  </h3>
                  <div className="h-px flex-1 bg-secondary-foreground/15 max-w-12" />
                </div>
                <p className="text-center text-xs font-serif italic text-muted-foreground mb-8">
                  {commentsTotal === 0
                    ? (language === 'en' ? "No replies yet" : "Niciun răspuns încă")
                    : `${commentsTotal} ${language === 'en' ? (commentsTotal === 1 ? "reply" : "replies") : (commentsTotal === 1 ? "răspuns" : "răspunsuri")}`}
                </p>

                {/* Add Comment Form */}
                <div className="mb-10 space-y-3 comment-card">
                  <Textarea
                    placeholder={language === 'en' ? 'Share your thoughts on this story...' : 'Împărtășește-ți gândurile despre această poveste...'}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="bg-background/50 border-secondary-foreground/10 font-serif focus:ring-accent/20 min-h-[90px]"
                    maxLength={1000}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-serif italic">
                      {newComment.length}/1000
                    </span>
                    <Button
                      onClick={handlePostComment}
                      disabled={isPosting || !newComment.trim()}
                      className="bg-accent hover:bg-accent/90 text-white font-serif italic rounded-full"
                      size="sm"
                    >
                      {isPosting ? '...' : (language === 'en' ? 'Post Comment' : 'Postează')}
                      <Send className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-4">
                  {commentsLoadError && (
                    <p className="text-center text-sm font-serif italic text-destructive bg-destructive/5 border border-destructive/10 rounded-2xl px-4 py-3">
                      {commentsLoadError}
                    </p>
                  )}
                  {comments.length === 0 && !commentsLoadError && (
                    <p className="text-center italic text-muted-foreground font-serif py-6">
                      {language === 'en' ? 'Be the first to start the conversation' : 'Fii primul care începe conversația'}
                    </p>
                  )}
                  {comments.map((comment) => {
                    const isOwn = user?.id === comment.userId;
                    const isEditing = editingCommentId === comment.id;
                    return (
                      <div key={comment.id} className="comment-card group animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-serif font-bold text-accent shrink-0">
                            {comment.userDisplayName?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-serif font-bold text-secondary-foreground">
                                {comment.userDisplayName}
                              </span>
                              <div className="flex items-center gap-2">
                                {isOwn && !isEditing && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleStartEdit(comment)}
                                      className="p-1 rounded hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                                      title={language === 'en' ? 'Edit' : 'Editează'}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteComment(comment.id)}
                                      disabled={isDeletingComment === comment.id}
                                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                      title={language === 'en' ? 'Delete' : 'Șterge'}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-serif italic">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            {isEditing ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="font-serif italic bg-background/50 border-secondary-foreground/10 min-h-[80px]"
                                  maxLength={1000}
                                />
                                <div className="flex items-center gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="text-xs font-serif italic"
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    {language === 'en' ? 'Cancel' : 'Anulează'}
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleSaveEdit(comment.id)}
                                    disabled={isPosting || !editContent.trim()}
                                    className="text-xs font-serif italic"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    {isPosting ? '...' : (language === 'en' ? 'Save' : 'Salvează')}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="font-serif text-base leading-relaxed text-secondary-foreground/85 italic">
                                {comment.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {comments.length > 0 && comments.length < commentsTotal && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="ghost"
                        onClick={loadMoreComments}
                        disabled={isLoadingMoreComments}
                        className="font-serif italic text-sm"
                      >
                        {isLoadingMoreComments
                          ? (language === 'en' ? 'Loading...' : 'Se încarcă...')
                          : (language === 'en'
                              ? `Load more (${commentsTotal - comments.length} remaining)`
                              : `Încarcă mai multe (${commentsTotal - comments.length} rămase)`)}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Further Reading — editorial card grid */}
            {relatedArticles.length > 0 && (
              <section className="-mx-8 md:-mx-16 px-8 md:px-16 py-16 bg-secondary/10 border-t border-secondary-foreground/10">
                <div className="max-w-4xl mx-auto">
                  <div className="text-center mb-12 space-y-2">
                    <p className="article-eyebrow">
                      {language === 'en' ? "More to read" : "Mai multe de citit"}
                    </p>
                    <h3 className="text-3xl font-serif italic font-black text-secondary-foreground">
                      {language === 'en' ? "Further Reading" : "Lecturi suplimentare"}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {relatedArticles.map((rel) => {
                      const cat = allCategories.find(c => c.id === rel.categoryId);
                      const relReadingMinutes = rel.type === 'text'
                        ? getReadingTimeMinutes(getLocalized(rel, "content", language))
                        : null;
                      return (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/article/${rel.id}`, {
                              state: {
                                from: window.location.pathname,
                                selectedLocation: (location.state as { selectedLocation?: string } | null)?.selectedLocation
                              }
                            });
                          }}
                          className="further-reading-card group text-left"
                        >
                          <div className="aspect-[16/10] overflow-hidden relative">
                            <img
                              src={(rel.type === 'video' ? rel.posterUrl || rel.mediaUrl : rel.mediaUrl) || "https://images.unsplash.com/photo-1701118737005-005fc66703be?q=80&w=600"}
                              alt={getLocalized(rel, "title", language)}
                              className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                              loading="lazy"
                            />
                            {rel.type === 'video' && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="p-3 bg-white/20 backdrop-blur-md rounded-full">
                                  <Video className="h-5 w-5 text-white" />
                                </div>
                              </div>
                            )}
                            {rel.type === 'carousel' && (
                              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <Images className="h-3 w-3" /> {rel.mediaUrls?.length ?? 0}
                              </div>
                            )}
                          </div>
                          <div className="p-5 space-y-2">
                            {cat && (
                              <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-accent font-bold">
                                {getLocalized(cat, "name", language)}
                              </p>
                            )}
                            <h4 className="font-serif font-bold italic text-lg leading-snug text-secondary-foreground group-hover:text-accent transition-colors">
                              {getLocalized(rel, "title", language)}
                            </h4>
                            {relReadingMinutes !== null && (
                              <p className="text-xs font-serif italic text-muted-foreground">
                                {relReadingMinutes} {language === 'en' ? "min read" : "min de citit"}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </article>
        </div>
        
        {/* Bottom Actions */}
        <div className="p-4 bg-secondary/10 text-center border-t border-secondary-foreground/5">
          <Button variant="outline" onClick={onClose} className="font-serif italic hover:bg-accent hover:text-white transition-all">
            {t("parchment.close")}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};
