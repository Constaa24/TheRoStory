import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useSearchParams, Navigate, useNavigate, Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Article, Category, ReaderNote, fetchReaderNotes, getLocalized } from "@/lib/supabase";
import { fetchUserFavorites, fetchCategories, deleteOwnAccount, exportOwnData, supabase, deleteStorageFile, extractStoragePath, uploadUserFile } from "@/lib/supabase";
import { useFavorites } from "@/hooks/use-favorites";
import { isAbortError } from "@/lib/utils";
import { StoryCard } from "@/components/ui/story-card";
import { LoadError } from "@/components/ui/load-error";
import { Camera, Loader2, Shield, Heart, CheckCircle2, AlertCircle, Trash2, Download } from "lucide-react";
import { motion } from "framer-motion";
import { ReducedMotionConfig } from "@/components/ui/reduced-motion-config";
import { PageHead } from "@/components/layout/PageHead";
import { storageImage } from "@/lib/image-url";
import { formatArticleDate } from "@/lib/article-utils";

// Hoisted so StoryCard's React.memo can actually skip re-renders — an inline
// literal would be a new object identity every render (see Home).
const FAVORITES_LINK_STATE = { from: '/profile?tab=favorites' };

const Profile: React.FC = () => {
  const { user, role, refreshUser, logout } = useAuth();
  // Shared favorites provider so toggling here also updates heart state on
  // Home/CategoryDetail/article pages (they read the same source).
  const { handleFavoriteToggle: toggleFavoriteShared, isFavorited } = useFavorites();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Favorites state
  const [favorites, setFavorites] = useState<Article[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [favoritesLoadError, setFavoritesLoadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // For the category label on each saved story's card. Served from the
  // shared five-minute cache, so this is usually not a request at all.
  const [categories, setCategories] = useState<Category[]>([]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const activeTab = searchParams.get("tab") || "profile";
  // Three tabs, as the redesign draws the profile: the shelf (the default,
  // and what ?tab=favorites always meant), the reader's notes, and settings.
  const tab: "shelf" | "notes" | "settings" =
    activeTab === "settings" || activeTab === "notes" ? activeTab : "shelf";
  const setTab = (next: "shelf" | "notes" | "settings") =>
    setSearchParams(next === "shelf" ? {} : { tab: next }, { replace: true });
  const [notes, setNotes] = useState<ReaderNote[] | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchReaderNotes(user.id)
      .then((rows) => { if (!cancelled) setNotes(rows); })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [user?.id]);
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Sync state with user data when user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

  // The shelf sits beside the account form now rather than behind a tab,
  // so it loads with the page.
  useEffect(() => {
    if (user) loadFavorites();
    // loadFavorites is defined inline in this component and stable enough
    // for our purposes; the effect should re-run only when the user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadFavorites = async () => {
    if (!user) return;
    setIsLoadingFavorites(true);
    setFavoritesLoadError(null);
    try {
      const favs = await fetchUserFavorites(user.id);
      setFavorites(favs);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading favorites:", error);
        setFavoritesLoadError(
          language === 'en'
            ? "Failed to load favorites. Please try again."
            : "Favoritele nu au putut fi încărcate. Încearcă din nou."
        );
      }
    } finally {
      setIsLoadingFavorites(false);
    }
  };

  const handleFavoriteToggle = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    if (!user) return;

    // Snapshot before mutating so we can roll back on failure.
    const previousFavorites = favorites;
    setFavorites(prev => prev.filter(a => a.id !== articleId));

    // Delegate to the shared provider so the heart state stays in sync across
    // the app (and the success/error toast is shown there once). Returns
    // true if the article ended up favorited, false if removed, null on error.
    const added = await toggleFavoriteShared(e, articleId);

    if (added === null || added === undefined) {
      // Error (or not authenticated) — restore the optimistic removal.
      if (isMountedRef.current) setFavorites(previousFavorites);
      return;
    }

    if (added) {
      // It was unexpectedly re-added (stale state) — refresh from source.
      try {
        const fresh = await fetchUserFavorites(user.id);
        if (isMountedRef.current) setFavorites(fresh);
      } catch {
        if (isMountedRef.current) setFavorites(previousFavorites);
      }
    }
    // added === false → removed; the optimistic state is already correct.
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await exportOwnData();
      if (!data) {
        toast.error(language === 'en' ? "Failed to export data" : "Eroare la exportul datelor");
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rostory-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'en' ? "Your data has been downloaded" : "Datele tale au fost descărcate");
    } catch {
      toast.error(language === 'en' ? "Failed to export data" : "Eroare la exportul datelor");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const success = await deleteOwnAccount();
      if (success) {
        toast.success(language === 'en' ? "Account deleted successfully" : "Contul a fost șters cu succes");
        logout();
        navigate("/", { replace: true });
      } else {
        toast.error(language === 'en' ? "Failed to delete account. Please try again." : "Ștergerea contului a eșuat. Te rugăm să încerci din nou.");
      }
    } catch {
      toast.error(language === 'en' ? "Failed to delete account. Please try again." : "Ștergerea contului a eșuat. Te rugăm să încerci din nou.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!user) return <Navigate to="/auth" replace />;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Refresh user data to update the UI
      await refreshUser();
      toast.success(t("profile.success"));
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(t("profile.error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    // Capture the previous avatar's storage path so we can clean it up
    // after the new upload commits. Without this, every avatar change
    // leaves the old file behind in storage forever.
    const previousAvatarPath = extractStoragePath(avatarUrl, 'avatars');
    try {
      // uploadUserFile centralizes MIME prefix, extension allowlist, and
      // size validation; it also writes under the user's RLS-scoped path.
      // Avatars are capped at 5 MB here (the helper's default is 10 MB)
      // because profile pictures should never need more than that.
      const { publicUrl, storagePath } = await uploadUserFile(file, {
        bucket: 'avatars',
        kind: 'image',
        userId: user.id,
        maxBytes: 5 * 1024 * 1024,
      });

      // Update profile — clean up uploaded file if this fails
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        void deleteStorageFile('avatars', storagePath);
        throw profileError;
      }

      // The profile update succeeded — only now is it safe to remove the
      // previous avatar file. Best-effort; failures are non-fatal.
      if (previousAvatarPath && previousAvatarPath !== storagePath) {
        void deleteStorageFile('avatars', previousAvatarPath);
      }

      // Refresh user data and update local state
      await refreshUser();
      if (!isMountedRef.current) return;
      setAvatarUrl(publicUrl);
      toast.success(t("profile.success"));
    } catch (error) {
      // uploadUserFile throws with a human-readable message for validation
      // failures (too large, wrong type, wrong extension). Surface that
      // when available so the user knows what to fix.
      console.error("Error uploading avatar:", error);
      const message = error instanceof Error && error.message
        ? error.message
        : t("profile.error");
      toast.error(message);
    } finally {
      if (isMountedRef.current) setIsUploading(false);
      // Reset the file input so the same file can be re-selected if the
      // user wants to retry after a failure.
      if (e.target) e.target.value = "";
    }
  };

  const en = language === 'en';
  const initial = (displayName || user.email || 'U').charAt(0).toUpperCase();
  // Greet by the whole display name when it fits on a line. Taking only the
  // first word suits "Ana Popescu" but turned "The RoStory Admin" into
  // "Welcome back, The."; only a long name is cut to its first word.
  const fullName = (user.displayName || '').trim().replace(/\s+/g, ' ');
  const greetingName = fullName.length <= 24 ? fullName : fullName.split(' ')[0];

  return (
    <div className="screen-anim">
      <PageHead
        title={en ? "Profile" : "Profil"}
        description={en
          ? "Manage your RoStory profile, favorites, and account settings."
          : "Gestionează-ți profilul RoStory, favoritele și setările contului."}
        language={language}
      >
        <meta name="robots" content="noindex, nofollow" />
      </PageHead>

      <section className="ed-container" style={{ paddingTop: 'clamp(40px, 6vw, 64px)', paddingBottom: 56 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-7">
          {/* The reader's initial, or picture, in an arch. */}
          <div
            className="sb-arch grid place-items-center shrink-0"
            style={{ width: 112, height: 132, background: 'var(--glow)', border: '1px solid var(--gold-deep)', fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 52, color: 'var(--gold)' }}
          >
            {avatarUrl
              ? <img src={storageImage(avatarUrl, "avatar")} alt="" className="absolute inset-0 w-full h-full object-cover" />
              : <span aria-hidden="true">{initial}</span>}
          </div>
          <div className="flex flex-col gap-2">
            <p className="rs-eyebrow flex items-center gap-2.5 flex-wrap">
              {en ? 'Your profile' : 'Profilul tău'}
              <span className="sb-tag" style={{ padding: '4px 11px', background: 'transparent', color: 'var(--gold)' }}>
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="capitalize">{role}</span>
              </span>
            </p>
            <h1 className="rs-display break-words" style={{ fontSize: 'clamp(40px, 5vw, 76px)', lineHeight: 1 }}>
              {greetingName
                ? (en ? `Welcome back, ${greetingName}.` : `Bine ai revenit, ${greetingName}.`)
                : (en ? 'Welcome back.' : 'Bine ai revenit.')}
            </h1>
            <p className="m-0" style={{ fontFamily: 'var(--ui)', fontSize: 13, color: 'var(--text-mute)' }}>{t("profile.subtitle")}</p>
          </div>
          <dl className="flex gap-8 m-0 sm:ml-auto">
            <div>
              <dt style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--text-mute)' }}>{en ? 'Saved' : 'Păstrate'}</dt>
              <dd className="m-0 mt-0.5 font-display" style={{ fontSize: 40, lineHeight: 1, color: 'var(--gold-2)' }}>{isLoadingFavorites ? '·' : favorites.length}</dd>
            </div>
            <div>
              <dt style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--text-mute)' }}>{en ? 'Notes' : 'Note'}</dt>
              <dd className="m-0 mt-0.5 font-display" style={{ fontSize: 40, lineHeight: 1, color: 'var(--gold-2)' }}>{notes ? notes.length : '·'}</dd>
            </div>
          </dl>
        </div>
        <div role="tablist" aria-label={en ? 'Your profile' : 'Profilul tău'} className="rs-tabs" style={{ marginTop: 36 }}
          onKeyDown={(e) => {
            const order = ['shelf', 'notes', 'settings'] as const;
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const next = order[(order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
            setTab(next);
            requestAnimationFrame(() => document.getElementById(`profile-tab-${next}`)?.focus());
          }}
        >
          {([['shelf', en ? 'Your shelf' : 'Raftul tău'], ['notes', en ? 'Your notes' : 'Notele tale'], ['settings', en ? 'Settings' : 'Setări']] as const).map(([key, label]) => (
            <button
              key={key}
              id={`profile-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`profile-panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className="rs-tab"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="ed-container" style={{ paddingTop: 'clamp(36px, 5vw, 56px)' }}>
          {tab === 'settings' && (
          <div id="profile-panel-settings" role="tabpanel" aria-labelledby="profile-tab-settings" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <form onSubmit={handleUpdateProfile} className="sb-paper grid gap-5" style={{ padding: 'clamp(24px, 3vw, 34px)' }}>
              <h2 className="rs-display" style={{ fontSize: 28, letterSpacing: 0 }}>{en ? 'About you' : 'Despre tine'}</h2>

              <div className="sb-field">
                <span className="sb-label">{t("profile.avatar")}</span>
                <div className="flex items-center gap-3.5">
                  <Avatar className="h-14 w-14" style={{ border: '1px solid var(--line)' }}>
                    <AvatarImage src={storageImage(avatarUrl, "avatar")} alt="" />
                    <AvatarFallback className="font-display italic text-[26px]" style={{ background: 'var(--glow)', color: 'var(--gold)' }}>
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  {/* The label is the button: it opens the hidden file input. */}
                  <label
                    htmlFor="avatar-upload"
                    className="sb-btn sb-btn-ghost"
                    style={isUploading ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                  >
                    {isUploading ? <Loader2 className="sb-ico animate-spin" aria-hidden="true" /> : <Camera className="sb-ico" aria-hidden="true" />}
                    {en ? 'Upload a picture' : 'Încarcă o fotografie'}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                  />
                </div>
              </div>

              <div className="sb-field">
                <label htmlFor="displayName" className="sb-label">{t("profile.displayName")}</label>
                <input
                  id="displayName"
                  className="sb-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("profile.displayName")}
                  maxLength={100}
                />
              </div>

              <div className="sb-field">
                <div className="flex justify-between items-center gap-3">
                  <label htmlFor="email" className="sb-label">{t("profile.email")}</label>
                  {user.emailVerified ? (
                    <span className="sb-meta flex items-center gap-1" style={{ color: 'var(--gold)' }}>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {en ? 'Verified' : 'Verificat'}
                    </span>
                  ) : (
                    <span className="sb-meta flex items-center gap-1" style={{ color: 'var(--danger)' }}>
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {en ? 'Unverified' : 'Neverificat'}
                    </span>
                  )}
                </div>
                <input id="email" className="sb-input" value={user.email} readOnly style={{ color: 'var(--text-dim)' }} />
              </div>

              <button type="submit" className="sb-btn justify-self-start" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="sb-ico animate-spin" aria-hidden="true" />
                    {t("profile.updating")}
                  </>
                ) : (
                  t("profile.update")
                )}
              </button>
            </form>

            <div className="grid gap-3" style={{ border: '1px dashed var(--gold-deep)', borderRadius: 20, padding: '24px 28px' }}>
              <h2 className="rs-display" style={{ fontSize: 28, letterSpacing: 0 }}>{en ? 'Your data' : 'Datele tale'}</h2>
              <p className="sb-dim text-[16px] leading-relaxed">
                {en
                  ? 'Download a JSON copy of your account, profile, articles, comments, and favorites — or close your account for good.'
                  : 'Descarcă o copie JSON a contului, profilului, articolelor, comentariilor și favoritelor tale — sau închide contul definitiv.'}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className="sb-btn sb-btn-ghost" onClick={handleExportData} disabled={isExporting}>
                  {isExporting
                    ? <Loader2 className="sb-ico animate-spin" aria-hidden="true" />
                    : <Download className="sb-ico" aria-hidden="true" />}
                  {isExporting
                    ? (en ? 'Preparing…' : 'Se pregătește…')
                    : (en ? 'Download my data' : 'Descarcă datele mele')}
                </button>
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <button type="button" className="sb-btn sb-btn-ghost sb-btn-danger">
                      <Trash2 className="sb-ico" aria-hidden="true" />
                      {en ? 'Delete my account' : 'Șterge contul meu'}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 24 }}>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="sb-h3" style={{ fontSize: 30, color: 'var(--danger)' }}>
                        {en ? 'Delete Account?' : 'Ștergi Contul?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-[16px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                        {/* Spells out the cascade (migration 20260511000000):
                            deleting the account also deletes every story and
                            comment written under it. Worth naming before an
                            irreversible action — "all your data" was too
                            vague for a writer with published work. */}
                        {en
                          ? 'This permanently deletes your account and everything published under it — your stories, comments, favorites, and profile. Consider exporting your data first. This cannot be undone.'
                          : 'Aceasta șterge permanent contul tău și tot ce ai publicat — poveștile, comentariile, favoritele și profilul. Ia în calcul exportarea datelor mai întâi. Acțiunea nu poate fi anulată.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting} className="rounded-full">
                        {en ? 'Cancel' : 'Anulează'}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {en ? 'Deleting...' : 'Se șterge...'}
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {en ? 'Delete Account' : 'Șterge Contul'}
                          </>
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
          )}

          {/* The shelf: /profile and /profile?tab=favorites (the account
              menu's links) open here. */}
          {tab === 'shelf' && (
          <section id="profile-panel-shelf" role="tabpanel" aria-labelledby="profile-tab-shelf" className="flex flex-col gap-7">
            <div className="flex flex-wrap justify-between items-end gap-4">
              <div className="flex flex-col gap-2">
                <h2 id="shelf-title" className="rs-display" style={{ fontSize: 'clamp(32px, 3.4vw, 48px)', lineHeight: 1 }}>
                  {en ? 'The stories you saved.' : 'Poveștile pe care le-ai păstrat.'}
                </h2>
              </div>
              {!isLoadingFavorites && favorites.length > 0 && (
                <p className="sb-meta">{en ? `${favorites.length} saved` : `${favorites.length} păstrate`}</p>
              )}
            </div>

            {!isLoadingFavorites && favoritesLoadError && favorites.length > 0 && (
              <p role="alert" className="font-display italic m-0" style={{ fontSize: 17, color: 'var(--danger)' }}>
                {favoritesLoadError}
              </p>
            )}

            {isLoadingFavorites ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className="sb-frame animate-pulse" style={{ aspectRatio: '4/5' }} />
                ))}
              </div>
            ) : favoritesLoadError && favorites.length === 0 ? (
              <LoadError message={favoritesLoadError} onRetry={loadFavorites} />
            ) : favorites.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8 gap-y-12">
                {favorites.map((article) => (
                  <motion.div
                    key={article.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <StoryCard
                      article={article}
                      category={categoryMap.get(article.categoryId)}
                      language={language}
                      size="md"
                      linkState={FAVORITES_LINK_STATE}
                      isArticleFavorited={isFavorited(article.id)}
                      onFavoriteToggle={handleFavoriteToggle}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-16 px-6 text-center flex flex-col items-center gap-5" style={{ border: '1px dashed var(--line)', borderRadius: 24 }}>
                <Heart className="w-8 h-8" style={{ color: 'var(--gold)', opacity: 0.6 }} aria-hidden="true" />
                <p className="font-display italic text-2xl sb-dim">
                  {en ? 'Your shelf is still empty.' : 'Raftul tău e încă gol.'}
                </p>
                <p className="sb-dim text-[16px] max-w-[420px]">
                  {en
                    ? 'Tap the heart on any story to keep it here.'
                    : 'Apasă inima de pe orice poveste ca s-o păstrezi aici.'}
                </p>
                <Link to="/categories" className="sb-btn sb-btn-ghost mt-2">
                  {en ? 'Explore stories' : 'Explorează poveștile'}
                </Link>
              </div>
            )}
          </section>
          )}

          {tab === 'notes' && (
            <section id="profile-panel-notes" role="tabpanel" aria-labelledby="profile-tab-notes" style={{ maxWidth: 820 }}>
              {notes === null ? (
                <p className="m-0 font-display italic" style={{ fontSize: 20, color: 'var(--text-dim)' }}>{en ? 'Gathering your notes…' : 'Îți adunăm notele…'}</p>
              ) : notes.length === 0 ? (
                <div className="py-16 px-6 text-center" style={{ border: '1px dashed var(--gold-deep)', borderRadius: 24 }}>
                  <p className="m-0 mb-2 font-display italic" style={{ fontSize: 30, color: 'var(--parchment)' }}>{en ? 'No notes yet.' : 'Încă nicio notă.'}</p>
                  <p className="m-0" style={{ fontSize: 17, color: 'var(--text-dim)' }}>
                    {en ? 'A note you leave under a story will be kept here.' : 'O notă lăsată sub o poveste va fi păstrată aici.'}
                  </p>
                </div>
              ) : (
                notes.map((n) => (
                  <article key={n.id} style={{ padding: '22px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <p className="m-0 mb-1.5" style={{ fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600, color: 'var(--text-mute)' }}>
                      {formatArticleDate(n.createdAt, language, 'short')}
                      {n.article && (
                        <>
                          {' · '}{en ? 'on' : 'la'}{' '}
                          <Link to={`/article/${n.article.id}`} className="rs-underline">{getLocalized(n.article, 'title', language)}</Link>
                        </>
                      )}
                    </p>
                    <p className="m-0" style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                  </article>
                ))
              )}
            </section>
          )}
      </section>
    </div>
  );
};

// See components/ui/reduced-motion-config.tsx — keeps framer-motion in this
// lazy chunk rather than the app entry point.
const ProfilePage: React.FC = () => (
  <ReducedMotionConfig>
    <Profile />
  </ReducedMotionConfig>
);

export default ProfilePage;
