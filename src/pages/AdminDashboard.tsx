import React, { useEffect, useState, useMemo } from "react";
import {
  Category,
  AdminUserSummary,
  fetchCategories,
  invalidatePublicContentCache,
  fetchAllUsers,
  deleteUser as deleteUserFunc,
  updateUserRole as updateUserRoleFunc,
  setUserSuspended,
  fetchOrphanedMedia,
  purgeOrphanedMedia,
  SWEEPABLE_BUCKETS,
} from "@/lib/supabase";
import { fetchDeskStats, fetchNoteCounts } from "@/lib/desk";
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
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Edit, Loader2, Lock, Users, FileText, Tag, ShieldCheck, CheckCircle2, XCircle, HardDrive, Route, LayoutDashboard, MessageSquare, Mail } from "lucide-react";
import { DeskOverview, NewStoryMenu } from "@/components/organisms/DeskOverview";
import { JourneysManager } from "@/components/organisms/JourneysManager";
import { DeskStories } from "@/components/desk/DeskStories";
import { DeskShelves } from "@/components/desk/DeskShelves";
import { DeskComments } from "@/components/desk/DeskComments";
import { DeskNewsletter } from "@/components/desk/DeskNewsletter";
import type { DeskConfirm } from "@/components/desk/types";
import { PageHead } from "@/components/layout/PageHead";
import { storageImage } from "@/lib/image-url";
import { toast } from "sonner";
import { cn, isAbortError } from "@/lib/utils";
// The dashboard used raw toLocaleDateString(), which follows the browser's
// locale and so ignored the app's EN/RO toggle — the only surface in the app
// that did. formatArticleDate is what every reader-facing view already uses.
import { formatArticleDate, joinMeta } from "@/lib/article-utils";
import { useNavigate } from "react-router-dom";

const USERS_PER_PAGE = 25;

