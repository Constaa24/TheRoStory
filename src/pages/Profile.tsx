import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useSearchParams, Navigate, useNavigate } from "react-router-dom";
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
import { Article, getLocalized } from "@/lib/supabase";
import { fetchUserFavorites, toggleFavorite, deleteOwnAccount, supabase } from "@/lib/supabase";
import { isAbortError } from "@/lib/utils";
import { Camera, Loader2, Shield, Heart, ChevronRight, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { ParchmentArticle } from "@/components/organisms/ParchmentArticle";
import { AnimatePresence, motion } from "framer-motion";

const Profile: React.FC = () => {
  const { user, role, refreshUser, logout } = useAuth();
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
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

    try {
      const added = await toggleFavorite(user.id, articleId);
      if (!added) {
        setFavorites(prev => prev.filter(a => a.id !== articleId));
        toast.success(language === 'en' ? "Removed from favorites" : "Eliminat de la favorite");
      }
    } catch {
      toast.error(language === 'en' ? "Failed to update favorites" : "Eroare la actualizarea favoritelor");
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

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'en' ? "Please select a valid image file" : "Te rugăm să selectezi un fișier imagine valid");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'en' ? "Image must be under 5MB" : "Imaginea trebuie să fie sub 5MB");
      return;
    }

    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast.error(language === 'en' ? "Only JPG, PNG, and WebP images are allowed" : "Doar imagini JPG, PNG și WebP sunt permise");
      return;
    }

    setIsUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Update profile — clean up uploaded file if this fails
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        // Fire-and-forget cleanup — don't await so profileError always propagates
        supabase.storage.from('avatars').remove([path]).catch(() => {});
        throw profileError;
      }
      
      // Refresh user data and update local state
      await refreshUser();
      if (!isMountedRef.current) return;
      setAvatarUrl(publicUrl);
      toast.success(t("profile.success"));
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error(t("profile.error"));
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="space-y-8">
        <div className="flex justify-center">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-full p-1 h-12 bg-secondary/30 backdrop-blur-sm border border-border/40">
            <TabsTrigger value="profile" className="rounded-full text-base font-serif italic">
              {t("profile.title")}
            </TabsTrigger>
            <TabsTrigger value="favorites" className="rounded-full text-base font-serif italic gap-2">
              <Heart className="h-4 w-4" />
              {language === 'en' ? 'Favorites' : 'Favorite'}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-border/40 bg-secondary/20 backdrop-blur-sm max-w-2xl mx-auto">
            <CardHeader className="text-center relative">
              <div className="absolute top-6 right-6">
                <Badge variant="outline" className="gap-1.5 py-1 px-3 border-accent/30 bg-accent/5">
                  <Shield className="h-3.5 w-3.5 text-accent" />
                  <span className="capitalize font-serif italic text-accent">{role}</span>
                </Badge>
              </div>
              <CardTitle className="text-3xl font-serif font-bold text-primary">
                {t("profile.title")}
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
                    <AvatarImage src={avatarUrl} alt={displayName || user.email || ''} />
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
                          {language === 'en'
                            ? 'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.'
                            : 'Ești sigur că vrei să ștergi permanent contul tău? Această acțiune nu poate fi anulată și toate datele tale vor fi pierdute.'}
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
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-serif font-bold text-primary italic">
                {language === 'en' ? 'Your Favorite Stories' : 'Poveștile tale favorite'}
              </h2>
              <p className="text-muted-foreground font-serif italic">
                {language === 'en' 
                  ? 'A collection of pieces that touched your heart.' 
                  : 'O colecție de povești care ți-au atins inima.'}
              </p>
            </div>

            {!isLoadingFavorites && favoritesLoadError && favorites.length > 0 && (
              <Card className="border-destructive/20 bg-destructive/5 p-4 text-center text-destructive font-serif italic">
                {favoritesLoadError}
              </Card>
            )}

            {isLoadingFavorites ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-48 rounded-2xl bg-secondary/40 animate-pulse" />
                ))}
              </div>
            ) : favoritesLoadError && favorites.length === 0 ? (
              <Card className="border-destructive/20 bg-destructive/5 p-12 text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto opacity-70" />
                <p className="text-lg font-serif italic text-destructive">
                  {favoritesLoadError}
                </p>
                <Button variant="outline" className="rounded-full font-serif italic" onClick={loadFavorites}>
                  {language === 'en' ? 'Try Again' : 'Încearcă din nou'}
                </Button>
              </Card>
            ) : favorites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {favorites.map((article) => (
                  <motion.div
                    key={article.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card 
                      className="group overflow-hidden border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 bg-secondary/10 cursor-pointer h-full flex flex-col"
                      onClick={() => setActiveArticle(article)}
                    >
                      <div className="flex h-full">
                        <div className="w-1/3 aspect-square overflow-hidden relative">
                          <img
                            src={(article.type === 'video' ? article.posterUrl || article.mediaUrl : article.mediaUrl) || "https://images.unsplash.com/photo-1701118737005-005fc66703be?q=80&w=400"}
                            alt={getLocalized(article, "title", language)}
                            className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          <div className="space-y-1">
                            <h3 className="text-lg font-serif font-bold text-primary line-clamp-2 leading-tight">
                              {getLocalized(article, "title", language)}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 italic font-serif">
                              {getLocalized(article, "content", language).substring(0, 80)}...
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <Button variant="link" size="sm" className="p-0 h-auto text-accent gap-1 text-xs uppercase tracking-wider font-bold">
                              {t("articles.readMore")} <ChevronRight className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50/50"
                              onClick={(e) => handleFavoriteToggle(e, article.id)}
                            >
                              <Heart className="h-4 w-4 fill-current" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-border/40 bg-secondary/5 p-12 text-center space-y-4">
                <Heart className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
                <p className="text-lg font-serif italic text-muted-foreground">
                  {language === 'en' 
                    ? "You haven't favorited any stories yet." 
                    : "Nu ai salvat încă nicio poveste la favorite."}
                </p>
                <Button variant="outline" className="rounded-full font-serif italic" asChild>
                  <a href="/categories">{language === 'en' ? 'Explore Stories' : 'Explorează Poveștile'}</a>
                </Button>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Parchment Article Viewer */}
      <AnimatePresence>
        {activeArticle && (
          <ParchmentArticle 
            article={activeArticle} 
            onClose={() => setActiveArticle(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
