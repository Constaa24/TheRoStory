import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { getLocalized, Article, CHAPTER_DELIMITER, Comment } from "@/lib/supabase";
import { toggleFavorite, isArticleFavorited, fetchComments, postComment, deleteComment, updateComment, fetchPublicContent, fetchArticleViews, incrementView } from "@/lib/supabase";
import { isAbortError } from "@/lib/utils";

// Session-level cache — avoids re-fetching all articles every time a modal opens
let _publicContentCache: Awaited<ReturnType<typeof fetchPublicContent>> | null = null;
let _publicContentPending: Promise<Awaited<ReturnType<typeof fetchPublicContent>>> | null = null;
const getCachedPublicContent = () => {
  if (_publicContentCache) return Promise.resolve(_publicContentCache);
  if (_publicContentPending) return _publicContentPending;
  _publicContentPending = fetchPublicContent().then((data) => {
    _publicContentCache = data;
    _publicContentPending = null;
    return data;
  });
  return _publicContentPending;
};
import { motion } from "framer-motion";
import { X, BookOpen, Heart, Video, Eye, MessageSquare, Send, MapPin, Share2, Facebook, Link as LinkIcon, Images, Pencil, Trash2, Check } from "lucide-react";
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
  const [commentsLoadError, setCommentsLoadError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const lastCommentTimeRef = useRef(0);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isDeletingComment, setIsDeletingComment] = useState<string | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [views, setViews] = useState(initialViews);
  const mountedRef = useRef(true);
  const currentArticleIdRef = useRef(article.id);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  // Scroll to top when article changes
  useEffect(() => {
    const contentArea = document.querySelector('.custom-scrollbar');
    if (contentArea) {
      contentArea.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [article.id]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setCommentsLoadError(null);

      // Run all three independent fetches in parallel
      const [favResult, commentsResult, relatedResult] = await Promise.allSettled([
        user ? isArticleFavorited(user.id, article.id) : Promise.resolve(false),
        fetchComments(article.id),
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
        setComments(commentsResult.value);
      } else if (!isAbortError(commentsResult.reason)) {
        console.error("Error loading comments:", commentsResult.reason);
        setCommentsLoadError(language === 'en' ? "Failed to load comments. Please try again." : "Comentariile nu au putut fi încărcate. Încearcă din nou.");
      }

      // Handle related articles
      if (relatedResult.status === 'fulfilled') {
        const data = relatedResult.value;
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
  }, [user, article.id, article.categoryId]);

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
      const data = await fetchComments(targetArticleId);
      if (!mountedRef.current || currentArticleIdRef.current !== targetArticleId) return false;
      setComments(data);
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
    if (now - lastCommentTimeRef.current < cooldownMs) {
      const secsLeft = Math.ceil((cooldownMs - (now - lastCommentTimeRef.current)) / 1000);
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
        lastCommentTimeRef.current = Date.now();
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

  const renderTextStory = () => {
    const content = getLocalized(article, "content", language);
    const chapters = content.includes(CHAPTER_DELIMITER) 
      ? content.split(CHAPTER_DELIMITER).filter((ch: string) => ch.trim())
      : [content];

    return (
      <div className="space-y-12">
        <header className="text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-7xl font-serif font-black text-secondary-foreground leading-tight tracking-tight px-4">
              {getLocalized(article, "title", language)}
            </h1>
          </motion.div>
          <div className="flex items-center justify-center gap-6">
            <div className="h-[1px] w-12 md:w-24 bg-accent/30" />
            <div className="w-3 h-3 rotate-45 border border-accent/50 bg-accent/10" />
            <div className="h-[1px] w-12 md:w-24 bg-accent/30" />
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-xs font-sans uppercase tracking-[0.2em] text-muted-foreground font-medium">
            {article.location && (
              <span className="flex items-center gap-1.5 text-accent font-bold bg-accent/5 px-3 py-1 rounded-full border border-accent/10">
                <MapPin className="h-3 w-3" />
                {article.location}
              </span>
            )}
            <span className="bg-secondary-foreground/5 px-3 py-1 rounded-full border border-secondary-foreground/10">
              {new Date(article.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'ro-RO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </header>

        {article.mediaUrl && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative group p-1 bg-secondary-foreground/10 rounded-sm"
          >
            <div className="overflow-hidden relative rounded-sm">
              <img
                src={article.mediaUrl}
                alt={getLocalized(article, "title", language)}
                className="w-full h-auto shadow-2xl grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000 ease-out"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
            <div className="absolute inset-0 border-[1px] border-white/20 pointer-events-none" />
          </motion.div>
        )}

        <div className="max-w-3xl mx-auto space-y-12">
          {chapters.map((chapter: string, index: number) => (
            <motion.div 
              key={index} 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {chapters.length > 1 && (
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-xs font-sans uppercase tracking-widest text-accent font-black">
                    {language === 'en' ? `Chapter ${index + 1}` : `Capitolul ${index + 1}`}
                  </span>
                  <div className="h-[1px] flex-1 bg-accent/10" />
                </div>
              )}
              <div 
                className={`font-serif text-xl md:text-2xl leading-[1.7] text-secondary-foreground/90 whitespace-pre-wrap ${
                  index === 0 ? "drop-cap" : ""
                }`}
              >
                {chapter.trim()}
              </div>
              {index < chapters.length - 1 && (
                <div className="flex justify-center my-16">
                  <div className="romanian-motif w-full h-10 bg-repeat-x opacity-20" />
                </div>
              )}
            </motion.div>
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
        <header className="text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-8xl font-serif font-black text-secondary-foreground leading-tight tracking-tight px-4">
              {getLocalized(article, "title", language)}
            </h1>
          </motion.div>
          <div className="flex items-center justify-center gap-6">
            <div className="h-[1px] w-12 md:w-24 bg-accent/30" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent/50" />
              <Video className="h-4 w-4 text-accent" />
              <div className="w-2 h-2 rounded-full bg-accent/50" />
            </div>
            <div className="h-[1px] w-12 md:w-24 bg-accent/30" />
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-xs font-sans uppercase tracking-[0.2em] text-muted-foreground font-medium">
            {article.location && (
              <span className="flex items-center gap-1.5 text-accent font-bold bg-accent/5 px-3 py-1 rounded-full border border-accent/10">
                <MapPin className="h-3 w-3" />
                {article.location}
              </span>
            )}
            <span className="bg-secondary-foreground/5 px-3 py-1 rounded-full border border-secondary-foreground/10">
              {articleDate.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
          className="relative aspect-video w-full overflow-hidden rounded-sm shadow-2xl bg-black/90 group ring-1 ring-white/10"
        >
          <video
            src={article.mediaUrl || undefined}
            poster={article.posterUrl || undefined}
            controls
            preload="metadata"
            playsInline
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 border-[1px] border-white/10 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative p-10 bg-secondary-foreground/5 backdrop-blur-sm border-l-4 border-accent shadow-xl"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Video className="h-12 w-12" />
            </div>
            <h3 className="text-xs font-sans uppercase tracking-[0.3em] text-accent mb-6 font-black">
              {language === 'en' ? 'Story Insight' : 'Informații Poveste'}
            </h3>
            <p className="font-serif text-2xl md:text-3xl leading-relaxed text-secondary-foreground/90 italic">
              {description}
            </p>
          </motion.div>
        </div>

        <div className="flex justify-center pt-8">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-[1px] bg-accent/30" />
            <p className="text-[10px] font-sans uppercase tracking-[0.5em] text-muted-foreground/60">
              {articleDate.toLocaleDateString(locale, { year: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </div>
    );

  };

  const renderCarouselStory = () => {
    const description = getLocalized(article, "content", language);
    const images = article.mediaUrls || [];
    
    return (
      <div className="space-y-12">
        <header className="text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-8xl font-serif font-black text-secondary-foreground leading-tight tracking-tight px-4">
              {getLocalized(article, "title", language)}
            </h1>
          </motion.div>
          <div className="flex items-center justify-center gap-6">
            <div className="h-[1px] w-12 md:w-24 bg-accent/30" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent/50" />
              <Images className="h-4 w-4 text-accent" />
              <div className="w-2 h-2 rounded-full bg-accent/50" />
            </div>
            <div className="h-[1px] w-12 md:w-24 bg-accent/30" />
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-xs font-sans uppercase tracking-[0.2em] text-muted-foreground font-medium">
            {article.location && (
              <span className="flex items-center gap-1.5 text-accent font-bold bg-accent/5 px-3 py-1 rounded-full border border-accent/10">
                <MapPin className="h-3 w-3" />
                {article.location}
              </span>
            )}
            <span className="bg-secondary-foreground/5 px-3 py-1 rounded-full border border-secondary-foreground/10">
              {new Date(article.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'ro-RO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </header>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
          className="relative w-full max-w-2xl mx-auto"
        >
          <Carousel className="w-full">
            <CarouselContent>
              {images.length === 0 && (
                <CarouselItem>
                  <div className="relative h-[50vh] md:h-[65vh] w-full overflow-hidden rounded-sm shadow-2xl bg-black/5 ring-1 ring-white/10 flex items-center justify-center">
                    <div className="text-center space-y-2 text-muted-foreground">
                      <Images className="h-12 w-12 mx-auto opacity-30" />
                      <p className="font-serif italic">{language === 'en' ? 'No images available' : 'Nicio imagine disponibilă'}</p>
                    </div>
                  </div>
                </CarouselItem>
              )}
              {images.map((url, index) => (
                <CarouselItem key={index}>
                  <div className="relative h-[50vh] md:h-[65vh] w-full overflow-hidden rounded-sm shadow-2xl bg-black/90 ring-1 ring-white/10 flex items-center justify-center">
                    <img
                      src={url}
                      alt={`${getLocalized(article, "title", language)} - ${index + 1}`}
                      className="max-w-full max-h-full object-contain grayscale-[0.1] hover:grayscale-0 transition-all duration-700"
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                    <div className="absolute inset-0 border-[1px] border-white/10 pointer-events-none" />
                    <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full font-sans uppercase tracking-widest">
                      {index + 1} / {images.length}
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <>
                <CarouselPrevious className="hidden md:flex -left-12 bg-secondary/50 border-accent/20 hover:bg-accent hover:text-white" />
                <CarouselNext className="hidden md:flex -right-12 bg-secondary/50 border-accent/20 hover:bg-accent hover:text-white" />
              </>
            )}
          </Carousel>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative p-10 bg-secondary/30 backdrop-blur-sm border-l-4 border-accent shadow-xl"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Images className="h-12 w-12" />
            </div>
            <h3 className="text-xs font-sans uppercase tracking-[0.3em] text-accent mb-6 font-black">
              {language === 'en' ? 'Visual Story' : 'Poveste Vizuală'}
            </h3>
            <p className="font-serif text-2xl md:text-3xl leading-relaxed text-secondary-foreground/90 italic">
              {description}
            </p>
          </motion.div>
        </div>

        <div className="flex justify-center pt-8">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-[1px] bg-accent/30" />
            <p className="text-[10px] font-sans uppercase tracking-[0.5em] text-muted-foreground/60">
              {new Date(article.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'ro-RO', {
                year: 'numeric',
                month: 'long'
              })}
            </p>
          </div>
        </div>
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
          <div className="absolute top-0 left-0 w-full h-2 bg-secondary/50 torn-edge rotate-180 z-20" />
          <div className="absolute bottom-0 left-0 w-full h-2 bg-secondary/50 torn-edge z-20" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-secondary-foreground/10 bg-secondary/20">
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
                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {comments.length}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent">
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
              className={isFavorited ? "text-red-500 hover:text-red-600 bg-red-50/50" : "text-muted-foreground hover:text-red-500 hover:bg-red-50/50"}
            >
              <Heart className={isFavorited ? "h-6 w-6 fill-current" : "h-6 w-6"} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-accent/10">
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 md:p-16 custom-scrollbar">
          <article className="max-w-4xl mx-auto">
            {isCarousel ? renderCarouselStory() : isVideo ? renderVideoStory() : renderTextStory()}

            <footer className="pt-12 flex justify-center">
              <div className="flex items-center gap-4">
                <div className="h-[1px] w-12 bg-secondary-foreground/20" />
                <span className="font-serif italic text-accent">{t("parchment.theEnd")}</span>
                <div className="h-[1px] w-12 bg-secondary-foreground/20" />
              </div>
            </footer>

            {/* Comments Section */}
            <section className="mt-20 pt-10 border-t border-secondary-foreground/10">
              <div className="flex items-center gap-2 mb-8">
                <MessageSquare className="h-5 w-5 text-accent" />
                <h3 className="text-xl font-serif font-bold text-secondary-foreground">
                  {language === 'en' ? 'Comments' : 'Comentarii'} ({comments.length})
                </h3>
              </div>

              {/* Add Comment Form */}
              <div className="mb-10 space-y-4">
                <Textarea
                  placeholder={language === 'en' ? 'Share your thoughts on this story...' : 'Împărtășiți-vă gândurile despre această poveste...'}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="bg-secondary/20 border-secondary-foreground/10 font-serif focus:ring-accent/20"
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handlePostComment} 
                    disabled={isPosting || !newComment.trim()}
                    className="bg-accent hover:bg-accent/90 text-white font-serif italic"
                  >
                    {isPosting ? '...' : (language === 'en' ? 'Post Comment' : 'Postează')} <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-6">
                {commentsLoadError && (
                  <p className="text-center text-sm font-serif italic text-destructive bg-destructive/5 border border-destructive/10 rounded-sm px-4 py-3">
                    {commentsLoadError}
                  </p>
                )}
                {comments.length === 0 && !commentsLoadError ? (
                  <p className="text-center italic text-muted-foreground font-serif py-10">
                    {language === 'en' ? 'No comments yet. Be the first to start the conversation!' : 'Niciun comentariu încă. Fii primul care începe conversația!'}
                  </p>
                ) : comments.length > 0 ? (
                  comments.map((comment) => {
                    const isOwn = user?.id === comment.userId;
                    const isEditing = editingCommentId === comment.id;
                    return (
                    <div key={comment.id} className="group animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-serif font-bold text-accent shrink-0">
                          {comment.userDisplayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
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
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="font-serif italic text-lg bg-secondary/5 border-secondary-foreground/10 min-h-[80px]"
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
                          <div className="font-serif text-lg leading-relaxed text-secondary-foreground/80 bg-secondary/5 p-4 rounded-sm border border-secondary-foreground/5 italic">
                            {comment.content}
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })
                ) : null}
              </div>
            </section>

            {/* Related Stories Section */}
            {relatedArticles.length > 0 && (
              <section className="mt-20 pt-10 border-t border-secondary-foreground/10">
                <h3 className="text-xl font-serif font-bold text-secondary-foreground mb-8">
                  {t("related.title")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedArticles.map((rel) => (
                    <div 
                      key={rel.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/article/${rel.id}`, { 
                          state: { 
                            from: window.location.pathname,
                            selectedLocation: (location.state as { selectedLocation?: string } | null)?.selectedLocation
                          } 
                        });
                      }}
                      className="group cursor-pointer space-y-3"
                    >
                      <div className="aspect-[16/10] overflow-hidden rounded-sm relative">
                        <img
                          src={(rel.type === 'video' ? rel.posterUrl || rel.mediaUrl : rel.mediaUrl) || "https://images.unsplash.com/photo-1701118737005-005fc66703be?q=80&w=600"}
                          alt={getLocalized(rel, "title", language)}
                          className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500"
                          loading="lazy"
                        />
                        {rel.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <Video className="h-6 w-6 text-white" />
                          </div>
                        )}
                      </div>
                      <h4 className="font-serif font-bold italic text-sm leading-tight group-hover:text-accent transition-colors">
                        {getLocalized(rel, "title", language)}
                      </h4>
                    </div>
                  ))}
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