const AdminDashboard: React.FC = () => {
  const { user, isAdmin, isWriter } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [deskTab, setDeskTab] = useState("overview");
  const [categories, setCategories] = useState<Category[]>([]);
  // Bumped when a shelf is added or deleted, so the shelves list reloads.
  const [shelvesKey, setShelvesKey] = useState(0);
  // Notes flagged by readers and still on the site: the Comments tab's badge.
  const [flagged, setFlagged] = useState(0);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [allUsers, setAllUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState<number | null>(null);
  const [usersHasMore, setUsersHasMore] = useState(false);

  // Confirmation dialog state — replaces the inconsistent native confirm()
  // calls so destructive actions feel like the rest of the app.
  type ConfirmConfig = {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    /** "gold" for a deliberate send; the default is the destructive red. */
    tone?: "gold";
    onConfirm: () => void | Promise<void>;
  };
  const [confirmDialog, setConfirmDialog] = useState<ConfirmConfig | null>(null);
  // While the destructive action is in flight, both buttons disable so a
  // user can't spam-click and dispatch N parallel deletes.
  const [isConfirming, setIsConfirming] = useState(false);

  // Form states
  const [newCategory, setNewCategory] = useState({ nameEn: "", nameRo: "", slug: "" });

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

  // The Comments badge and the Readers table's note counts. Admins only:
  // both read what RLS keeps from everyone else.
  const refreshFlagged = React.useCallback(() => {
    fetchDeskStats().then((s) => setFlagged(s?.flagged ?? 0)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user || !isAdmin) return;
    refreshFlagged();
    fetchNoteCounts().then(setNoteCounts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

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
      setCategories(await fetchCategories());
      setShelvesKey((k) => k + 1);
    } catch (error) {
      if (!isAbortError(error)) console.error("Error fetching data:", error);
    }
  };

  // The desk's sections ask before anything that can't be taken back,
  // through the one dialog at the foot of this page.
  const deskConfirm: DeskConfirm = (c) => setConfirmDialog({ ...c, cancelLabel: t("admin.common.cancel") });

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
        slug: newCategory.slug,
        // A new shelf goes last in the site's order.
        sort_order: Math.max(0, ...categories.map((c) => c.sortOrder ?? 0)) + 1,
      });
      if (error) throw error;
      setNewCategory({ nameEn: "", nameRo: "", slug: "" });
      fetchData();
      toast.success(t("admin.categories.added"));
    } catch {
      toast.error(t("admin.categories.errAdd"));
    }
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

  // Suspend: no sign-in until restored. Asked first; restoring is not.
  const handleSuspend = (u: AdminUserSummary) => {
    if (!isAdmin || u.id === user?.id) return;
    const en = language === 'en';
    const next = !u.suspended;
    const apply = async () => {
      const ok = await setUserSuspended(u.id, next);
      if (!ok) {
        toast.error(en ? "That could not be saved." : "Nu a putut fi salvat.");
        return;
      }
      setAllUsers(prev => prev.map(x => x.id === u.id ? { ...x, suspended: next } : x));
      toast.success(next ? (en ? "Suspended." : "Suspendat.") : (en ? "Restored." : "Restabilit."));
    };
    if (!next) { void apply(); return; }
    setConfirmDialog({
      title: en ? "Suspend this reader?" : "Suspendi acest cititor?",
      description: en
        ? "They won't be able to sign in until you restore them (a session already open ends within the hour). Nothing they wrote is removed."
        : "Nu se va mai putea autentifica până îl restabilești (o sesiune deja deschisă se încheie în cel mult o oră). Nimic din ce a scris nu este șters.",
      confirmLabel: en ? "Suspend" : "Suspendă",
      cancelLabel: t("admin.common.cancel"),
      onConfirm: apply,
    });
  };

  const usersRangeStart = allUsers.length === 0 ? 0 : (usersPage - 1) * USERS_PER_PAGE + 1;
  const usersRangeEnd = allUsers.length === 0 ? 0 : usersRangeStart + allUsers.length - 1;

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
          <TabsTrigger value="articles" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]" >
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {isWriter && !isAdmin ? t("admin.tabs.myStories") : t("admin.tabs.stories")}
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="categories" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]">
                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.categories")}
              </TabsTrigger>
              <TabsTrigger value="journeys" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]">
                <Route className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {language === 'en' ? 'Journeys' : 'Trasee'}
              </TabsTrigger>
              <TabsTrigger value="comments" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]">
                <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {language === 'en' ? 'Comments' : 'Comentarii'}
                {flagged > 0 && <span className="rs-nav-badge lg:ml-auto" aria-label={language === 'en' ? `${flagged} flagged` : `${flagged} semnalate`}>{flagged}</span>}
              </TabsTrigger>
              <TabsTrigger value="users" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.users")}
              </TabsTrigger>
              <TabsTrigger value="newsletter" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {language === 'en' ? 'Newsletter' : 'Buletin'}
              </TabsTrigger>
              <TabsTrigger value="storage" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]">
                <HardDrive className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.storage")}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="justify-start gap-2.5 rounded-xl px-4 py-2.5 font-ui text-[14px] font-semibold text-[color:var(--text-dim)] whitespace-nowrap data-[state=active]:bg-[color:var(--glow)] data-[state=active]:text-[color:var(--gold)] data-[state=active]:shadow-none hover:text-[color:var(--parchment)]">
                <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t("admin.tabs.permissions")}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-0 min-w-0">
          <DeskOverview language={language} ownerId={isWriter && !isAdmin ? user?.id : undefined} onOpen={setDeskTab} />
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
          <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{t("admin.articles.heading")}</h2>
          <DeskStories language={language} isAdmin={isAdmin} ownerId={isWriter && !isAdmin ? user?.id : undefined} confirm={deskConfirm} />
        </TabsContent>

        {/* Gated like the users tab — writers never see the trigger, but the
            content shouldn't render for them either (RLS blocks the writes
            server-side regardless). */}
        {isAdmin && (
        <TabsContent value="categories" className="space-y-8 mt-0 min-w-0">
          <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{language === 'en' ? 'Shelves' : 'Rafturi'}</h2>
          <DeskShelves language={language} refreshKey={shelvesKey} onChanged={() => { invalidatePublicContentCache(); fetchCategories().then(setCategories).catch(() => {}); }} onDelete={requestDeleteCategory} />
          <div className="max-w-[520px]">
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
          <TabsContent value="comments" className="space-y-6 mt-0 min-w-0">
            <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{language === 'en' ? "Readers' notes" : 'Notele cititorilor'}</h2>
            <DeskComments language={language} confirm={deskConfirm} onChanged={refreshFlagged} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="newsletter" className="space-y-6 mt-0 min-w-0">
            <h2 className="rs-display" style={{ fontSize: 30, letterSpacing: 0 }}>{language === 'en' ? 'The dispatch' : 'Buletinul'}</h2>
            <DeskNewsletter language={language} confirm={deskConfirm} />
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
                    <span className="rs-desk-thumb rs-desk-initial" aria-hidden="true">
                      {u.avatarUrl
                        ? <img src={storageImage(u.avatarUrl, "avatar")} alt="" className="rs-desk-thumb-img" loading="lazy" />
                        : (u.displayName?.charAt(0) || u.email.charAt(0)).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="m-0 font-ui font-bold text-sm truncate" style={{ color: 'var(--parchment)' }}>{u.displayName || t("admin.users.anonymous")}</p>
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
                          <SelectTrigger className="w-36 h-8 text-xs rounded-full" aria-label={language === 'en' ? `Role of ${u.displayName || t("admin.users.anonymous")}` : `Rolul lui ${u.displayName || t("admin.users.anonymous")}`}>
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
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">{noteCounts[u.id] || 0} {language === 'en' ? ((noteCounts[u.id] || 0) === 1 ? 'note' : 'notes') : ((noteCounts[u.id] || 0) === 1 ? 'notă' : 'note')}</span>
                        {u.suspended && <span className="rs-status is-suspended">{language === 'en' ? 'Suspended' : 'Suspendat'}</span>}
                        <button
                          type="button"
                          className={cn("rs-btn rs-btn-ghost whitespace-nowrap", u.suspended ? "rs-btn-restore" : "rs-btn-danger")}
                          style={{ minHeight: 32, padding: '0 12px', fontSize: 12 }}
                          onClick={() => handleSuspend(u)}
                          disabled={u.id === user?.id}
                        >
                          {u.suspended ? (language === 'en' ? 'Restore' : 'Restabilește') : (language === 'en' ? 'Suspend' : 'Suspendă')}
                          <span className="sr-only"> {u.displayName || t("admin.users.anonymous")}</span>
                        </button>
                      </div>
                    </div>
                    <button type="button" className="rs-icon-act is-danger shrink-0" onClick={() => requestDeleteUser(u.id)} disabled={u.id === user?.id}
                      aria-label={language === 'en' ? `Delete ${u.displayName || t("admin.users.anonymous")}` : `Șterge ${u.displayName || t("admin.users.anonymous")}`} title={t("admin.common.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              ))}
              {allUsers.length === 0 && (
                <div className={cn("text-center py-12", usersLoadError ? "text-destructive" : "text-muted-foreground")}>
                  {usersLoadError || t("admin.users.empty")}
                </div>
              )}
            </div>

            {/* Desktop: the design's table. The email sits under the name
                rather than in a column of its own, and the reader's column
                takes whatever room is left (its text truncates), so the role
                and the actions are never cut off. Below 1280px, beside the
                desk's sections, "Joined" and "Notes" fold under the email. */}
            <div className="rs-desk-card hidden md:block" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="relative overflow-x-auto">
                <table className="rs-desk-table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>{language === 'en' ? 'Reader' : 'Cititor'}</th>
                      <th className="hidden xl:table-cell">{t("admin.users.joined")}</th>
                      <th className="hidden xl:table-cell" style={{ textAlign: 'right' }}>{language === 'en' ? 'Notes' : 'Note'}</th>
                      <th>{t("admin.users.role")}</th>
                      <th><span className="sr-only">{t("admin.articles.actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u) => {
                      const name = u.displayName || t("admin.users.anonymous");
                      const own = u.id === user?.id;
                      const notes = noteCounts[u.id] || 0;
                      return (
                        <tr key={u.id}>
                          <td style={{ width: '100%', maxWidth: 0 }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="rs-desk-thumb rs-desk-initial" aria-hidden="true">
                                {u.avatarUrl
                                  ? <img src={storageImage(u.avatarUrl, "avatar")} alt="" className="rs-desk-thumb-img" loading="lazy" />
                                  : (u.displayName?.charAt(0) || u.email.charAt(0)).toUpperCase()}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                                  <span className="font-ui font-bold truncate min-w-0" style={{ fontSize: 14, color: 'var(--parchment)' }}>{name}</span>
                                  {u.suspended && <span className="rs-status is-suspended">{language === 'en' ? 'Suspended' : 'Suspendat'}</span>}
                                </span>
                                <span className="flex items-center gap-2 mt-0.5 min-w-0">
                                  <span className="truncate min-w-0" style={{ fontFamily: 'var(--ui)', fontSize: 12.5, color: 'var(--text-mute)' }}>{u.email}</span>
                                  {!u.emailVerified && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          tabIndex={0}
                                          className="font-ui text-[11.5px] font-bold px-2 py-px rounded-full border border-dashed border-[color:var(--gold-deep)] text-[color:var(--gold-2)] shrink-0 cursor-help"
                                        >
                                          {t("admin.users.unverified")}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[220px] text-center">
                                        {t("admin.users.unverifiedTooltip")}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </span>
                                <span className="block xl:hidden mt-0.5" style={{ fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--text-mute)' }}>
                                  {joinMeta([
                                    u.createdAt ? `${t("admin.users.joined")} ${formatArticleDate(u.createdAt, language, "short")}` : null,
                                    language === 'en' ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : `${notes} ${notes === 1 ? 'notă' : 'note'}`,
                                  ])}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="hidden xl:table-cell rs-desk-dim whitespace-nowrap tabular-nums">
                            {u.createdAt ? formatArticleDate(u.createdAt, language, "short") : '—'}
                          </td>
                          <td className="hidden xl:table-cell rs-desk-dim tabular-nums" style={{ textAlign: 'right' }}>{notes}</td>
                          <td>
                            <Select value={u.role} onValueChange={(val) => handleUpdateRole(u.id, val)} disabled={own}>
                              <SelectTrigger className="w-36 h-8 text-xs rounded-full" aria-label={language === 'en' ? `Role of ${name}` : `Rolul lui ${name}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">{t("admin.permissions.role.admin")}</SelectItem>
                                <SelectItem value="writer">{t("admin.permissions.role.writer")}</SelectItem>
                                <SelectItem value="reader">{t("admin.permissions.role.reader")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td>
                            <div className="flex justify-end items-center gap-1.5">
                              <button
                                type="button"
                                className={cn("rs-btn rs-btn-ghost whitespace-nowrap", u.suspended ? "rs-btn-restore" : "rs-btn-danger")}
                                style={{ minHeight: 32, padding: '0 12px', fontSize: 12 }}
                                onClick={() => handleSuspend(u)}
                                disabled={own}
                              >
                                {u.suspended ? (language === 'en' ? 'Restore' : 'Restabilește') : (language === 'en' ? 'Suspend' : 'Suspendă')}
                                <span className="sr-only"> {name}</span>
                              </button>
                              <button
                                type="button"
                                className="rs-icon-act is-danger"
                                onClick={() => requestDeleteUser(u.id)}
                                disabled={own}
                                aria-label={language === 'en' ? `Delete ${name}` : `Șterge ${name}`}
                                title={t("admin.common.delete")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {allUsers.length === 0 && (
                <p className={cn("m-0 text-center font-display italic", usersLoadError ? "text-destructive" : "")} style={{ padding: 36, fontSize: 20, color: usersLoadError ? undefined : 'var(--text-dim)' }}>
                  {usersLoadError || t("admin.users.empty")}
                </p>
              )}
            </div>

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
              className={confirmDialog?.tone === "gold" ? undefined : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
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
