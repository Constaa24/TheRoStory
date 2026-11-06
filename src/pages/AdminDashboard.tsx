import React, { useEffect, useState, useMemo } from "react";
import {
  Category,
  Article,
  AdminUserSummary,
  getLocalized,
  fetchAdminArticlesPage,
  fetchCategories,
  invalidatePublicContentCache,
  fetchAllUsers,
  deleteUser as deleteUserFunc,
  updateUserRole as updateUserRoleFunc,
  deleteStorageFile,
  extractStoragePath,
  fetchOrphanedMedia,
  purgeOrphanedMedia,
  SWEEPABLE_BUCKETS,
  toCamelCase,
} from "@/lib/supabase";
import type { OrphanedMediaReport } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Trash2, Edit, Check, X, Loader2, Lock, Users, FileText, Tag, ShieldCheck, CheckCircle2, XCircle, Video, BookText, Images, HardDrive, Route, LayoutDashboard } from "lucide-react";
import { DeskOverview, NewStoryMenu } from "@/components/organisms/DeskOverview";
import { JourneysManager } from "@/components/organisms/JourneysManager";
import { PageHead } from "@/components/layout/PageHead";
import { storageImage } from "@/lib/image-url";
import { toast } from "sonner";
import { cn, isAbortError } from "@/lib/utils";
// The dashboard used raw toLocaleDateString(), which follows the browser's
// locale and so ignored the app's EN/RO toggle — the only surface in the app
// that did. formatArticleDate is what every reader-facing view already uses.
import { formatArticleDate } from "@/lib/article-utils";
import { useNavigate } from "react-router-dom";

const USERS_PER_PAGE = 25;
const ARTICLES_PER_PAGE = 20;

