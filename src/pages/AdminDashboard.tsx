import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Category,
  Article,
  AdminUserSummary,
  getLocalized,
  CHAPTER_DELIMITER,
  fetchPublicContent,
  invalidatePublicContentCache,
  fetchAllUsers,
  deleteUser as deleteUserFunc,
  updateUserRole as updateUserRoleFunc,
  uploadUserFile,
  ARTICLE_LIMITS
} from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit, Image as ImageIcon, Check, X, Loader2, Lock, Users, FileText, Tag, ShieldCheck, CheckCircle2, XCircle, Video, BookText, Images } from "lucide-react";
import { toast } from "sonner";
import { cn, isAbortError } from "@/lib/utils";
import { COUNTIES } from "@/lib/constants";
import { createVideoPosterImageFile } from "@/lib/video-poster";
import { useNavigate } from "react-router-dom";

const combineChapters = (chapters: string[]): string => {
  // Find the last index that has any non-whitespace content. If every chapter
  // is empty we return an empty string — the caller should treat that as
  // "no content" rather than persisting a single empty chunk.
  let lastIndex = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i]?.trim()) lastIndex = i;
  }
  if (lastIndex === -1) return "";
  return chapters.slice(0, lastIndex + 1).join(CHAPTER_DELIMITER);
};

const USERS_PER_PAGE = 25;

