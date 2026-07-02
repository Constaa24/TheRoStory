import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import {
  Comment,
  fetchComments,
  postComment,
  deleteComment,
  updateComment,
} from "@/lib/supabase";
import { isAbortError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Send, MessageSquare, Pencil, Trash2, Check, X } from "lucide-react";

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

  const reloadComments = async (): Promise<boolean> => {
    try {
      const data = await fetchComments(articleId, 0);
      if (!mountedRef.current || currentArticleIdRef.current !== articleId) return false;
      setComments(data.comments);
      setCommentsTotal(data.total);
      setCommentsPage(0);
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

    const now = Date.now();
    const cooldownMs = 10_000;
    const last = parseInt(localStorage.getItem(COOLDOWN_KEY) || "0", 10);
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
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
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

  return (
    <section style={{ padding: "80px 0", borderTop: "1px solid var(--line-soft)" }}>
      <div className="ed-container">
        <div className="max-w-[760px] mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquare className="w-4 h-4" style={{ color: "var(--gold)" }} />
            <div className="eyebrow">
              {language === "en" ? "The conversation" : "Conversația"}
            </div>
          </div>
          <h2
            className="font-display italic font-medium m-0"
            style={{
              fontSize: "clamp(32px, 4vw, 48px)",
              lineHeight: 1.05,
              color: "var(--parchment)",
            }}
          >
            {commentsTotal === 0
              ? language === "en"
                ? "No replies yet."
                : "Niciun răspuns încă."
              : `${commentsTotal} ${
                  language === "en"
                    ? commentsTotal === 1
                      ? "reply"
                      : "replies"
                    : commentsTotal === 1
                    ? "răspuns"
                    : "răspunsuri"
                }`}
          </h2>

          {/* Compose */}
          <div className="mt-10">
            {user ? (
              <div
                className="p-6"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--overlay-panel-soft)",
                }}
              >
                <Textarea
                  placeholder={
                    language === "en"
                      ? "Share your thoughts on this story…"
                      : "Împărtășește-ți gândurile despre această poveste…"
                  }
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="bg-transparent border-line min-h-[100px] font-serif"
                  maxLength={2000}
                />
                <div className="flex items-center justify-between mt-3">
                  <span
                    className="font-ui text-[11px]"
                    style={{ color: "var(--text-mute)", letterSpacing: "0.12em" }}
                  >
                    {newComment.length}/2000
                  </span>
                  <Button
                    onClick={handlePost}
                    disabled={isPosting || !newComment.trim()}
                    className="rounded-full font-display italic"
                    size="sm"
                  >
                    {isPosting
                      ? language === "en"
                        ? "Posting…"
                        : "Se postează…"
                      : language === "en"
                      ? "Post comment"
                      : "Postează"}
                    <Send className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="p-6 flex flex-wrap items-center justify-between gap-4"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--overlay-panel-soft)",
                }}
              >
                <p
                  className="font-display italic m-0"
                  style={{ fontSize: 18, color: "var(--text-dim)" }}
                >
                  {language === "en"
                    ? "Sign in to join the conversation."
                    : "Autentifică-te pentru a te alătura conversației."}
                </p>
                <Button onClick={login} className="rounded-full font-display italic" size="sm">
                  {language === "en" ? "Sign in" : "Autentificare"}
                </Button>
              </div>
            )}
          </div>

          {/* List */}
          <div className="mt-10 flex flex-col gap-6">
            {loadError && (
              <p
                className="font-serif italic text-center py-4"
                style={{ color: "var(--oxblood-2)" }}
              >
                {loadError}
              </p>
            )}
            {!loadError && comments.length === 0 && commentsTotal === 0 && (
              <p
                className="font-display italic text-center py-6"
                style={{ color: "var(--text-mute)" }}
              >
                {language === "en"
                  ? "Be the first to start the conversation."
                  : "Fii primul care începe conversația."}
              </p>
            )}
            {comments.map((comment) => {
              const isOwn = user?.id === comment.userId;
              const isEditing = editingCommentId === comment.id;
              const displayName =
                comment.userDisplayName?.trim() ||
                (language === "en" ? "Anonymous" : "Anonim");
              const initial = displayName.charAt(0).toUpperCase();
              return (
                <div
                  key={comment.id}
                  className="group p-6"
                  style={{
                    border: "1px solid var(--line-soft)",
                    background: "var(--overlay-panel-soft)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="h-10 w-10 rounded-full grid place-items-center font-display italic shrink-0"
                      style={{
                        border: "1px solid var(--gold)",
                        background: "var(--ink-2)",
                        color: "var(--gold)",
                      }}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span
                          className="font-display italic"
                          style={{ fontSize: 18, color: "var(--parchment)" }}
                        >
                          {displayName}
                        </span>
                        <div className="flex items-center gap-2">
                          {isOwn && !isEditing && (
                            // focus-within keeps the actions visible while a
                            // keyboard user tabs onto them — group-hover alone
                            // left focused-but-invisible buttons.
                            <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(comment)}
                                aria-label={language === "en" ? "Edit" : "Editează"}
                                className="p-1 rounded-full transition-colors"
                                style={{ color: "var(--text-mute)" }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(comment.id)}
                                disabled={isDeleting === comment.id}
                                aria-label={language === "en" ? "Delete" : "Șterge"}
                                className="p-1 rounded-full transition-colors disabled:opacity-50"
                                style={{ color: "var(--text-mute)" }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <span
                            className="font-ui text-[10px] uppercase"
                            style={{
                              letterSpacing: "0.18em",
                              color: "var(--text-mute)",
                            }}
                          >
                            {new Date(comment.createdAt).toLocaleDateString(
                              language === "en" ? "en-GB" : "ro-RO",
                              { day: "numeric", month: "short", year: "numeric" }
                            )}
                          </span>
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="bg-transparent border-line min-h-[80px] font-serif"
                            maxLength={2000}
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="text-xs font-display italic"
                            >
                              <X className="h-3 w-3 mr-1" />
                              {language === "en" ? "Cancel" : "Anulează"}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(comment.id)}
                              disabled={isPosting || !editContent.trim()}
                              className="text-xs font-display italic"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {isPosting
                                ? "…"
                                : language === "en"
                                ? "Save"
                                : "Salvează"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className="m-0 mt-2 font-serif"
                          style={{
                            fontSize: 17,
                            lineHeight: 1.65,
                            color: "var(--text)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
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
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="font-display italic"
                >
                  {isLoadingMore
                    ? language === "en"
                      ? "Loading…"
                      : "Se încarcă…"
                    : language === "en"
                    ? `Load more (${commentsTotal - comments.length} remaining)`
                    : `Încarcă mai multe (${commentsTotal - comments.length} rămase)`}
                </Button>
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
      </div>
    </section>
  );
};
