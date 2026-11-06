import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import {
  Comment,
  fetchComments,
  fetchCommentsThroughPage,
  postComment,
  deleteComment,
  updateComment,
} from "@/lib/supabase";
import { isAbortError } from "@/lib/utils";
import { formatArticleDate, countLabel } from "@/lib/article-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Send, Pencil, Trash2, Check, X } from "lucide-react";

interface Props {
  articleId: string;
}

export const ArticleComments: React.FC<Props> = ({ articleId }) => {
  const { user, login } = useAuth();
  const { language } = useLanguage();

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  // One mis-tap on the trash icon used to delete permanently — route the
  // action through a confirmation dialog instead.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const currentArticleIdRef = useRef(articleId);
  // Read language via a ref inside the load effect so toggling locale
  // doesn't refetch the comment list. The only thing language affects
  // here is the error-message copy, which is set at error time.
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);
  const COOLDOWN_KEY = `rostory_last_comment_${articleId}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    currentArticleIdRef.current = articleId;
    let cancelled = false;
    setLoadError(null);
    setEditingCommentId(null);
    setEditContent("");

    fetchComments(articleId, 0)
      .then((data) => {
        if (cancelled || currentArticleIdRef.current !== articleId) return;
        setComments(data.comments);
        setCommentsTotal(data.total);
        setCommentsPage(0);
      })
      .catch((error) => {
        if (cancelled || isAbortError(error)) return;
        console.error("Error loading comments:", error);
        setLoadError(
          languageRef.current === "en"
            ? "Failed to load comments. Please try again."
            : "Comentariile nu au putut fi încărcate. Încearcă din nou."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  /**
   * Refreshes the comment list after a post / edit / delete.
   *
   * Keeps every page the reader had already loaded rather than collapsing
   * back to page 0 — someone who had paged through three batches lost them
   * all as soon as they replied to anything. Fetched as one widened range
   * so this stays a single round-trip no matter how deep they had paged.
   */
  const reloadComments = async (): Promise<boolean> => {
    try {
      const data = await fetchCommentsThroughPage(articleId, commentsPage + 1);
      if (!mountedRef.current || currentArticleIdRef.current !== articleId) return false;
      setComments(data.comments);
      setCommentsTotal(data.total);
      setLoadError(null);
      return true;
    } catch (error) {
      if (!isAbortError(error)) console.error("Error refreshing comments:", error);
      return false;
    }
  };

  const loadMore = async () => {
    if (isLoadingMore || comments.length >= commentsTotal) return;
    setIsLoadingMore(true);
    try {
      const nextPage = commentsPage + 1;
      const data = await fetchComments(articleId, nextPage);
      if (!mountedRef.current || currentArticleIdRef.current !== articleId) return;
      setComments((prev) => [...prev, ...data.comments]);
      setCommentsTotal(data.total);
      setCommentsPage(nextPage);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading more comments:", error);
        toast.error(
          language === "en"
            ? "Failed to load more comments"
            : "Nu s-au putut încărca mai multe comentarii"
        );
      }
    } finally {
      if (mountedRef.current) setIsLoadingMore(false);
    }
  };

  const handlePost = async () => {
    if (!user) {
      toast.error(
        language === "en"
          ? "Please log in to comment"
          : "Vă rugăm să vă autentificați pentru a comenta"
      );
      login();
      return;
    }
    const trimmed = newComment.trim();
    if (!trimmed) return;
    // Aligned with the DB CHECK constraint (`comments_content_length` ≤ 2000
    // in migration 20260507000000_audit_hardening.sql). Anything larger
    // would be rejected server-side anyway — fail fast with a friendly toast.
    if (trimmed.length > 2000) {
      toast.error(
        language === "en"
          ? "Comment must be under 2000 characters"
          : "Comentariul trebuie să aibă sub 2000 de caractere"
      );
      return;
    }

    // The cooldown is a client-side courtesy — the real limit is the RLS
    // CHECK (private.comment_count_last_minute < 5). Reading localStorage
    // throws a SecurityError where site data is blocked, and this read sits
    // outside the try below: uncaught, it rejected handlePost before the
    // comment was ever sent, with no toast and no post. Treat unavailable
    // storage as "no recent comment" and let the database do the limiting.
    const now = Date.now();
    const cooldownMs = 10_000;
    let last = 0;
    try {
      last = parseInt(localStorage.getItem(COOLDOWN_KEY) || "0", 10) || 0;
    } catch {
      // Storage unavailable — skip the local cooldown.
    }
    if (now - last < cooldownMs) {
      const secsLeft = Math.ceil((cooldownMs - (now - last)) / 1000);
      toast.error(
        language === "en"
          ? `Please wait ${secsLeft}s before posting again`
          : `Așteaptă ${secsLeft}s înainte de a posta din nou`
      );
      return;
    }

    setIsPosting(true);
    try {
      const success = await postComment({
        articleId,
        userId: user.id,
        content: trimmed,
      });
      if (success) {
        // Inside the try, so an unguarded throw here would be caught below and
        // reported as "Failed to post comment" — for a comment that had just
        // been posted successfully, while skipping the reset and the reload.
        // The reader would see a failure and post again, duplicating it.
        try {
          localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
        } catch {
          // Storage unavailable — the cooldown is best-effort, the post stands.
        }
        setNewComment("");
        await reloadComments();
        toast.success(language === "en" ? "Comment posted" : "Comentariu postat");
      } else {
        toast.error(
          language === "en"
            ? "Failed to post comment"
            : "Eroare la postarea comentariului"
        );
      }
    } catch {
      toast.error(
        language === "en"
          ? "Failed to post comment"
          : "Eroare la postarea comentariului"
      );
    } finally {
      if (mountedRef.current) setIsPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    setIsDeleting(commentId);
    try {
      const success = await deleteComment(commentId, user.id);
      if (success) {
        await reloadComments();
        toast.success(language === "en" ? "Comment deleted" : "Comentariu șters");
      } else {
        toast.error(
          language === "en"
            ? "Failed to delete comment"
            : "Eroare la ștergerea comentariului"
        );
      }
    } catch {
      toast.error(
        language === "en"
          ? "Failed to delete comment"
          : "Eroare la ștergerea comentariului"
      );
    } finally {
      if (mountedRef.current) setIsDeleting(null);
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
    if (!user) return;
    const trimmed = editContent.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      toast.error(
        language === "en"
          ? "Comment must be under 2000 characters"
          : "Comentariul trebuie să aibă sub 2000 de caractere"
      );
      return;
    }
    setIsPosting(true);
    try {
      const success = await updateComment(commentId, user.id, trimmed);
      if (success) {
        setEditingCommentId(null);
        setEditContent("");
        await reloadComments();
        toast.success(language === "en" ? "Comment updated" : "Comentariu actualizat");
      } else {
        toast.error(
          language === "en"
            ? "Failed to update comment"
            : "Eroare la actualizarea comentariului"
        );
      }
    } catch {
      toast.error(
        language === "en"
          ? "Failed to update comment"
          : "Eroare la actualizarea comentariului"
      );
    } finally {
      if (mountedRef.current) setIsPosting(false);
    }
  };

  const en = language === "en";
  const composeId = `note-${articleId}`;

  return (
    <section aria-labelledby={`${composeId}-h`} className="no-print" style={{ maxWidth: 680 }}>
        <div className="flex flex-col">
          <h2 id={`${composeId}-h`} className="rs-display" style={{ margin: "0 0 6px", fontSize: 36, lineHeight: 1.1, letterSpacing: 0 }}>
            {en ? "Notes from readers" : "Note de la cititori"}
          </h2>
          <p className="m-0" style={{ marginBottom: 24, fontFamily: "var(--ui)", fontSize: 13, color: "var(--text-mute)" }}>
            {commentsTotal === 0
              ? (en ? "No notes yet — leave the first." : "Nicio notă încă — lasă prima.")
              : countLabel(commentsTotal, "note", language)}
          </p>

          {/* Compose */}
          {user ? (
            <div className="grid gap-2.5" style={{ marginBottom: 28 }}>
              <label htmlFor={composeId} style={{ fontFamily: "var(--ui)", fontSize: 13, fontWeight: 600, color: "var(--text-dim)" }}>
                {en ? "Leave a note for the next reader" : "Lasă o notă pentru următorul cititor"}
              </label>
              <textarea
                id={composeId}
                className="sb-input"
                placeholder={en ? "A memory, a detail we missed, a question…" : "O amintire, un detaliu care ne-a scăpat, o întrebare…"}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                style={{ minHeight: 110, borderRadius: 14, background: "var(--ink-2)", fontSize: 17, lineHeight: 1.55 }}
                maxLength={2000}
              />
              <div className="flex flex-wrap items-center justify-between gap-3.5">
                <p className="m-0" style={{ fontFamily: "var(--ui)", fontSize: 12, color: "var(--text-mute)" }}>
                  {en ? "Signed in as " : "Autentificat ca "}{user.displayName || user.email}
                  {en ? " · notes are public" : " · notele sunt publice"}
                  {" · "}{newComment.length}/2000
                </p>
                <button type="button" className="rs-btn" style={{ minHeight: 44 }} onClick={handlePost} disabled={isPosting || !newComment.trim()}>
                  {isPosting ? (en ? "Leaving it…" : "Se lasă…") : (en ? "Post the note" : "Publică nota")}
                  <Send className="w-[15px] h-[15px]" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3" style={{ padding: "18px 20px", marginBottom: 28, border: "1px dashed var(--gold-deep)", borderRadius: 16 }}>
              <p className="font-display italic m-0" style={{ fontSize: 20, color: "var(--parchment)" }}>
                {en ? "Sign in to leave a note." : "Intră în cont ca să lași o notă."}
              </p>
              <button type="button" onClick={login} className="rs-btn rs-btn-ghost" style={{ minHeight: 42, borderColor: "var(--gold)", color: "var(--gold)" }}>
                {en ? "Sign in" : "Autentificare"}
              </button>
            </div>
          )}

          {/* The notes */}
          <div className="flex flex-col">
            {loadError && (
              <p className="font-display italic text-center py-4 m-0" style={{ color: "var(--danger)" }}>
                {loadError}
              </p>
            )}
            {comments.map((comment) => {
              const isOwn = user?.id === comment.userId;
              const isEditing = editingCommentId === comment.id;
              const displayName =
                comment.userDisplayName?.trim() ||
                (en ? "Anonymous" : "Anonim");
              const initial = displayName.charAt(0).toUpperCase();
              return (
                <article
                  key={comment.id}
                  className="group"
                  style={{ padding: "18px 0", borderTop: "1px solid var(--line-soft)" }}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className="grid place-items-center font-display italic shrink-0"
                      style={{ width: 40, height: 48, borderRadius: "50% 50% 9px 9px / 36% 36% 9px 9px", border: "1px solid var(--line)", background: "var(--paper)", color: "var(--gold)", fontSize: 19 }}
                      aria-hidden="true"
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span style={{ fontFamily: "var(--ui)", fontSize: 13, fontWeight: 700, color: "var(--parchment)" }}>
                          {displayName}
                        </span>
                        <div className="flex items-center gap-2">
                          {isOwn && !isEditing && (
                            // focus-within keeps the actions visible while a
                            // keyboard user tabs onto them — group-hover alone
                            // left focused-but-invisible buttons.
                            <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(comment)}
                                aria-label={en ? "Edit" : "Editează"}
                                className="p-1.5 rounded-full transition-colors hover:text-gold"
                                style={{ color: "var(--text-mute)" }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(comment.id)}
                                disabled={isDeleting === comment.id}
                                aria-label={en ? "Delete" : "Șterge"}
                                className="p-1.5 rounded-full transition-colors disabled:opacity-50 hover:text-gold"
                                style={{ color: "var(--text-mute)" }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <span style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 500, color: "var(--text-mute)" }}>
                            {formatArticleDate(comment.createdAt, language, "short")}
                          </span>
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="mt-3 grid gap-2.5">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="sb-input"
                            style={{ minHeight: 96 }}
                            maxLength={2000}
                            aria-label={en ? "Edit your note" : "Editează nota"}
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button type="button" onClick={handleCancelEdit} className="sb-btn sb-btn-ghost" style={{ minHeight: 38, padding: "8px 16px" }}>
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                              {en ? "Cancel" : "Anulează"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(comment.id)}
                              disabled={isPosting || !editContent.trim()}
                              className="sb-btn"
                              style={{ minHeight: 38, padding: "8px 16px" }}
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              {isPosting ? "…" : en ? "Save" : "Salvează"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className="m-0 mt-1"
                          style={{ fontSize: 17, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}
                        >
                          {comment.content}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {comments.length > 0 && comments.length < commentsTotal && (
              <div className="flex justify-start pt-4">
                <button type="button" onClick={loadMore} disabled={isLoadingMore} className="rs-btn rs-btn-ghost" style={{ minHeight: 44 }}>
                  {isLoadingMore
                    ? (en ? "Loading…" : "Se încarcă…")
                    : en
                      ? `Read more notes (${commentsTotal - comments.length} more)`
                      : `Citește mai multe note (încă ${commentsTotal - comments.length})`}
                </button>
              </div>
            )}
          </div>

          <AlertDialog
            open={confirmDeleteId !== null}
            onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {language === "en" ? "Delete this comment?" : "Ștergi acest comentariu?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {language === "en"
                    ? "This will permanently remove your comment. This action cannot be undone."
                    : "Aceasta va elimina permanent comentariul tău. Acțiunea nu poate fi anulată."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {language === "en" ? "Cancel" : "Anulează"}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    const id = confirmDeleteId;
                    setConfirmDeleteId(null);
                    if (id) void handleDelete(id);
                  }}
                >
                  {language === "en" ? "Delete" : "Șterge"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
    </section>
  );
};