const AdminDashboard: React.FC = () => {
  const { user, isAdmin, isWriter } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState<number | null>(null);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editCarouselImageInputRef = useRef<HTMLInputElement>(null);
  const editPosterInputRef = useRef<HTMLInputElement>(null);

  // Confirmation dialog state — replaces the inconsistent native confirm()
  // calls so destructive actions feel like the rest of the app.
  type ConfirmConfig = {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void | Promise<void>;
  };
  const [confirmDialog, setConfirmDialog] = useState<ConfirmConfig | null>(null);
  // While the destructive action is in flight, both buttons disable so a
  // user can't spam-click and dispatch N parallel deletes.
  const [isConfirming, setIsConfirming] = useState(false);

  // Form states
  const [newCategory, setNewCategory] = useState({ nameEn: "", nameRo: "", slug: "" });

  // Indexed lookup so the article tables don't .find() per row.
  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Fetch categories and articles when user/role changes
  useEffect(() => {
    if (!user || (!isAdmin && !isWriter)) return;
    let cancelled = false;
    invalidatePublicContentCache();
    fetchPublicContent(false)
      .then((data) => {
        if (cancelled) return;
        setCategories(data.categories);
        const filteredArticles = isWriter
          ? data.articles.filter((a: Article) => a.userId === user?.id)
          : data.articles;
        setArticles(filteredArticles);
      })
      .catch((error) => {
        if (!isAbortError(error)) console.error("Error fetching content:", error);
      });
    return () => { cancelled = true; };
    // Tracking user.id rather than user prevents re-fetching when the user
    // object identity changes but the same user is still logged in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, isWriter]);

  // Fetch users separately so pagination doesn't re-fetch content
  useEffect(() => {
    if (!user || !isAdmin) {
      setAllUsers([]);
      setUsersTotal(null);
      setUsersHasMore(false);
      return;
    }
    let cancelled = false;
    setUsersLoadError(null);
    fetchAllUsers(usersPage, USERS_PER_PAGE)
      .then((usersPageData) => {
        if (cancelled) return;
        setAllUsers(usersPageData.users || []);
        setUsersTotal(usersPageData.total);
        setUsersHasMore(usersPageData.hasMore);
        setUsersLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAllUsers([]);
        setUsersTotal(null);
        setUsersHasMore(false);
        const message = error instanceof Error ? error.message : "Failed to load users";
        setUsersLoadError(message);
        toast.error(t("admin.users.errLoad"));
      });
    return () => { cancelled = true; };
    // user.id is stable across renders; language is read at error-toast time
    // and we don't want to re-fetch the user list just because it switched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, usersPage]);

  const fetchData = async () => {
    invalidatePublicContentCache();
    try {
      const data = await fetchPublicContent(false);
      setCategories(data.categories);
      const filteredArticles = isWriter
        ? data.articles.filter((a: Article) => a.userId === user?.id)
        : data.articles;
      setArticles(filteredArticles);
    } catch (error) {
      if (!isAbortError(error)) console.error("Error fetching data:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.nameEn || !newCategory.nameRo || !newCategory.slug) {
      toast.error(t("admin.categories.fillAll"));
      return;
    }
    if (!/^[a-z0-9-]+$/.test(newCategory.slug)) {
      toast.error(t("admin.categories.slugHint"));
      return;
    }
    try {
      const id = `cat_${crypto.randomUUID()}`;
      const { error } = await supabase.from('categories').insert({
        id,
        name_en: newCategory.nameEn.trim(),
        name_ro: newCategory.nameRo.trim(),
        slug: newCategory.slug
      });
      if (error) throw error;
      setNewCategory({ nameEn: "", nameRo: "", slug: "" });
      fetchData();
      toast.success(t("admin.categories.added"));
    } catch {
      toast.error(t("admin.categories.errAdd"));
    }
  };

  const handleUpdateArticle = async () => {
    if (!editingArticle || !editingArticle.titleEn || !editingArticle.titleRo || !editingArticle.categoryId) {
      toast.error(t("admin.articles.fillRequired"));
      return;
    }
    try {
      const titleEn = editingArticle.titleEn.trim();
      const titleRo = editingArticle.titleRo.trim();
      const contentEn = (editingArticle.type === 'video' || editingArticle.type === 'carousel')
        ? editingArticle.contentEn
        : combineChapters(editingArticle.chaptersEn || [""]);
      const contentRo = (editingArticle.type === 'video' || editingArticle.type === 'carousel')
        ? editingArticle.contentRo
        : combineChapters(editingArticle.chaptersRo || [""]);

      // Mirror the createArticle limits — the DB has length CHECKs that
      // would otherwise raise a confusing constraint-violation error.
      if (titleEn.length > ARTICLE_LIMITS.TITLE_MAX || titleRo.length > ARTICLE_LIMITS.TITLE_MAX) {
        throw new Error(t("admin.articles.errTitleTooLong").replace("{max}", String(ARTICLE_LIMITS.TITLE_MAX)));
      }
      if ((contentEn || "").length > ARTICLE_LIMITS.CONTENT_MAX || (contentRo || "").length > ARTICLE_LIMITS.CONTENT_MAX) {
        throw new Error(t("admin.articles.errContentTooLong").replace("{max}", String(ARTICLE_LIMITS.CONTENT_MAX)));
      }
      // For text stories, refuse to save an article with no chapter content —
      // combineChapters() returns "" when every chapter is blank, and a
      // story with no body shouldn't be persistable from the dashboard.
      if (editingArticle.type === 'text' && !contentEn?.trim() && !contentRo?.trim()) {
        throw new Error(t("admin.common.contentRequired"));
      }
      if (editingArticle.location && editingArticle.location.length > ARTICLE_LIMITS.LOCATION_MAX) {
        throw new Error(t("admin.articles.errLocationTooLong").replace("{max}", String(ARTICLE_LIMITS.LOCATION_MAX)));
      }
      if (editingArticle.mediaUrls && editingArticle.mediaUrls.length > ARTICLE_LIMITS.MEDIA_URLS_MAX) {
        throw new Error(t("admin.articles.errTooManyGalleryImages").replace("{max}", String(ARTICLE_LIMITS.MEDIA_URLS_MAX)));
      }
      // A carousel without images would render the Unsplash placeholder
      // on Home and CategoryDetail. Refuse to persist that state.
      if (editingArticle.type === 'carousel' && (!editingArticle.mediaUrls || editingArticle.mediaUrls.length === 0)) {
        throw new Error(t("admin.articles.carouselRequiresImages"));
      }

      const updates: Record<string, unknown> = {
        title_en: titleEn,
        title_ro: titleRo,
        content_en: contentEn,
        content_ro: contentRo,
        category_id: editingArticle.categoryId,
        location: editingArticle.location || null,
        media_url: editingArticle.mediaUrl,
        poster_url: editingArticle.posterUrl || null,
        media_urls: editingArticle.mediaUrls,
      };

      if (isAdmin) {
        updates.is_published = !!editingArticle.isPublished;
      }

      const { error } = await supabase
        .from('articles')
        .update(updates)
        .eq('id', editingArticle.id);

      if (error) throw error;

      setEditingArticle(null);
      fetchData();
      toast.success(t("admin.articles.updated"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.articles.errUpdate");
      toast.error(message);
    }
  };

  const togglePublish = async (article: Article) => {
    if (!isAdmin) {
      toast.error(t("admin.articles.adminOnlyPublish"));
      return;
    }
    try {
      const newValue = !article.isPublished;
      const { error } = await supabase
        .from('articles')
        .update({ is_published: newValue })
        .eq('id', article.id);

      if (error) throw error;
      fetchData();
      toast.success(newValue ? t("admin.articles.publishedToast") : t("admin.articles.unpublishedToast"));
    } catch {
      toast.error(t("admin.articles.errUpdate"));
    }
  };

  const performDeleteArticle = async (id: string) => {
    try {
      const { error } = await supabase.from('articles').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      toast.success(t("admin.articles.deleted"));
    } catch {
      toast.error(t("admin.articles.errDelete"));
    }
  };

  const requestDeleteArticle = (id: string) => {
    setConfirmDialog({
      title: t("admin.articles.deleteTitle"),
      description: t("admin.articles.deleteDesc"),
      confirmLabel: t("admin.common.delete"),
      cancelLabel: t("admin.common.cancel"),
      onConfirm: () => performDeleteArticle(id),
    });
  };

  const performDeleteUser = async (id: string) => {
    try {
      const success = await deleteUserFunc(id);
      if (!success) throw new Error("Failed to delete user");
      // Always trigger a refetch — either by stepping the page or by
      // invalidating the current page. Stale local total/page caches were
      // the source of off-by-one rows after delete.
      if (allUsers.length === 1 && usersPage > 1) {
        setUsersPage(prev => Math.max(1, prev - 1));
      } else {
        setAllUsers(prev => prev.filter(u => u.id !== id));
        setUsersTotal(prev => prev !== null ? prev - 1 : null);
        // Refetch the current page so usersHasMore / range counts realign.
        const refetched = await fetchAllUsers(usersPage, USERS_PER_PAGE).catch(() => null);
        if (refetched) {
          setAllUsers(refetched.users || []);
          setUsersTotal(refetched.total);
          setUsersHasMore(refetched.hasMore);
        }
        fetchData();
      }
      toast.success(t("admin.users.deleted"));
    } catch {
      toast.error(t("admin.users.errDelete"));
    }
  };

  const requestDeleteUser = (id: string) => {
    if (!isAdmin) return;
    if (id === user?.id) {
      toast.error(t("admin.users.deleteSelf"));
      return;
    }
    setConfirmDialog({
      title: t("admin.users.deleteTitle"),
      description: t("admin.users.deleteDesc"),
      confirmLabel: t("admin.common.delete"),
      cancelLabel: t("admin.common.cancel"),
      onConfirm: () => performDeleteUser(id),
    });
  };

  const requestDeleteCategory = (catId: string) => {
    setConfirmDialog({
      title: t("admin.categories.deleteTitle"),
      description: t("admin.categories.deleteDesc"),
      confirmLabel: t("admin.categories.confirm"),
      cancelLabel: t("admin.common.cancel"),
      onConfirm: async () => {
        const { error } = await supabase.from('categories').delete().eq('id', catId);
        if (error) {
          toast.error(t("admin.categories.errDelete"));
          return;
        }
        fetchData();
        toast.success(t("admin.categories.deleted"));
      },
    });
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!isAdmin) return;
    
    try {
      const success = await updateUserRoleFunc(userId, newRole);
      if (!success) throw new Error("Failed to update role");
      
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: newRole as AdminUserSummary['role'] } : u));
      toast.success(t("admin.users.roleUpdated"));
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error(t("admin.users.errRoleUpdate"));
    }
  };

  const handleCarouselImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user?.id) {
      toast.error(t("admin.common.notAuthenticated"));
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const { publicUrl } = await uploadUserFile(file, {
        bucket: 'articles',
        kind: 'image',
        userId: user.id,
        subfolder: 'carousels',
      });

      if (editingArticle) {
        const currentUrls = editingArticle.mediaUrls || [];
        const newUrls = [...currentUrls, publicUrl];
        setEditingArticle({
          ...editingArticle,
          mediaUrls: newUrls,
          mediaUrl: editingArticle.mediaUrl || publicUrl // Set first if none
        });
      }
      toast.success(t("admin.common.imageUploaded"));
    } catch (error) {
      console.error("Error uploading image:", error);
      const message = error instanceof Error ? error.message : t("admin.common.errUpload");
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const removeCarouselImage = (index: number) => {
    if (!editingArticle) return;
    const currentUrls = editingArticle.mediaUrls || [];
    const newUrls = currentUrls.filter((_, i) => i !== index);
    setEditingArticle({ 
      ...editingArticle, 
      mediaUrls: newUrls,
      mediaUrl: newUrls.length > 0 ? newUrls[0] : "" // Update main mediaUrl
    });
  };

  const usersRangeStart = allUsers.length === 0 ? 0 : (usersPage - 1) * USERS_PER_PAGE + 1;
  const usersRangeEnd = allUsers.length === 0 ? 0 : usersRangeStart + allUsers.length - 1;

  if (!isAdmin && !isWriter) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-serif italic mb-2">{t("admin.access.restricted")}</h1>
        <p className="text-muted-foreground">{t("admin.access.noPermission")}</p>
        <Button className="mt-6 rounded-full" onClick={() => window.location.href = "/"}>{t("admin.access.backHome")}</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 pt-28 pb-8 sm:pt-32 sm:pb-12 max-w-6xl animate-fade-in">
      <header className="mb-8 sm:mb-12 space-y-4">
        <h1 className="text-2xl sm:text-4xl font-serif font-black text-primary italic">
          {t("admin.title")}
        </h1>
        <div className="h-1 w-32 bg-accent" />
      </header>

      <Tabs defaultValue="articles" className="space-y-8">
        <TabsList className="bg-secondary/50 p-1 rounded-xl sm:rounded-full flex flex-wrap gap-1 w-full sm:w-auto h-auto">
          <TabsTrigger value="articles" className="rounded-full px-4 sm:px-8 flex gap-1 sm:gap-2 text-xs sm:text-sm" aria-label={isWriter ? t("admin.tabs.myStories") : t("admin.tabs.articles")}>
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden xs:inline">{isWriter ? t("admin.tabs.myStories") : t("admin.tabs.articles")}</span><span className="xs:hidden">{t("admin.tabs.stories")}</span>
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="categories" className="rounded-full px-4 sm:px-8 flex gap-1 sm:gap-2 text-xs sm:text-sm" aria-label={t("admin.tabs.categories")}>
                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">{t("admin.tabs.categories")}</span><span className="sm:hidden">{t("admin.tabs.categoriesShort")}</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-full px-4 sm:px-8 flex gap-1 sm:gap-2 text-xs sm:text-sm" aria-label={t("admin.tabs.users")}>
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.users")}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="rounded-full px-4 sm:px-8 flex gap-1 sm:gap-2 text-xs sm:text-sm" aria-label={t("admin.tabs.permissions")}>
                <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">{t("admin.tabs.permissions")}</span><span className="sm:hidden">{t("admin.tabs.permissionsShort")}</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="permissions" className="space-y-6">
          <div className="flex flex-col gap-4">
          <h2 className="text-xl sm:text-2xl font-serif italic text-secondary-foreground">{t("admin.permissions.heading")}</h2>
            <p className="text-muted-foreground">{t("admin.permissions.subheading")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                role: t("admin.permissions.role.guest"),
                icon: <Users className="h-6 w-6 text-muted-foreground" />,
                description: t("admin.permissions.role.guestDesc"),
                permissions: [
                  { label: t("admin.permissions.perm.browseCategories"), allowed: true },
                  { label: t("admin.permissions.perm.readPublished"), allowed: true },
                  { label: t("admin.permissions.perm.supportContact"), allowed: true },
                  { label: t("admin.permissions.perm.favoriteStories"), allowed: false },
                  { label: t("admin.permissions.perm.createStories"), allowed: false },
                  { label: t("admin.permissions.perm.manageSystem"), allowed: false },
                ]
              },
              {
                role: t("admin.permissions.role.reader"),
                icon: <CheckCircle2 className="h-6 w-6 text-green-600" />,
                description: t("admin.permissions.role.readerDesc"),
                permissions: [
                  { label: t("admin.permissions.perm.allGuestFeatures"), allowed: true },
                  { label: t("admin.permissions.perm.favoriteStories"), allowed: true },
                  { label: t("admin.permissions.perm.customProfile"), allowed: true },
                  { label: t("admin.permissions.perm.createStories"), allowed: false },
                  { label: t("admin.permissions.perm.editStories"), allowed: false },
                  { label: t("admin.permissions.perm.manageSystem"), allowed: false },
                ]
              },
              {
                role: t("admin.permissions.role.writer"),
                icon: <Edit className="h-6 w-6 text-blue-600" />,
                description: t("admin.permissions.role.writerDesc"),
                permissions: [
                  { label: t("admin.permissions.perm.allReaderFeatures"), allowed: true },
                  { label: t("admin.permissions.perm.createStories"), allowed: true },
                  { label: t("admin.permissions.perm.editOwnStories"), allowed: true },
                  { label: t("admin.permissions.perm.publishStories"), allowed: false },
                  { label: t("admin.permissions.perm.manageCategories"), allowed: false },
                  { label: t("admin.permissions.perm.manageUsers"), allowed: false },
                ]
              },
              {
                role: t("admin.permissions.role.admin"),
                icon: <ShieldCheck className="h-6 w-6 text-accent" />,
                description: t("admin.permissions.role.adminDesc"),
                permissions: [
                  { label: t("admin.permissions.perm.allWriterFeatures"), allowed: true },
                  { label: t("admin.permissions.perm.publishUnpublish"), allowed: true },
                  { label: t("admin.permissions.perm.manageCategories"), allowed: true },
                  { label: t("admin.permissions.perm.manageUsers"), allowed: true },
                  { label: t("admin.permissions.perm.deleteAnyContent"), allowed: true },
                  { label: t("admin.permissions.perm.changeRoles"), allowed: true },
                ]
              }
            ].map((item, i) => (
              <Card key={i} className="p-6 border-none shadow-elegant bg-background/50 backdrop-blur-sm flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-secondary rounded-xl">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-serif font-bold italic">{item.role}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6 flex-grow">{item.description}</p>
                <div className="space-y-3">
                  {item.permissions.map((p, j) => (
                    <div key={j} className="flex items-center justify-between text-sm">
                      <span className={cn(p.allowed ? "text-foreground" : "text-muted-foreground line-through")}>
                        {p.label}
                      </span>
                      {p.allowed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-4 sm:p-8 border-none shadow-elegant bg-accent/5 mt-8">
            <h3 className="text-base sm:text-lg font-serif italic mb-4">{t("admin.permissions.enforcement.heading")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 text-sm">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Lock className="h-4 w-4" /> {t("admin.permissions.enforcement.frontend")}
                </h4>
                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                  <li>{t("admin.permissions.enforcement.frontend1")}</li>
                  <li>{t("admin.permissions.enforcement.frontend2")}</li>
                  <li>{t("admin.permissions.enforcement.frontend3")}</li>
                  <li>{t("admin.permissions.enforcement.frontend4")}</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> {t("admin.permissions.enforcement.backend")}
                </h4>
                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                  <li>{t("admin.permissions.enforcement.backend1")}</li>
                  <li>{t("admin.permissions.enforcement.backend2")}</li>
                  <li>{t("admin.permissions.enforcement.backend3")}</li>
                  <li>{t("admin.permissions.enforcement.backend4")}</li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-serif italic text-secondary-foreground">{t("admin.articles.heading")}</h2>
            <div className="flex gap-2">
              <Dialog open={showTypeSelection} onOpenChange={setShowTypeSelection}>
                <DialogTrigger asChild>
                  <Button className="rounded-full bg-accent hover:bg-accent/90">
                    <Plus className="mr-2 h-4 w-4" /> {t("admin.addArticle")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-center text-2xl font-serif italic">
                      {t("admin.articles.typeSelect")}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                      {t("admin.articles.typeSelectDesc")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6">
                    <Button
                      variant="outline"
                      className="h-32 flex flex-col gap-3 rounded-2xl hover:border-accent hover:bg-accent/5 transition-all group"
                      onClick={() => {
                        setShowTypeSelection(false);
                        navigate("/admin/text-story/create");
                      }}
                    >
                      <div className="p-3 bg-accent/10 rounded-xl group-hover:scale-110 transition-transform">
                        <BookText className="h-8 w-8 text-accent" />
                      </div>
                      <span className="font-serif italic text-lg">
                        {t("admin.articles.typeText")}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-32 flex flex-col gap-3 rounded-2xl hover:border-accent hover:bg-accent/5 transition-all group"
                      onClick={() => {
                        setShowTypeSelection(false);
                        navigate("/admin/video-story/create");
                      }}
                    >
                      <div className="p-3 bg-accent/10 rounded-xl group-hover:scale-110 transition-transform">
                        <Video className="h-8 w-8 text-accent" />
                      </div>
                      <span className="font-serif italic text-lg">
                        {t("admin.articles.typeVideo")}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-32 flex flex-col gap-3 rounded-2xl hover:border-accent hover:bg-accent/5 transition-all group"
                      onClick={() => {
                        setShowTypeSelection(false);
                        navigate("/admin/carousel-story/create");
                      }}
                    >
                      <div className="p-3 bg-accent/10 rounded-xl group-hover:scale-110 transition-transform">
                        <Images className="h-8 w-8 text-accent" />
                      </div>
                      <span className="font-serif italic text-lg">
                        {t("admin.articles.typeCarousel")}
                      </span>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Dialog open={!!editingArticle} onOpenChange={(open) => !open && setEditingArticle(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif italic text-2xl">{t("admin.articles.editStory")}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t("admin.articles.editStoryDesc")}
                </DialogDescription>
              </DialogHeader>
              {editingArticle && (
                <div className="grid gap-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("admin.articles.titleEn")}</label>
                      <Input
                        value={editingArticle.titleEn}
                        onChange={(e) => setEditingArticle({...editingArticle, titleEn: e.target.value})}
                        maxLength={ARTICLE_LIMITS.TITLE_MAX}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("admin.articles.titleRo")}</label>
                      <Input
                        value={editingArticle.titleRo}
                        onChange={(e) => setEditingArticle({...editingArticle, titleRo: e.target.value})}
                        maxLength={ARTICLE_LIMITS.TITLE_MAX}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("admin.articles.category")}</label>
                    <Select
                      value={editingArticle.categoryId}
                      onValueChange={(val) => setEditingArticle({...editingArticle, categoryId: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin.articles.category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nameEn} / {cat.nameRo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {editingArticle.type === 'video' ? t("admin.articles.mediaVideoUrl") : (editingArticle.type === 'carousel' ? t("admin.articles.galleryImages") : t("admin.articles.mediaImageUrl"))}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={editingArticle.type === 'carousel' ? t("admin.articles.galleryImages") : "https://..."}
                        value={editingArticle.mediaUrl}
                        onChange={(e) => setEditingArticle({...editingArticle, mediaUrl: e.target.value})}
                        disabled={editingArticle.type === 'carousel'}
                      />
                      <input
                        type="file"
                        accept={editingArticle.type === 'video' ? "video/*" : "image/*"}
                        className="hidden"
                        ref={editFileInputRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if (!user?.id) {
                            toast.error(t("admin.common.notAuthenticated"));
                            e.target.value = "";
                            return;
                          }

                          setIsUploading(true);
                          try {
                            const isCarousel = editingArticle.type === 'carousel';
                            const isVideo = editingArticle.type === 'video';
                            const { publicUrl } = await uploadUserFile(file, {
                              bucket: 'articles',
                              kind: isVideo ? 'video' : 'image',
                              userId: user.id,
                              subfolder: isCarousel ? 'carousels' : undefined,
                            });

                            if (isCarousel) {
                              const currentUrls = editingArticle.mediaUrls || [];
                              setEditingArticle({
                                ...editingArticle,
                                mediaUrls: [publicUrl, ...currentUrls],
                                mediaUrl: publicUrl
                              });
                            } else if (isVideo) {
                              let posterPublicUrl = "";
                              try {
                                const posterFile = await createVideoPosterImageFile(file, `${crypto.randomUUID()}-poster.jpg`);
                                if (posterFile) {
                                  const posterRes = await uploadUserFile(posterFile, {
                                    bucket: 'articles',
                                    kind: 'image',
                                    userId: user.id,
                                  });
                                  posterPublicUrl = posterRes.publicUrl;
                                }
                              } catch (posterError) {
                                console.warn("Poster generation/upload failed:", posterError);
                              }
                              setEditingArticle({
                                ...editingArticle,
                                mediaUrl: publicUrl,
                                posterUrl: posterPublicUrl || ""
                              });
                            } else {
                              setEditingArticle({ ...editingArticle, mediaUrl: publicUrl });
                            }
                            toast.success(t("admin.common.imageUploaded"));
                          } catch (error) {
                            const message = error instanceof Error ? error.message : t("admin.common.errUpload");
                            toast.error(message);
                          } finally {
                            setIsUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      {editingArticle.type !== 'carousel' && (
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => editFileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingArticle.type === 'video' ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />)}
                        </Button>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="editIsPublished"
                        checked={!!editingArticle.isPublished}
                        onChange={(e) => setEditingArticle({...editingArticle, isPublished: e.target.checked})}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="editIsPublished" className="text-sm font-medium">{t("admin.articles.publishedToast")}</label>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("location.label")}</label>
                    <Select 
                      value={editingArticle.location} 
                      onValueChange={(val) => setEditingArticle({ ...editingArticle, location: val })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={t("location.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTIES.map((county) => (
                          <SelectItem key={county} value={county}>{county}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {editingArticle.type === 'video' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("admin.articles.descEn")}</label>
                        <Textarea
                          rows={5}
                          value={editingArticle.contentEn}
                          onChange={(e) => setEditingArticle({...editingArticle, contentEn: e.target.value})}
                          maxLength={ARTICLE_LIMITS.CONTENT_MAX}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("admin.articles.descRo")}</label>
                        <Textarea
                          rows={5}
                          value={editingArticle.contentRo}
                          onChange={(e) => setEditingArticle({...editingArticle, contentRo: e.target.value})}
                          maxLength={ARTICLE_LIMITS.CONTENT_MAX}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("admin.articles.posterUrl")}</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://..."
                            value={editingArticle.posterUrl || ""}
                            onChange={(e) => setEditingArticle({ ...editingArticle, posterUrl: e.target.value })}
                          />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={editPosterInputRef}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              if (!user?.id) {
                                toast.error(t("admin.common.notAuthenticated"));
                                e.target.value = "";
                                return;
                              }

                              setIsUploading(true);
                              try {
                                const { publicUrl } = await uploadUserFile(file, {
                                  bucket: 'articles',
                                  kind: 'image',
                                  userId: user.id,
                                });

                                setEditingArticle({ ...editingArticle, posterUrl: publicUrl });
                                toast.success(t("admin.common.imageUploaded"));
                              } catch (error) {
                                const message = error instanceof Error ? error.message : t("admin.common.errUpload");
                                toast.error(message);
                              } finally {
                                setIsUploading(false);
                                e.target.value = "";
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => editPosterInputRef.current?.click()}
                            disabled={isUploading}
                            title={t("admin.articles.posterUrl")}
                          >
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      {editingArticle.mediaUrl && (
                        <div className="space-y-2">
                          <video
                            src={editingArticle.mediaUrl}
                            poster={editingArticle.posterUrl || undefined}
                            controls
                            className="w-full rounded-xl aspect-video bg-black"
                          />
                        </div>
                      )}
                    </div>
                  ) : editingArticle.type === 'carousel' ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t("admin.articles.descEn")}</label>
                          <Textarea
                            rows={5}
                            value={editingArticle.contentEn}
                            onChange={(e) => setEditingArticle({...editingArticle, contentEn: e.target.value})}
                            maxLength={ARTICLE_LIMITS.CONTENT_MAX}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t("admin.articles.descRo")}</label>
                          <Textarea
                            rows={5}
                            value={editingArticle.contentRo}
                            onChange={(e) => setEditingArticle({...editingArticle, contentRo: e.target.value})}
                            maxLength={ARTICLE_LIMITS.CONTENT_MAX}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-sm font-medium flex justify-between items-center">
                          {t("admin.articles.galleryImages")}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full"
                            onClick={() => editCarouselImageInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />}
                            {t("admin.addImage")}
                          </Button>
                        </label>

                        <input
                          type="file"
                          ref={editCarouselImageInputRef}
                          onChange={handleCarouselImageUpload}
                          accept="image/*"
                          className="hidden"
                        />

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {editingArticle.mediaUrls?.map((url, index) => (
                            <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                              <img src={url} className="w-full h-full object-cover" alt={`${t("admin.articles.galleryImages")} ${index + 1}`} loading="lazy" />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeCarouselImage(index)}
                                aria-label={t("admin.articles.removeImage")}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                                {index + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {editingArticle.chaptersEn?.map((chapter, index) => (
                          <div key={index} className="space-y-2">
                            <label className="text-sm font-medium">{`${language === 'en' ? 'Chapter' : 'Capitolul'} ${index + 1} (${language === 'en' ? 'English' : 'Engleză'})`}</label>
                            <Textarea
                              rows={5}
                              value={chapter}
                              onChange={(e) => {
                                const updatedChapters = [...(editingArticle.chaptersEn || [])];
                                updatedChapters[index] = e.target.value;
                                setEditingArticle({...editingArticle, chaptersEn: updatedChapters});
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {editingArticle.chaptersRo?.map((chapter, index) => (
                          <div key={index} className="space-y-2">
                            <label className="text-sm font-medium">{`${language === 'en' ? 'Chapter' : 'Capitolul'} ${index + 1} (${language === 'en' ? 'Romanian' : 'Română'})`}</label>
                            <Textarea
                              rows={5}
                              value={chapter}
                              onChange={(e) => {
                                const updatedChapters = [...(editingArticle.chaptersRo || [])];
                                updatedChapters[index] = e.target.value;
                                setEditingArticle({...editingArticle, chaptersRo: updatedChapters});
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button onClick={handleUpdateArticle} className="w-full rounded-full bg-accent hover:bg-accent/90">
                  {t("admin.articles.update")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Mobile: Card layout */}
          <div className="block md:hidden space-y-3">
            {articles.map((art) => (
              <Card key={art.id} className="p-4 border-none shadow-sm bg-secondary/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {art.type === 'video' ? <Video className="h-3 w-3 text-accent" /> : art.type === 'carousel' ? <Images className="h-3 w-3 text-accent" /> : <BookText className="h-3 w-3 text-accent" />}
                      <h3 className="font-medium text-sm truncate">{getLocalized(art, "title", language)}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {categoriesById.get(art.categoryId) ? getLocalized(categoriesById.get(art.categoryId)!, "name", language) : t("admin.articles.uncategorized")}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        art.isPublished ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {art.isPublished ? t("admin.articles.published") : t("admin.articles.draft")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(art.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isAdmin && (
                      <Button variant="outline" size="icon" className="rounded-full h-7 w-7" onClick={() => togglePublish(art)}>
                        {art.isPublished ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <Button variant="outline" size="icon" className="rounded-full h-7 w-7" onClick={() => navigate(`/admin/${art.type === 'video' ? 'video' : art.type === 'carousel' ? 'carousel' : 'text'}-story/edit/${art.id}`)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="rounded-full h-7 w-7 text-destructive hover:text-destructive" onClick={() => requestDeleteArticle(art.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {articles.length === 0 && (
              <div className="text-center py-10 text-muted-foreground italic">{t("admin.articles.empty")}</div>
            )}
          </div>

          {/* Desktop: Table layout */}
          <Card className="border-none shadow-sm overflow-hidden bg-secondary/10 hidden md:block">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>{t("admin.articles.title")}</TableHead>
                  <TableHead>{t("admin.articles.category")}</TableHead>
                  <TableHead>{t("admin.articles.status")}</TableHead>
                  <TableHead>{t("admin.articles.date")}</TableHead>
                  <TableHead className="text-right">{t("admin.articles.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((art) => (
                  <TableRow key={art.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {art.type === 'video' ? <Video className="h-4 w-4 text-accent" /> : art.type === 'carousel' ? <Images className="h-4 w-4 text-accent" /> : <BookText className="h-4 w-4 text-accent" />}
                        {getLocalized(art, "title", language)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {categoriesById.get(art.categoryId) ? getLocalized(categoriesById.get(art.categoryId)!, "name", language) : t("admin.articles.uncategorized")}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        art.isPublished ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {art.isPublished ? t("admin.articles.published") : t("admin.articles.draft")}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(art.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isAdmin && (
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="rounded-full h-8 w-8"
                            onClick={() => togglePublish(art)}
                          >
                            {art.isPublished ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full h-8 w-8"
                          onClick={() => navigate(`/admin/${art.type === 'video' ? 'video' : art.type === 'carousel' ? 'carousel' : 'text'}-story/edit/${art.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="rounded-full h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => requestDeleteArticle(art.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {articles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                      {t("admin.articles.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            {/* Category Form */}
            <Card className="p-6 h-fit bg-secondary/10 border-none">
              <h3 className="text-xl font-serif italic mb-6">{t("admin.categories.add")}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">{t("admin.categories.nameEn")}</label>
                  <Input
                    value={newCategory.nameEn}
                    onChange={(e) => setNewCategory({...newCategory, nameEn: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">{t("admin.categories.nameRo")}</label>
                  <Input
                    value={newCategory.nameRo}
                    onChange={(e) => setNewCategory({...newCategory, nameRo: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">{t("admin.categories.slug")}</label>
                  <Input
                    placeholder={t("admin.categories.slugPlaceholder")}
                    value={newCategory.slug}
                    onChange={(e) => setNewCategory({...newCategory, slug: e.target.value})}
                  />
                </div>
                <Button onClick={handleAddCategory} className="w-full rounded-full mt-4">
                  {t("admin.categories.addBtn")}
                </Button>
              </div>
            </Card>

            {/* Category List */}
            <div className="md:col-span-2">
              {/* Mobile: Card layout for categories */}
              <div className="block md:hidden space-y-3">
                {categories.map((cat) => (
                  <Card key={cat.id} className="p-4 border-none shadow-sm bg-secondary/10">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-serif italic font-medium text-sm truncate">{cat.nameEn}</p>
                        <p className="font-serif italic text-xs text-muted-foreground truncate">{cat.nameRo}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1">{cat.slug}</p>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => requestDeleteCategory(cat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop: Table layout for categories */}
              <Card className="border-none shadow-sm overflow-hidden bg-secondary/10 hidden md:block">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow>
                      <TableHead>{t("admin.categories.nameEn")}</TableHead>
                      <TableHead>{t("admin.categories.nameRo")}</TableHead>
                      <TableHead>{t("admin.categories.slug")}</TableHead>
                      <TableHead className="text-right">{t("admin.articles.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-serif italic font-medium">{cat.nameEn}</TableCell>
                        <TableCell className="font-serif italic">{cat.nameRo}</TableCell>
                        <TableCell className="text-xs font-mono">{cat.slug}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => requestDeleteCategory(cat.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-serif italic text-secondary-foreground">{t("admin.users.heading")}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">
                  {usersTotal !== null
                    ? t("admin.users.range")
                        .replace("{start}", String(usersRangeStart))
                        .replace("{end}", String(usersRangeEnd))
                        .replace("{total}", String(usersTotal))
                    : t("admin.users.pageOnly").replace("{page}", String(usersPage))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-8"
                  disabled={usersPage <= 1}
                  onClick={() => setUsersPage(prev => Math.max(1, prev - 1))}
                >
                  {t("admin.users.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-8"
                  disabled={!usersHasMore}
                  onClick={() => setUsersPage(prev => prev + 1)}
                >
                  {t("admin.users.next")}
                </Button>
              </div>
            </div>
            
            {/* Mobile: Card layout for users */}
            <div className="block md:hidden space-y-3">
              {allUsers.map((u) => (
                <Card key={u.id} className="p-4 border-none shadow-sm bg-secondary/10">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-xs">{u.displayName?.charAt(0) || u.email.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{u.displayName || t("admin.users.anonymous")}</p>
                        {!u.emailVerified && (
                          <span
                            title={t("admin.users.unverifiedTooltip")}
                            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-amber-500/40 text-amber-500 font-ui"
                          >
                            {t("admin.users.unverified")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Select value={u.role} onValueChange={(val) => handleUpdateRole(u.id, val)} disabled={u.id === user?.id}>
                          <SelectTrigger className="w-24 h-7 text-xs rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t("admin.permissions.role.admin")}</SelectItem>
                            <SelectItem value="writer">{t("admin.permissions.role.writer")}</SelectItem>
                            <SelectItem value="reader">{t("admin.permissions.role.reader")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="icon" className="rounded-full h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => requestDeleteUser(u.id)} disabled={u.id === user?.id}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
              {allUsers.length === 0 && (
                <div className={cn("text-center py-12", usersLoadError ? "text-destructive" : "text-muted-foreground")}>
                  {usersLoadError || t("admin.users.empty")}
                </div>
              )}
            </div>

            {/* Desktop: Table layout for users */}
            <Card className="border-none shadow-sm overflow-hidden bg-secondary/10 hidden md:block">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>{t("admin.users.user")}</TableHead>
                    <TableHead>{t("admin.users.email")}</TableHead>
                    <TableHead>{t("admin.users.role")}</TableHead>
                    <TableHead>{t("admin.users.joined")}</TableHead>
                    <TableHead className="text-right">{t("admin.articles.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-xs">{u.displayName?.charAt(0) || u.email.charAt(0)}</span>
                          )}
                        </div>
                        {u.displayName || t("admin.users.anonymous")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{u.email}</span>
                          {!u.emailVerified && (
                            <span
                              title={t("admin.users.unverifiedTooltip")}
                              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-amber-500/40 text-amber-500 font-ui shrink-0"
                            >
                              {t("admin.users.unverified")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={u.role} 
                          onValueChange={(val) => handleUpdateRole(u.id, val)}
                          disabled={u.id === user?.id}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t("admin.permissions.role.admin")}</SelectItem>
                            <SelectItem value="writer">{t("admin.permissions.role.writer")}</SelectItem>
                            <SelectItem value="reader">{t("admin.permissions.role.reader")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="rounded-full h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => requestDeleteUser(u.id)}
                          disabled={u.id === user?.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {allUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className={cn("text-center py-12", usersLoadError ? "text-destructive" : "text-muted-foreground")}>
                        {usersLoadError || "No users found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            <div className="flex justify-center sm:justify-end items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={usersPage <= 1}
                onClick={() => setUsersPage(prev => Math.max(1, prev - 1))}
              >
                {t("admin.users.previous")}
              </Button>
              <span className="text-xs text-muted-foreground px-2">{t("admin.users.pageOnly").replace("{page}", String(usersPage))}</span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!usersHasMore}
                onClick={() => setUsersPage(prev => prev + 1)}
              >
                {t("admin.users.next")}
              </Button>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          // Don't allow the dialog to close while the destructive action
          // is still running — Radix's outside-click / Esc handler would
          // otherwise dismiss it mid-await and leave the user with no
          // feedback on completion.
          if (!open && !isConfirming) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>
              {confirmDialog?.cancelLabel}
            </AlertDialogCancel>
            {/* Using a plain Button (not AlertDialogAction) so Radix doesn't
                auto-close the dialog on click — we manage close + in-flight
                state explicitly here. */}
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isConfirming}
              onClick={async () => {
                const action = confirmDialog?.onConfirm;
                if (!action) return;
                setIsConfirming(true);
                try {
                  await action();
                } finally {
                  setIsConfirming(false);
                  setConfirmDialog(null);
                }
              }}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {confirmDialog?.confirmLabel}
                </>
              ) : (
                confirmDialog?.confirmLabel
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
