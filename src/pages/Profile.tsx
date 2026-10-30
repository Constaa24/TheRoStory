import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useSearchParams, Navigate, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Article, Category } from "@/lib/supabase";
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
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Sync state with user data when user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === "favorites") {
      loadFavorites();
    }
    // loadFavorites is defined inline in this component and stable enough
    // for our purposes; the effect should re-run only when user/tab change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab]);

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

  return (
    <div className="screen-anim pb-20">
      <section style={{ padding: '60px 0 32px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <div className="eyebrow mb-3">{language === 'en' ? 'Account' : 'Cont'}</div>
          <h1 className="font-display italic font-medium m-0" style={{ fontSize: 'clamp(48px, 7vw, 96px)', lineHeight: 0.95, letterSpacing: '-0.01em', color: 'var(--parchment)' }}>
            {language === 'en' ? 'Your profile.' : 'Profilul tău.'}
          </h1>
        </div>
      </section>
    <div className="ed-container py-12 max-w-4xl">
      <PageHead
        title={language === "en" ? "Profile" : "Profil"}
        description={language === "en"
          ? "Manage your RoStory profile, favorites, and account settings."
          : "Gestionează-ți profilul RoStory, favoritele și setările contului."}
        language={language}
      >
        <meta name="robots" content="noindex, nofollow" />
      </PageHead>
      <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="space-y-8">
        <div className="flex justify-center">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-full p-1 h-12 bg-[color:var(--ink)]/40 backdrop-blur-sm border border-line">
            <TabsTrigger value="profile" className="rounded-full text-base font-display italic data-[state=active]:bg-[color:var(--gold)] data-[state=active]:text-[color:var(--ink)]">
              {t("profile.title")}
            </TabsTrigger>
            <TabsTrigger value="favorites" className="rounded-full text-base font-display italic gap-2 data-[state=active]:bg-[color:var(--gold)] data-[state=active]:text-[color:var(--ink)]">
              <Heart className="h-4 w-4" />
              {language === 'en' ? 'Favorites' : 'Favorite'}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border border-line shadow-2xl bg-[color:var(--ink-2)]/60 backdrop-blur-sm max-w-2xl mx-auto rounded-sm p-4 md:p-8">
            <CardHeader className="text-center relative">
              <div className="absolute top-6 right-6">
                <Badge variant="outline" className="gap-1.5 py-1 px-3 border-accent/30 bg-accent/5">
                  <Shield className="h-3.5 w-3.5 text-accent" />
                  <span className="capitalize font-serif italic text-accent">{role}</span>
                </Badge>
              </div>
              <CardTitle className="text-3xl font-display italic text-[color:var(--parchment)]">
                {language === 'en' ? 'Account details' : 'Detalii cont'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("profile.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                    <AvatarImage src={storageImage(avatarUrl, "avatar")} alt={displayName || user.email || ''} />
                    <AvatarFallback className="text-4xl font-serif bg-accent/10 text-accent">
                      {displayName?.charAt(0) || user.email?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <label 
                    htmlFor="avatar-upload" 
                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <Camera className="h-8 w-8" />
                    )}
                  </label>
                  <input 
                    id="avatar-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{t("profile.avatar")}</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t("profile.displayName")}</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("profile.displayName")}
                    className="bg-background/50"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("profile.email")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      value={user.email}
                      disabled
                      className="bg-muted text-muted-foreground flex-1"
                    />
                    {user.emailVerified ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 px-3">
                        <CheckCircle2 className="h-3 w-3" />
                        {language === 'en' ? 'Verified' : 'Verificat'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 px-3">
                        <AlertCircle className="h-3 w-3" />
                        {language === 'en' ? 'Unverified' : 'Neverificat'}
                      </Badge>
                    )}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full rounded-full h-12 text-lg font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("profile.updating")}
                    </>
                  ) : (
                    t("profile.update")
                  )}
                </Button>
              </form>

              {/* Export My Data */}
              <div className="pt-6 border-t border-border/50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold">
                      {language === 'en' ? 'Export My Data' : 'Exportă datele mele'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {language === 'en'
                        ? 'Download a JSON copy of your account, profile, articles, comments, and favorites.'
                        : 'Descarcă o copie JSON a contului, profilului, articolelor, comentariilor și favoritelor tale.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="rounded-full"
                  >
                    {isExporting ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-3.5 w-3.5" />
                    )}
                    {isExporting
                      ? (language === 'en' ? 'Preparing...' : 'Se pregătește...')
                      : (language === 'en' ? 'Download JSON' : 'Descarcă JSON')}
                  </Button>
                </div>
              </div>

              {/* Delete Account */}
              <div className="pt-6 border-t border-destructive/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-destructive">
                      {language === 'en' ? 'Delete Account' : 'Șterge Contul'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {language === 'en'
                        ? 'Permanently delete your account and all associated data.'
                        : 'Șterge permanent contul tău și toate datele asociate.'}
                    </p>
                  </div>
                  <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-colors"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        {language === 'en' ? 'Delete Account' : 'Șterge Contul'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                          {language === 'en' ? 'Delete Account?' : 'Ștergi Contul?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {/* Spells out the cascade (migration 20260511000000):
                              deleting the account also deletes every story and
                              comment written under it. Worth naming before an
                              irreversible action — "all your data" was too
                              vague for a writer with published work. */}
                          {language === 'en'
                            ? 'This permanently deletes your account and everything published under it — your stories, comments, favorites, and profile. Consider exporting your data first. This cannot be undone.'
                            : 'Aceasta șterge permanent contul tău și tot ce ai publicat — poveștile, comentariile, favoritele și profilul. Ia în calcul exportarea datelor mai întâi. Acțiunea nu poate fi anulată.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                          {language === 'en' ? 'Cancel' : 'Anulează'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          disabled={isDeleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {language === 'en' ? 'Deleting...' : 'Se șterge...'}
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {language === 'en' ? 'Delete Account' : 'Șterge Contul'}
                            </>
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="favorites" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* In the archive's own visual language. This tab used to look like
              a different site — 2rem-rounded cards, bold serif titles, bright
              red hearts — so saved stories looked nothing like the cards they
              were saved from. It reuses StoryCard and the editorial states
              (LoadError, the dashed empty panel) the archive pages use. */}
          <div className="space-y-12">
            <div className="text-center">
              <div className="eyebrow mb-3">{language === 'en' ? 'Saved stories' : 'Povești salvate'}</div>
              <h2
                className="font-display italic font-medium m-0"
                style={{ fontSize: 'clamp(32px, 4vw, 48px)', lineHeight: 1.05, color: 'var(--parchment)' }}
              >
                {language === 'en' ? 'Your favorite stories.' : 'Poveștile tale favorite.'}
              </h2>
              <p className="font-display italic text-ink-dim mt-3 mb-0" style={{ fontSize: 18 }}>
                {language === 'en'
                  ? 'A collection of pieces that touched your heart.'
                  : 'O colecție de povești care ți-au atins inima.'}
              </p>
            </div>

            {!isLoadingFavorites && favoritesLoadError && favorites.length > 0 && (
              <p role="alert" className="font-display italic text-center m-0" style={{ fontSize: 17, color: 'var(--oxblood-2)' }}>
                {favoritesLoadError}
              </p>
            )}

            {isLoadingFavorites ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse" style={{ aspectRatio: '3/4', border: '1px solid var(--line)', background: 'var(--ink-2)' }} />
                ))}
              </div>
            ) : favoritesLoadError && favorites.length === 0 ? (
              <LoadError message={favoritesLoadError} onRetry={loadFavorites} />
            ) : favorites.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 gap-y-16">
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
              <div className="py-20 px-6 text-center" style={{ border: '1px dashed var(--line)' }}>
                <Heart className="w-8 h-8 mx-auto mb-5" style={{ color: 'var(--gold)', opacity: 0.6 }} aria-hidden="true" />
                <p className="font-display italic text-2xl text-ink-dim m-0">
                  {language === 'en'
                    ? "You haven't favorited any stories yet."
                    : "Nu ai salvat încă nicio poveste la favorite."}
                </p>
                <Link to="/categories" className="btn-ed btn-ed-ghost mt-8">
                  {language === 'en' ? 'Explore stories' : 'Explorează poveștile'}
                </Link>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
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