const AdminDashboard: React.FC = () => {
  const { user, isAdmin, isWriter } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [deskTab, setDeskTab] = useState("overview");
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesPage, setArticlesPage] = useState(1);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState<number | null>(null);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [showTypeSelection, setShowTypeSelection] = useState(false);

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

  // Categories load once per user/role — they don't paginate and are reused
  // by the category-management tab. Public-content cache is invalidated first
  // so other pages don't keep serving stale lists after admin edits.
  useEffect(() => {
    if (!user || (!isAdmin && !isWriter)) return;
    let cancelled = false;
    invalidatePublicContentCache();
    fetchCategories()
      .then((cats) => { if (!cancelled) setCategories(cats); })
      .catch((error) => {
        if (!isAbortError(error)) console.error("Error fetching categories:", error);
      });
    return () => { cancelled = true; };
    // Tracking user.id rather than user prevents re-fetching when the user
    // object identity changes but the same user is still logged in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, isWriter]);

  // Articles are fetched one page at a time (server-side range + exact count)
  // so the dashboard scales past the old 500-row ceiling. Writers get an
  // ownerId-scoped query so the DB only returns their own rows.
  useEffect(() => {
    if (!user || (!isAdmin && !isWriter)) return;
    let cancelled = false;
    setArticlesLoading(true);
    fetchAdminArticlesPage(articlesPage, ARTICLES_PER_PAGE, isWriter && !isAdmin ? user.id : undefined)
      .then(({ articles: rows, total }) => {
        if (cancelled) return;
        setArticles(rows);
        setArticlesTotal(total);
      })
      .catch((error) => {
        if (cancelled) return;
        if (!isAbortError(error)) console.error("Error fetching content:", error);
      })
      .finally(() => { if (!cancelled) setArticlesLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, isWriter, articlesPage]);

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
      const [cats, page] = await Promise.all([
        fetchCategories(),
        fetchAdminArticlesPage(articlesPage, ARTICLES_PER_PAGE, isWriter && !isAdmin ? user?.id : undefined),
      ]);
      setCategories(cats);
      setArticles(page.articles);
      setArticlesTotal(page.total);
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
    // Mirror the DB CHECK constraints (categories_name_*/slug_length <= 100)
    // so an over-long value fails fast with a clear message instead of a
    // generic server error.
    const CATEGORY_MAX = 100;
    if (
      newCategory.nameEn.trim().length > CATEGORY_MAX ||
      newCategory.nameRo.trim().length > CATEGORY_MAX ||
      newCategory.slug.length > CATEGORY_MAX
    ) {
      toast.error(language === 'en'
        ? `Name and slug must each be under ${CATEGORY_MAX} characters`
        : `Numele și slug-ul trebuie să aibă fiecare sub ${CATEGORY_MAX} de caractere`);
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
      // Publishing changes what the public sees, and fetchArticleCategoryCounts
      // filters on is_published — so its cached counts are wrong the moment
      // this succeeds. Invalidate here rather than relying on fetchData() to
      // do it: that coupling holds today, but it breaks silently the first
      // time someone optimizes this to patch local state instead of refetching.
      invalidatePublicContentCache();
      fetchData();
      toast.success(newValue ? t("admin.articles.publishedToast") : t("admin.articles.unpublishedToast"));
    } catch {
      toast.error(t("admin.articles.errUpdate"));
    }
  };

  const performDeleteArticle = async (id: string) => {
    try {
      // Collect the article's storage paths BEFORE deleting the row, so we
      // can clean up the bucket afterwards. Without this every deleted
      // article orphaned its cover/poster/gallery/video files forever.
      // The full row, not the admin list's: the list selects a fixed set of
      // columns, and a film's subtitle files (migration 20261102140000) live
      // in columns it doesn't load. select('*') returns whichever columns
      // the database has, before and after that migration.
      const { data: row } = await supabase.from('articles').select('*').eq('id', id).maybeSingle();
      const article = row ? toCamelCase<Article>(row) : articles.find(a => a.id === id);
      const storagePaths = article
        ? [article.mediaUrl, article.posterUrl, ...(article.mediaUrls ?? []), article.subtitlesEnUrl, article.subtitlesRoUrl]
            .map(url => (url ? extractStoragePath(url, 'articles') : null))
            .filter((p): p is string => !!p)
        : [];

      const { error } = await supabase.from('articles').delete().eq('id', id);
      if (error) throw error;

      // Must happen here, not in fetchData(). Deleting the last row of a page
      // past the first takes the setArticlesPage branch below, which refetches
      // through the articlesPage effect and never touches the public-content
      // cache — leaving the deleted story counted for the rest of the TTL.
      invalidatePublicContentCache();

      // Best-effort: deleteStorageFile swallows failures, and admins can
      // remove other users' files via the storage RLS admin override.
      for (const path of storagePaths) {
        void deleteStorageFile('articles', path);
      }

      // If we just removed the last row on a non-first page, step back so the
      // user doesn't land on an empty page; the page effect refetches. Else
      // refetch the current page in place.
      if (articles.length === 1 && articlesPage > 1) {
        setArticlesPage((p) => Math.max(1, p - 1));
      } else {
        fetchData();
      }
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

  // Storage maintenance: unreferenced files in the `articles` bucket.
  // The editors clean up on save and on unmount, but a tab closed
  // mid-edit skips the unmount handler, so the bucket drifts over time
  // with nothing in the app able to notice. admin-api does the scan
  // (see list_orphaned_article_media, migration 20260813010000) and only
  // considers files older than a day, so live drafts are never at risk.
  // One report per sweepable bucket. `avatars` was invisible to this panel
  // until migration 20260816120000 added its detection query — replaced
  // profile pictures from before Profile.tsx started cleaning up after itself
  // had no way of ever being found, let alone reclaimed.
  const [orphanReports, setOrphanReports] = useState<OrphanedMediaReport[] | null>(null);
  const [orphanScanning, setOrphanScanning] = useState(false);
  const [orphanPurging, setOrphanPurging] = useState(false);

  const orphanTotals = useMemo(() => {
    if (!orphanReports) return null;
    return {
      count: orphanReports.reduce((n, r) => n + r.count, 0),
      bytes: orphanReports.reduce((n, r) => n + r.totalBytes, 0),
    };
  }, [orphanReports]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
  };

  const scanAllBuckets = () =>
    Promise.all(SWEEPABLE_BUCKETS.map((bucket) => fetchOrphanedMedia(bucket)));

  const handleScanOrphans = async () => {
    if (!isAdmin) return;
    setOrphanScanning(true);
    try {
      setOrphanReports(await scanAllBuckets());
    } catch (error) {
      console.error("Error scanning for orphaned media:", error);
      toast.error(t("admin.storage.errScan"));
    } finally {
      setOrphanScanning(false);
    }
  };

  const requestPurgeOrphans = () => {
    if (!isAdmin || !orphanTotals?.count) return;
    setConfirmDialog({
      title: t("admin.storage.purgeTitle"),
      description: t("admin.storage.purgeDesc"),
      confirmLabel: t("admin.common.delete"),
      cancelLabel: t("admin.common.cancel"),
      onConfirm: async () => {
        setOrphanPurging(true);
        try {
          // Sequential, not Promise.all: each purge issues batched remove()
          // calls against Storage, and running both buckets at once only
          // makes a rate-limit or partial failure harder to attribute.
          let removed = 0;
          let freed = 0;
          for (const report of orphanReports ?? []) {
            if (report.count === 0) continue;
            const result = await purgeOrphanedMedia(report.bucket);
            removed += result.removed;
            freed += result.freedBytes;
          }
          toast.success(`${t("admin.storage.purged")} ${removed} · ${formatBytes(freed)}`);
          // Re-scan rather than assuming the buckets are empty of orphans:
          // remove() reports per-file outcomes and some may have failed.
          setOrphanReports(await scanAllBuckets());
        } catch (error) {
          console.error("Error purging orphaned media:", error);
          toast.error(t("admin.storage.errPurge"));
        } finally {
          setOrphanPurging(false);
        }
      },
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
        // The categories list is cached for the footer, which mounts on every
        // navigation — without this it keeps offering the deleted category.
        invalidatePublicContentCache();
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
      
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as AdminUserSummary['role'] } : u));
      toast.success(t("admin.users.roleUpdated"));
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error(t("admin.users.errRoleUpdate"));
    }
  };

  const usersRangeStart = allUsers.length === 0 ? 0 : (usersPage - 1) * USERS_PER_PAGE + 1;
  const usersRangeEnd = allUsers.length === 0 ? 0 : usersRangeStart + allUsers.length - 1;

  const articlesTotalPages = Math.max(1, Math.ceil(articlesTotal / ARTICLES_PER_PAGE));
  const articlesRangeStart = articles.length === 0 ? 0 : (articlesPage - 1) * ARTICLES_PER_PAGE + 1;
  const articlesRangeEnd = articles.length === 0 ? 0 : articlesRangeStart + articles.length - 1;

  // Without this the dashboard has no <title> at all (the static index.html
  // fallback is stripped at boot). noindex mirrors robots.txt's /admin block.
  const pageHead = (
    <PageHead
      title={t("admin.title")}
      description={t("admin.permissions.subheading")}
      language={language}
    >
      <meta name="robots" content="noindex, nofollow" />
    </PageHead>
  );

  if (!isAdmin && !isWriter) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {pageHead}
        <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="rs-display mb-2" style={{ fontSize: 34 }}>{t("admin.access.restricted")}</h1>
        <p className="text-muted-foreground">{t("admin.access.noPermission")}</p>
        <Button className="mt-6 rounded-full" onClick={() => navigate("/")}>{t("admin.access.backHome")}</Button>
      </div>
    );
  }

  return (
    <div className="ed-container rs-in" style={{ paddingTop: 'clamp(28px, 4vw, 48px)' }}>
      {pageHead}
      {/* The editorial desk (the redesign's AdminApp): its sections down the
          side, the one open beside them, and a new story always one click
          away. */}
      <header className="flex flex-wrap items-end justify-between gap-5 mb-8 sm:mb-10">
        <div>
          <p className="rs-eyebrow" style={{ marginBottom: 10 }}>{language === 'en' ? 'The editorial desk' : 'Biroul editorial'}</p>
          <h1 className="rs-display" style={{ fontSize: 'clamp(38px, 4.4vw, 60px)', lineHeight: 1 }}>{t("admin.title")}</h1>
        </div>
        <NewStoryMenu language={language} onPick={(path) => navigate(path)} />
      </header>

      <Tabs value={deskTab} onValueChange={setDeskTab} orientation="vertical" className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
        <TabsList className="flex flex-row lg:flex-col items-stretch justify-start gap-1 h-auto p-0 pr-10 lg:pr-0 bg-transparent rounded-none overflow-x-auto lg:sticky lg:top-24 [mask-image:linear-gradient(to_left,transparent,#000_40px)] lg:[mask-image:none]">
          <TabsTrigger value="overview" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]">
            <LayoutDashboard className="h-4 w-4" /> {language === 'en' ? 'Overview' : 'Prezentare'}
          </TabsTrigger>
          <TabsTrigger value="articles" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]" aria-label={isWriter ? t("admin.tabs.myStories") : t("admin.tabs.articles")}>
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden xs:inline">{isWriter ? t("admin.tabs.myStories") : t("admin.tabs.articles")}</span><span className="xs:hidden">{t("admin.tabs.stories")}</span>
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="categories" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]" aria-label={t("admin.tabs.categories")}>
                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.categories")}
              </TabsTrigger>
              <TabsTrigger value="journeys" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]" aria-label={language === 'en' ? 'Journeys' : 'Trasee'}>
                <Route className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {language === 'en' ? 'Journeys' : 'Trasee'}
              </TabsTrigger>
              <TabsTrigger value="users" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]" aria-label={t("admin.tabs.users")}>
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.users")}
              </TabsTrigger>
              <TabsTrigger value="storage" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]" aria-label={t("admin.tabs.storage")}>
                <HardDrive className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.storage")}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]" aria-label={t("admin.tabs.permissions")}>
                <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.permissions")}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-0 min-w-0">
          <DeskOverview language={language} onOpen={setDeskTab} />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6 mt-0 min-w-0">
          <div className="flex flex-col gap-4">
          <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{t("admin.permissions.heading")}</h2>
            <p className="text-muted-foreground">{t("admin.permissions.subheading")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                role: t("admin.permissions.role.guest"),
                icon: <Users className="h-5 w-5" />,
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
                icon: <CheckCircle2 className="h-5 w-5" />,
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
                icon: <Edit className="h-5 w-5" />,
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
                icon: <ShieldCheck className="h-5 w-5" />,
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
              <Card key={i} className="rs-desk-card shadow-none flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid place-items-center h-10 w-10 rounded-full bg-[color:var(--glow)] text-[color:var(--gold)]">
                    {item.icon}
                  </div>
                  <h3 className="rs-display" style={{ fontSize: 26, letterSpacing: 0 }}>{item.role}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6 flex-grow">{item.description}</p>
                <div className="space-y-3">
                  {item.permissions.map((p, j) => (
                    <div key={j} className="flex items-center justify-between gap-3 font-ui text-[13px] font-semibold">
                      <span className={cn(p.allowed ? "text-foreground" : "text-muted-foreground line-through")}>
                        {p.label}
                      </span>
                      {p.allowed ? (
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--gold)] shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card className="rs-desk-card shadow-none mt-8">
            <h3 className="rs-display mb-5" style={{ fontSize: 26, letterSpacing: 0 }}>{t("admin.permissions.enforcement.heading")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 text-sm">
              <div className="space-y-4">
                <h4 className="font-ui text-[13px] font-bold flex items-center gap-2 text-[color:var(--gold)]">
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
                <h4 className="font-ui text-[13px] font-bold flex items-center gap-2 text-[color:var(--gold)]">
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

        {/* Storage maintenance used to live at the bottom of the Permissions
            tab, which is where nobody looked for it — it has nothing to do
            with roles. Its own tab, next to the other admin-only surfaces. */}
        <TabsContent value="storage" className="space-y-6 mt-0 min-w-0">
          <Card className="rs-desk-card shadow-none">
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-[color:var(--glow)] text-[color:var(--gold)]">
                <HardDrive className="h-5 w-5" />
              </div>
              <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{t("admin.storage.heading")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{t("admin.storage.subheading")}</p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                variant="outline"
                onClick={handleScanOrphans}
                disabled={orphanScanning || orphanPurging}
                className="rounded-full"
              >
                {orphanScanning
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("admin.storage.scanning")}</>
                  : <><HardDrive className="h-4 w-4 mr-2" />{t("admin.storage.scan")}</>}
              </Button>

              {orphanTotals && orphanTotals.count > 0 && (
                <Button
                  variant="destructive"
                  onClick={requestPurgeOrphans}
                  disabled={orphanScanning || orphanPurging}
                  className="rounded-full"
                >
                  {orphanPurging
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("admin.storage.purging")}</>
                    : <><Trash2 className="h-4 w-4 mr-2" />{t("admin.storage.purge")}</>}
                </Button>
              )}
            </div>

            {orphanReports && orphanTotals && (
              <div className="mt-6 text-sm">
                {orphanTotals.count === 0 ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-[color:var(--gold)] shrink-0" />
                    {t("admin.storage.clean")}
                  </p>
                ) : (
                  <>
                    <p className="font-bold mb-3">
                      {orphanTotals.count} {t("admin.storage.found")} · {formatBytes(orphanTotals.bytes)}
                    </p>
                    {/* Grouped per bucket: "9 orphans" reads very differently
                        when they are stale avatars than when they are article
                        media, and the two are cleaned up by different code
                        paths. Buckets with nothing to report are omitted. */}
                    <div className="space-y-4">
                      {orphanReports.filter((r) => r.count > 0).map((report) => (
                        <div key={report.bucket}>
                          <p className="font-mono text-xs text-muted-foreground mb-2">
                            {report.bucket} · {report.count} · {formatBytes(report.totalBytes)}
                          </p>
                          <ul className="space-y-1 max-h-48 overflow-y-auto text-muted-foreground font-mono text-xs">
                            {report.files.map((file) => (
                              <li key={file.name} className="flex justify-between gap-4">
                                <span className="truncate">{file.name}</span>
                                <span className="shrink-0">{formatBytes(file.bytes)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="space-y-6 mt-0 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{t("admin.articles.heading")}</h2>
            <div className="flex gap-2">
              <Dialog open={showTypeSelection} onOpenChange={setShowTypeSelection}>
                <DialogTrigger asChild>
                  <Button className="rounded-full bg-accent hover:bg-accent/90">
                    <Plus className="mr-2 h-4 w-4" /> {t("admin.addArticle")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-center">
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
                      <span className="font-display text-[19px] font-medium">
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
                      <span className="font-display text-[19px] font-medium">
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
                      <span className="font-display text-[19px] font-medium">
                        {t("admin.articles.typeCarousel")}
                      </span>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Mobile: Card layout */}
          <div className="block md:hidden space-y-3">
            {articlesLoading && articles.length === 0 && (
              [1, 2, 3].map((i) => (
                <Card key={i} className="rs-desk-card shadow-none p-4 animate-pulse h-20" />
              ))
            )}
            {articles.map((art) => (
              <Card key={art.id} className="rs-desk-card shadow-none p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {art.type === 'video' ? <Video className="h-3 w-3 text-accent" /> : art.type === 'carousel' ? <Images className="h-3 w-3 text-accent" /> : <BookText className="h-3 w-3 text-accent" />}
                      <h3 className="font-display text-[18px] leading-tight truncate">{getLocalized(art, "title", language)}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {categoriesById.get(art.categoryId) ? getLocalized(categoriesById.get(art.categoryId)!, "name", language) : t("admin.articles.uncategorized")}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn(
                        "inline-flex px-2.5 py-1 rounded-full font-ui text-[12px] font-bold border",
                        art.isPublished ? "border-[color:var(--gold-deep)] bg-[color:var(--glow)] text-[color:var(--gold-2)]" : "border-dashed border-[color:var(--line)] text-[color:var(--text-dim)]"
                      )}>
                        {art.isPublished ? t("admin.articles.published") : t("admin.articles.draft")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatArticleDate(art.createdAt, language, "short")}
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
            {!articlesLoading && articles.length === 0 && (
              <div className="text-center py-10 font-display italic text-[20px] text-[color:var(--text-dim)]">{t("admin.articles.empty")}</div>
            )}
          </div>

          {/* Desktop: Table layout */}
          <Card className="rs-desk-card shadow-none p-0 overflow-hidden hidden md:block">
            <Table>
              <TableHeader>
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
                    <TableCell className="font-display text-[18px] leading-tight">
                      <div className="flex items-center gap-2.5">
                        {art.type === 'video' ? <Video className="h-4 w-4 text-accent" /> : art.type === 'carousel' ? <Images className="h-4 w-4 text-accent" /> : <BookText className="h-4 w-4 text-accent" />}
                        {getLocalized(art, "title", language)}
                      </div>
                    </TableCell>
                    <TableCell className="font-ui text-[13px] text-[color:var(--text-dim)]">
                      {categoriesById.get(art.categoryId) ? getLocalized(categoriesById.get(art.categoryId)!, "name", language) : t("admin.articles.uncategorized")}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex px-2.5 py-1 rounded-full font-ui text-[12px] font-bold border",
                        art.isPublished ? "border-[color:var(--gold-deep)] bg-[color:var(--glow)] text-[color:var(--gold-2)]" : "border-dashed border-[color:var(--line)] text-[color:var(--text-dim)]"
                      )}>
                        {art.isPublished ? t("admin.articles.published") : t("admin.articles.draft")}
                      </span>
                    </TableCell>
                    <TableCell className="font-ui text-[12.5px] text-[color:var(--text-mute)] whitespace-nowrap tabular-nums">
                      {formatArticleDate(art.createdAt, language, "short")}
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
                {articlesLoading && articles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}
                {!articlesLoading && articles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 font-display italic text-[20px] text-[color:var(--text-dim)]">
                      {t("admin.articles.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {articlesTotal > ARTICLES_PER_PAGE && (
            <div className="flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-3 pt-2">
              <span className="text-xs text-muted-foreground">
                {t("admin.users.range")
                  .replace("{start}", String(articlesRangeStart))
                  .replace("{end}", String(articlesRangeEnd))
                  .replace("{total}", String(articlesTotal))}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={articlesPage <= 1}
                  onClick={() => setArticlesPage((p) => Math.max(1, p - 1))}
                >
                  {t("admin.users.previous")}
                </Button>
                <span className="text-xs text-muted-foreground px-1">
                  {t("admin.users.pageOnly").replace("{page}", String(articlesPage))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={articlesPage >= articlesTotalPages}
                  onClick={() => setArticlesPage((p) => p + 1)}
                >
                  {t("admin.users.next")}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Gated like the users tab — writers never see the trigger, but the
            content shouldn't render for them either (RLS blocks the writes
            server-side regardless). */}
        {isAdmin && (
        <TabsContent value="categories" className="space-y-6 mt-0 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            {/* Category Form */}
            <Card className="rs-desk-card shadow-none h-fit">
              <h3 className="rs-display mb-6" style={{ fontSize: 26, letterSpacing: 0 }}>{t("admin.categories.add")}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="cat-name-en" className="font-ui text-[13px] font-bold text-[color:var(--text-dim)]">{t("admin.categories.nameEn")}</label>
                  <Input
                    id="cat-name-en"
                    value={newCategory.nameEn}
                    onChange={(e) => setNewCategory({...newCategory, nameEn: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="cat-name-ro" className="font-ui text-[13px] font-bold text-[color:var(--text-dim)]">{t("admin.categories.nameRo")}</label>
                  <Input
                    id="cat-name-ro"
                    value={newCategory.nameRo}
                    onChange={(e) => setNewCategory({...newCategory, nameRo: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="cat-slug" className="font-ui text-[13px] font-bold text-[color:var(--text-dim)]">{t("admin.categories.slug")}</label>
                  <Input
                    id="cat-slug"
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
                  <Card key={cat.id} className="rs-desk-card shadow-none p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-[18px] leading-tight truncate">{cat.nameEn}</p>
                        <p className="font-display text-[16px] text-[color:var(--text-dim)] truncate">{cat.nameRo}</p>
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
              <Card className="rs-desk-card shadow-none p-0 overflow-hidden hidden md:block">
                <Table>
                  <TableHeader>
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
                        <TableCell className="font-display text-[18px]">{cat.nameEn}</TableCell>
                        <TableCell className="font-display text-[17px] text-[color:var(--text-dim)]">{cat.nameRo}</TableCell>
                        <TableCell className="text-xs font-mono text-[color:var(--text-mute)]">{cat.slug}</TableCell>
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
        )}

        {/* Curated walks shown on the Atlas (/map). Admin-only, like
            categories; the manager loads its data when the tab opens. */}
        {isAdmin && (
          <TabsContent value="journeys" className="space-y-6 mt-0 min-w-0">
            <JourneysManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="users" className="space-y-6 mt-0 min-w-0">
            <TooltipProvider delayDuration={150}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{t("admin.users.heading")}</h2>
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
                <Card key={u.id} className="rs-desk-card shadow-none p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                      {u.avatarUrl ? (
                        <img src={storageImage(u.avatarUrl, "avatar")} alt={u.displayName} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-xs">{u.displayName?.charAt(0) || u.email.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{u.displayName || t("admin.users.anonymous")}</p>
                        {!u.emailVerified && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                tabIndex={0}
                                className="font-ui text-[12px] font-bold px-2 py-0.5 rounded-full border border-dashed border-[color:var(--gold-deep)] text-[color:var(--gold-2)] cursor-help"
                              >
                                {t("admin.users.unverified")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-center">
                              {t("admin.users.unverifiedTooltip")}
                            </TooltipContent>
                          </Tooltip>
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
                          {u.createdAt ? formatArticleDate(u.createdAt, language, "short") : '—'}
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
            <Card className="rs-desk-card shadow-none p-0 overflow-hidden hidden md:block">
              <Table>
                <TableHeader>
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
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden">
                            {u.avatarUrl ? (
                              <img src={storageImage(u.avatarUrl, "avatar")} alt={u.displayName} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <span className="text-xs">{u.displayName?.charAt(0) || u.email.charAt(0)}</span>
                            )}
                          </div>
                          {u.displayName || t("admin.users.anonymous")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{u.email}</span>
                          {!u.emailVerified && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  tabIndex={0}
                                  className="font-ui text-[12px] font-bold px-2 py-0.5 rounded-full border border-dashed border-[color:var(--gold-deep)] text-[color:var(--gold-2)] shrink-0 cursor-help"
                                >
                                  {t("admin.users.unverified")}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] text-center">
                                {t("admin.users.unverifiedTooltip")}
                              </TooltipContent>
                            </Tooltip>
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
                      <TableCell className="font-ui text-[12.5px] text-[color:var(--text-mute)] whitespace-nowrap tabular-nums">
                        {u.createdAt ? formatArticleDate(u.createdAt, language, "short") : '—'}
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
            </TooltipProvider>
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
