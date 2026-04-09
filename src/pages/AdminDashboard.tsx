import React, { useEffect, useState, useRef } from "react";
import {
  Category,
  Article,
  AdminUserSummary,
  getLocalized,
  parseChapters,
  CHAPTER_DELIMITER,
  fetchPublicContent,
  invalidatePublicContentCache,
  fetchAllUsers,
  deleteUser as deleteUserFunc,
  updateUserRole as updateUserRoleFunc,
  uploadFile
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
import { Plus, Trash2, Edit, Image as ImageIcon, Check, X, Loader2, Lock, Users, FileText, Tag, ShieldCheck, CheckCircle2, XCircle, Video, BookText, Images } from "lucide-react";
import { toast } from "sonner";
import { cn, isAbortError } from "@/lib/utils";
import { COUNTIES } from "@/lib/constants";
import { createVideoPosterImageFile } from "@/lib/video-poster";
import { useNavigate } from "react-router-dom";

const combineChapters = (chapters: string[]): string => {
  // Find the last non-empty chapter index
  let lastIndex = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].trim()) lastIndex = i;
  }
  // Only include chapters up to the last non-empty one
  return chapters.slice(0, lastIndex + 1).join(CHAPTER_DELIMITER);
};

const canEditChapter = (chapters: string[], index: number): boolean => {
  if (index === 0) return true;
  // Can only edit chapter N if chapters 0 to N-1 all have content
  for (let i = 0; i < index; i++) {
    if (!chapters[i].trim()) return false;
  }
  return true;
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
  const [isAdding, setIsAdding] = useState(false);
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editCarouselImageInputRef = useRef<HTMLInputElement>(null);
  const editPosterInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [newCategory, setNewCategory] = useState({ nameEn: "", nameRo: "", slug: "" });
  const [newArticle, setNewArticle] = useState<Partial<Article>>({
    titleEn: "", titleRo: "", 
    chaptersEn: ["", "", "", "", ""], chaptersRo: ["", "", "", "", ""],
    categoryId: "", mediaUrl: "", isPublished: false, location: ""
  });

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
      .catch((error: any) => {
        if (cancelled) return;
        setAllUsers([]);
        setUsersTotal(null);
        setUsersHasMore(false);
        const message = error?.message || "Failed to load users";
        setUsersLoadError(message);
        toast.error(language === 'en' ? "Failed to load users" : "Eroare la încărcarea utilizatorilor");
      });
    return () => { cancelled = true; };
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setIsUploading(true);
    try {
      const extension = file.name.split('.').pop();
      const path = `${user?.id}/${crypto.randomUUID()}.${extension}`;
      const publicUrl = await uploadFile('articles', path, file);
      
      if (isEdit && editingArticle) {
        setEditingArticle({ ...editingArticle, mediaUrl: publicUrl });
      } else {
        setNewArticle({ ...newArticle, mediaUrl: publicUrl });
      }
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error uploading image");
    } finally {
      setIsUploading(false);
      // Reset input value to allow uploading same file again
      event.target.value = "";
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.nameEn || !newCategory.nameRo || !newCategory.slug) {
      toast.error("Please fill all fields");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(newCategory.slug)) {
      toast.error("Slug must be lowercase letters, numbers, and hyphens only (e.g. my-category)");
      return;
    }
    try {
      const id = `cat_${Date.now()}`;
      const { error } = await supabase.from('categories').insert({
        id,
        name_en: newCategory.nameEn,
        name_ro: newCategory.nameRo,
        slug: newCategory.slug
      });
      if (error) throw error;
      setNewCategory({ nameEn: "", nameRo: "", slug: "" });
      fetchData();
      toast.success("Category added successfully");
    } catch {
      toast.error("Error adding category");
    }
  };

  const handleAddArticle = async () => {
    if (!newArticle.titleEn || !newArticle.titleRo || !newArticle.categoryId || !user) {
      toast.error("Please fill required fields");
      return;
    }
    try {
      const id = `art_${Date.now()}`;
      // Writers can only save as draft
      const isPublished = isAdmin ? (!!newArticle.isPublished) : false;
      
      const { error } = await supabase.from('articles').insert({
        id,
        title_en: newArticle.titleEn,
        title_ro: newArticle.titleRo,
        content_en: combineChapters(newArticle.chaptersEn || [""]),
        content_ro: combineChapters(newArticle.chaptersRo || [""]),
        category_id: newArticle.categoryId,
        location: newArticle.location,
        media_url: newArticle.mediaUrl,
        poster_url: newArticle.posterUrl || null,
        user_id: user.id,
        is_published: isPublished,
        type: 'text',
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      setNewArticle({
        titleEn: "", titleRo: "", 
        chaptersEn: ["", "", "", "", ""], chaptersRo: ["", "", "", "", ""],
        categoryId: "", mediaUrl: "", isPublished: false, location: ""
      });
      setIsAdding(false);
      setShowTypeSelection(false);
      fetchData();
      toast.success("Article added successfully");
    } catch {
      toast.error("Error adding article");
    }
  };

  const handleUpdateArticle = async () => {
    if (!editingArticle || !editingArticle.titleEn || !editingArticle.titleRo || !editingArticle.categoryId) {
      toast.error("Please fill required fields");
      return;
    }
    try {
      const updates: any = {
        title_en: editingArticle.titleEn,
        title_ro: editingArticle.titleRo,
        content_en: (editingArticle.type === 'video' || editingArticle.type === 'carousel')
          ? editingArticle.contentEn 
          : combineChapters(editingArticle.chaptersEn || [""]),
        content_ro: (editingArticle.type === 'video' || editingArticle.type === 'carousel')
          ? editingArticle.contentRo 
          : combineChapters(editingArticle.chaptersRo || [""]),
        category_id: editingArticle.categoryId,
        location: editingArticle.location,
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
      toast.success("Article updated successfully");
    } catch {
      toast.error("Error updating article");
    }
  };

  const togglePublish = async (article: Article) => {
    if (!isAdmin) {
      toast.error("Only admins can publish articles");
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
      toast.success(newValue ? "Published" : "Unpublished");
    } catch {
      toast.error("Error updating article");
    }
  };

  const deleteArticle = async (id: string) => {
    if (!confirm(language === 'en' ? "Are you sure? This will permanently remove the story." : "Ești sigur? Aceasta va șterge permanent povestea.")) return;
    try {
      const { error } = await supabase.from('articles').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      toast.success("Article deleted");
    } catch {
      toast.error("Error deleting article");
    }
  };

  const deleteUser = async (id: string) => {
    if (!isAdmin) return;
    if (id === user?.id) {
      toast.error("You cannot delete yourself");
      return;
    }
    if (!confirm(language === 'en' ? "Are you sure you want to delete this user? This cannot be undone." : "Ești sigur că vrei să ștergi acest utilizator? Această acțiune nu poate fi anulată.")) return;
    
    try {
      const success = await deleteUserFunc(id);
      if (!success) throw new Error("Failed to delete user");
      if (allUsers.length === 1 && usersPage > 1) {
        setUsersPage(prev => Math.max(1, prev - 1));
      } else {
        setAllUsers(prev => prev.filter(u => u.id !== id));
        setUsersTotal(prev => prev !== null ? prev - 1 : null);
        fetchData();
      }
      toast.success("User deleted");
    } catch {
      toast.error("Error deleting user");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!isAdmin) return;
    
    try {
      const success = await updateUserRoleFunc(userId, newRole);
      if (!success) throw new Error("Failed to update role");
      
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("User role updated");
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Error updating role");
    }
  };

  const handleCarouselImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setIsUploading(true);
    try {
      const extension = file.name.split('.').pop();
      const path = `carousels/${user?.id}/${Date.now()}.${extension}`;
      const publicUrl = await uploadFile('articles', path, file);
      
      if (editingArticle) {
        const currentUrls = editingArticle.mediaUrls || [];
        const newUrls = [...currentUrls, publicUrl];
        setEditingArticle({ 
          ...editingArticle, 
          mediaUrls: newUrls,
          mediaUrl: editingArticle.mediaUrl || publicUrl // Set first if none
        });
      }
      toast.success("Image added to gallery");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error uploading image");
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
        <h1 className="text-2xl font-serif italic mb-2">Access Restricted</h1>
        <p className="text-muted-foreground">You do not have permission to access the dashboard.</p>
        <Button className="mt-6 rounded-full" onClick={() => window.location.href = "/"}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-8 sm:py-12 max-w-6xl animate-fade-in">
      <header className="mb-8 sm:mb-12 space-y-4">
        <h1 className="text-2xl sm:text-4xl font-serif font-black text-primary italic">
          {t("admin.title")}
        </h1>
        <div className="h-1 w-32 bg-accent" />
      </header>

      <Tabs defaultValue="articles" className="space-y-8">
        <TabsList className="bg-secondary/50 p-1 rounded-xl sm:rounded-full flex flex-wrap gap-1 w-full sm:w-auto h-auto">
          <TabsTrigger value="articles" className="rounded-full px-4 sm:px-8 flex gap-1 sm:gap-2 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden xs:inline">{isWriter ? "My Stories" : "Articles"}</span><span className="xs:hidden">Stories</span>
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="categories" className="rounded-full px-4 sm:px-8 flex gap-1 sm:gap-2 text-xs sm:text-sm">
                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Categories</span><span className="sm:hidden">Cats</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-full px-4 sm:px-8 flex gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Users
              </TabsTrigger>
              <TabsTrigger value="permissions" className="rounded-full px-4 sm:px-8 flex gap-1 sm:gap-2 text-xs sm:text-sm">
                <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Permissions</span><span className="sm:hidden">Perms</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="permissions" className="space-y-6">
          <div className="flex flex-col gap-4">
          <h2 className="text-xl sm:text-2xl font-serif italic text-secondary-foreground">Roles & Permissions Summary</h2>
            <p className="text-muted-foreground">Review the access levels for each user role in The RoStory system.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                role: "Guest",
                icon: <Users className="h-6 w-6 text-muted-foreground" />,
                description: "Unauthenticated visitors browsing the site.",
                permissions: [
                  { label: "Browse Categories", allowed: true },
                  { label: "Read Published Stories", allowed: true },
                  { label: "Support Contact", allowed: true },
                  { label: "Favorite Stories", allowed: false },
                  { label: "Create Stories", allowed: false },
                  { label: "Manage System", allowed: false },
                ]
              },
              {
                role: "Reader",
                icon: <CheckCircle2 className="h-6 w-6 text-green-600" />,
                description: "Default authenticated users who enjoy reading.",
                permissions: [
                  { label: "All Guest Features", allowed: true },
                  { label: "Favorite Stories", allowed: true },
                  { label: "Custom Profile", allowed: true },
                  { label: "Create Stories", allowed: false },
                  { label: "Edit Stories", allowed: false },
                  { label: "Manage System", allowed: false },
                ]
              },
              {
                role: "Writer",
                icon: <Edit className="h-6 w-6 text-blue-600" />,
                description: "Content creators who contribute stories.",
                permissions: [
                  { label: "All Reader Features", allowed: true },
                  { label: "Create Stories", allowed: true },
                  { label: "Edit Own Stories", allowed: true },
                  { label: "Publish Stories", allowed: false },
                  { label: "Manage Categories", allowed: false },
                  { label: "Manage Users", allowed: false },
                ]
              },
              {
                role: "Admin",
                icon: <ShieldCheck className="h-6 w-6 text-accent" />,
                description: "Full system administrators with complete control.",
                permissions: [
                  { label: "All Writer Features", allowed: true },
                  { label: "Publish/Unpublish", allowed: true },
                  { label: "Manage Categories", allowed: true },
                  { label: "Manage Users", allowed: true },
                  { label: "Delete Any Content", allowed: true },
                  { label: "Change User Roles", allowed: true },
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
            <h3 className="text-base sm:text-lg font-serif italic mb-4">System Enforcement Logic</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 text-sm">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Frontend Guardrails
                </h4>
                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                  <li>Buttons for Admin actions are hidden from Writers/Readers.</li>
                  <li>Draft status is automatically enforced for Writer submissions.</li>
                  <li>Admin Dashboard is restricted to users with Admin or Writer roles.</li>
                  <li>RLS (Row Level Security) filters favorites and profiles by owner ID.</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Backend Enforcement
                </h4>
                <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                  <li>Edge Functions verify roles before performing sensitive operations.</li>
                  <li>Publishing logic rejects any non-admin attempts at the API level.</li>
                  <li>User management endpoints require direct Admin role verification.</li>
                  <li>Critical database tables are protected via Supabase Row Level Security (RLS).</li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-serif italic text-secondary-foreground">Manage Stories</h2>
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
                      {language === 'en' ? "Choose Story Type" : "Alege Tipul Poveștii"}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                      {language === 'en' ? "Select how you want to tell your next story." : "Selectează cum vrei să spui următoarea poveste."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6">
                    <Button 
                      variant="outline" 
                      className="h-32 flex flex-col gap-3 rounded-2xl hover:border-accent hover:bg-accent/5 transition-all group"
                      onClick={() => {
                        setShowTypeSelection(false);
                        setIsAdding(true);
                      }}
                    >
                      <div className="p-3 bg-accent/10 rounded-xl group-hover:scale-110 transition-transform">
                        <BookText className="h-8 w-8 text-accent" />
                      </div>
                      <span className="font-serif italic text-lg">
                        {language === 'en' ? "Text Story" : "Poveste Text"}
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
                        {language === 'en' ? "Video Story" : "Poveste Video"}
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
                        {language === 'en' ? "Carousel Story" : "Poveste Carusel"}
                      </span>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif italic text-2xl">{t("admin.addArticle")}</DialogTitle>
                <DialogDescription className="sr-only">
                  Fill in the details to create a new story.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Title (English)</label>
                      <Input 
                        value={newArticle.titleEn} 
                        onChange={(e) => setNewArticle({...newArticle, titleEn: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Titlu (Română)</label>
                      <Input 
                        value={newArticle.titleRo} 
                        onChange={(e) => setNewArticle({...newArticle, titleRo: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select onValueChange={(val) => setNewArticle({...newArticle, categoryId: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
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
                    <label className="text-sm font-medium">Media URL (Image)</label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="https://..." 
                        value={newArticle.mediaUrl} 
                        onChange={(e) => setNewArticle({...newArticle, mediaUrl: e.target.value})} 
                      />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={(e) => handleFileUpload(e, false)}
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="isPublished"
                        checked={!!newArticle.isPublished}
                        onChange={(e) => setNewArticle({...newArticle, isPublished: e.target.checked})}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="isPublished" className="text-sm font-medium">Publish immediately</label>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("location.label")}</label>
                    <Select 
                      value={newArticle.location} 
                      onValueChange={(val) => setNewArticle({ ...newArticle, location: val })}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {newArticle.chaptersEn?.map((chapter, index) => (
                      <div key={index} className="space-y-2">
                        <label className="text-sm font-medium">Chapter {index + 1} (English) {index > 0 && !canEditChapter(newArticle.chaptersEn || [], index) && <Lock className="inline-block h-3 w-3 text-muted-foreground" />}</label>
                        <Textarea 
                          rows={5} 
                          value={chapter} 
                          onChange={(e) => {
                            const updatedChapters = [...(newArticle.chaptersEn || [])];
                            updatedChapters[index] = e.target.value;
                            setNewArticle({...newArticle, chaptersEn: updatedChapters});
                          }} 
                          disabled={!canEditChapter(newArticle.chaptersEn || [], index)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {newArticle.chaptersRo?.map((chapter, index) => (
                      <div key={index} className="space-y-2">
                        <label className="text-sm font-medium">Capitolul {index + 1} (Română) {index > 0 && !canEditChapter(newArticle.chaptersRo || [], index) && <Lock className="inline-block h-3 w-3 text-muted-foreground" />}</label>
                        <Textarea 
                          rows={5} 
                          value={chapter} 
                          onChange={(e) => {
                            const updatedChapters = [...(newArticle.chaptersRo || [])];
                            updatedChapters[index] = e.target.value;
                            setNewArticle({...newArticle, chaptersRo: updatedChapters});
                          }} 
                          disabled={!canEditChapter(newArticle.chaptersRo || [], index)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddArticle} className="w-full rounded-full bg-accent hover:bg-accent/90">
                    {language === 'en' ? 'Create Story' : 'Creează Povestea'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          <Dialog open={!!editingArticle} onOpenChange={(open) => !open && setEditingArticle(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif italic text-2xl">Edit Story</DialogTitle>
                <DialogDescription className="sr-only">
                  Update the details of the existing story.
                </DialogDescription>
              </DialogHeader>
              {editingArticle && (
                <div className="grid gap-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Title (English)</label>
                      <Input 
                        value={editingArticle.titleEn} 
                        onChange={(e) => setEditingArticle({...editingArticle, titleEn: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Titlu (Română)</label>
                      <Input 
                        value={editingArticle.titleRo} 
                        onChange={(e) => setEditingArticle({...editingArticle, titleRo: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select 
                      value={editingArticle.categoryId}
                      onValueChange={(val) => setEditingArticle({...editingArticle, categoryId: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
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
                      {editingArticle.type === 'video' ? 'Video URL' : (editingArticle.type === 'carousel' ? 'Gallery Preview' : 'Media URL (Image)')}
                    </label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder={editingArticle.type === 'carousel' ? "First image from gallery" : "https://..."} 
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
                          
                          if (editingArticle.type === 'video' && !file.type.startsWith("video/")) {
                            toast.error("Please upload a video file");
                            return;
                          }
                          if ((editingArticle.type === 'text' || editingArticle.type === 'carousel') && !file.type.startsWith("image/")) {
                            toast.error("Please upload an image file");
                            return;
                          }

                          setIsUploading(true);
                          try {
                            const ownerId = user?.id || "anonymous";
                            const uploadId = Date.now();
                            const extension = file.name.split('.').pop() || (editingArticle.type === 'video' ? "mp4" : "jpg");
                            const path = `${ownerId}/${uploadId}.${extension}`;
                            const bucket = 'articles';
                            const publicUrl = await uploadFile(bucket, path, file);
                             
                            if (editingArticle.type === 'carousel') {
                              const currentUrls = editingArticle.mediaUrls || [];
                              setEditingArticle({ 
                                ...editingArticle, 
                                mediaUrls: [publicUrl, ...currentUrls],
                                mediaUrl: publicUrl 
                              });
                            } else if (editingArticle.type === 'video') {
                              let posterPublicUrl = "";
                              try {
                                const posterFile = await createVideoPosterImageFile(file, `${uploadId}-poster.jpg`);
                                if (posterFile) {
                                  posterPublicUrl = await uploadFile(bucket, `${ownerId}/${uploadId}-poster.jpg`, posterFile);
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
                            toast.success("File uploaded successfully");
                          } catch {
                            toast.error("Error uploading file");
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
                      <label htmlFor="editIsPublished" className="text-sm font-medium">Published</label>
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
                        <label className="text-sm font-medium">Description (English)</label>
                        <Textarea 
                          rows={5} 
                          value={editingArticle.contentEn} 
                          onChange={(e) => setEditingArticle({...editingArticle, contentEn: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Descriere (Română)</label>
                        <Textarea 
                          rows={5} 
                          value={editingArticle.contentRo} 
                          onChange={(e) => setEditingArticle({...editingArticle, contentRo: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Poster URL (Thumbnail)</label>
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

                              if (!file.type.startsWith("image/")) {
                                toast.error("Please upload an image file");
                                return;
                              }

                              setIsUploading(true);
                              try {
                                const ownerId = user?.id || "anonymous";
                                const uploadId = Date.now();
                                const extension = file.name.split('.').pop() || "jpg";
                                const bucket = "articles";
                                const path = `${ownerId}/${uploadId}-poster.${extension}`;
                                const publicUrl = await uploadFile(bucket, path, file);

                                setEditingArticle({ ...editingArticle, posterUrl: publicUrl });
                                toast.success("Poster uploaded successfully");
                              } catch {
                                toast.error("Error uploading poster");
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
                            title="Upload poster image"
                          >
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Uploading a new video auto-generates a poster, but you can override it here.
                        </p>
                      </div>
                      {editingArticle.mediaUrl && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Video Preview</label>
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
                          <label className="text-sm font-medium">Description (English)</label>
                          <Textarea 
                            rows={5} 
                            value={editingArticle.contentEn} 
                            onChange={(e) => setEditingArticle({...editingArticle, contentEn: e.target.value})} 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Descriere (Română)</label>
                          <Textarea 
                            rows={5} 
                            value={editingArticle.contentRo} 
                            onChange={(e) => setEditingArticle({...editingArticle, contentRo: e.target.value})} 
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <label className="text-sm font-medium flex justify-between items-center">
                          Gallery Images
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 rounded-full"
                            onClick={() => editCarouselImageInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Plus className="mr-2 h-3 w-3" />}
                            Add Image
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
                              <img src={url} className="w-full h-full object-cover" alt={`Gallery image ${index + 1}`} loading="lazy" />
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeCarouselImage(index)}
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
                            <label className="text-sm font-medium">Chapter {index + 1} (English) {index > 0 && !canEditChapter(editingArticle.chaptersEn || [], index) && <Lock className="inline-block h-3 w-3 text-muted-foreground" />}</label>
                            <Textarea 
                              rows={5} 
                              value={chapter} 
                              onChange={(e) => {
                                const updatedChapters = [...(editingArticle.chaptersEn || [])];
                                updatedChapters[index] = e.target.value;
                                setEditingArticle({...editingArticle, chaptersEn: updatedChapters});
                              }} 
                              disabled={!canEditChapter(editingArticle.chaptersEn || [], index)}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {editingArticle.chaptersRo?.map((chapter, index) => (
                          <div key={index} className="space-y-2">
                            <label className="text-sm font-medium">Capitolul {index + 1} (Română) {index > 0 && !canEditChapter(editingArticle.chaptersRo || [], index) && <Lock className="inline-block h-3 w-3 text-muted-foreground" />}</label>
                            <Textarea 
                              rows={5} 
                              value={chapter} 
                              onChange={(e) => {
                                const updatedChapters = [...(editingArticle.chaptersRo || [])];
                                updatedChapters[index] = e.target.value;
                                setEditingArticle({...editingArticle, chaptersRo: updatedChapters});
                              }} 
                              disabled={!canEditChapter(editingArticle.chaptersRo || [], index)}
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
                  {language === 'en' ? 'Save Changes' : 'Salvează Modificările'}
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
                      {categories.find(c => c.id === art.categoryId)?.nameEn || "Uncategorized"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        art.isPublished ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {art.isPublished ? (language === 'en' ? "Published" : "Publicat") : (language === 'en' ? "Draft" : "Ciornă")}
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
                    <Button variant="outline" size="icon" className="rounded-full h-7 w-7" onClick={() => setEditingArticle({ 
                      ...art, 
                      chaptersEn: (art.type === 'video' || art.type === 'carousel') ? [] : parseChapters(art.contentEn), 
                      chaptersRo: (art.type === 'video' || art.type === 'carousel') ? [] : parseChapters(art.contentRo) 
                    })}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="rounded-full h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteArticle(art.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {articles.length === 0 && (
              <div className="text-center py-10 text-muted-foreground italic">{language === 'en' ? 'No stories found. Create your first one!' : 'Nu s-au găsit povești. Creează prima ta poveste!'}</div>
            )}
          </div>

          {/* Desktop: Table layout */}
          <Card className="border-none shadow-sm overflow-hidden bg-secondary/10 hidden md:block">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      {categories.find(c => c.id === art.categoryId)?.nameEn || "Uncategorized"}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        art.isPublished ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {art.isPublished ? (language === 'en' ? "Published" : "Publicat") : (language === 'en' ? "Draft" : "Ciornă")}
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
                          onClick={() => setEditingArticle({
                            ...art,
                            chaptersEn: (art.type === 'video' || art.type === 'carousel') ? [] : parseChapters(art.contentEn),
                            chaptersRo: (art.type === 'video' || art.type === 'carousel') ? [] : parseChapters(art.contentRo)
                          })}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="rounded-full h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteArticle(art.id)}
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
                      {language === 'en' ? 'No stories found. Create your first one!' : 'Nu s-au găsit povești. Creează prima ta poveste!'}
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
              <h3 className="text-xl font-serif italic mb-6">{language === 'en' ? 'Add New Category' : 'Adaugă Categorie Nouă'}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Name (EN)</label>
                  <Input 
                    value={newCategory.nameEn} 
                    onChange={(e) => setNewCategory({...newCategory, nameEn: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Name (RO)</label>
                  <Input 
                    value={newCategory.nameRo} 
                    onChange={(e) => setNewCategory({...newCategory, nameRo: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Slug</label>
                  <Input 
                    placeholder="e.g. historical-places" 
                    value={newCategory.slug} 
                    onChange={(e) => setNewCategory({...newCategory, slug: e.target.value})} 
                  />
                </div>
                <Button onClick={handleAddCategory} className="w-full rounded-full mt-4">
                  {language === 'en' ? 'Add Category' : 'Adaugă Categorie'}
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
                        onClick={async () => {
                          if (!confirm(language === 'en' ? "Delete category?" : "Ștergi categoria?")) return;
                          const { error } = await supabase.from('categories').delete().eq('id', cat.id);
                          if (error) { toast.error("Error deleting category"); return; }
                          fetchData();
                          toast.success("Category deleted");
                        }}
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
                      <TableHead>Name (EN)</TableHead>
                      <TableHead>Name (RO)</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                            onClick={async () => {
                              if (!confirm(language === 'en' ? "Delete category?" : "Ștergi categoria?")) return;
                              const { error } = await supabase.from('categories').delete().eq('id', cat.id);
                              if (error) {
                                toast.error("Error deleting category");
                                return;
                              }
                              fetchData();
                              toast.success("Category deleted");
                            }}
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
              <h2 className="text-xl sm:text-2xl font-serif italic text-secondary-foreground">Manage Users</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">
                  {usersTotal !== null
                    ? `Showing ${usersRangeStart}-${usersRangeEnd} of ${usersTotal}`
                    : `Page ${usersPage}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-8"
                  disabled={usersPage <= 1}
                  onClick={() => setUsersPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-8"
                  disabled={!usersHasMore}
                  onClick={() => setUsersPage(prev => prev + 1)}
                >
                  Next
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
                      <p className="font-medium text-sm truncate">{u.displayName || "Anonymous"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Select value={u.role} onValueChange={(val) => handleUpdateRole(u.id, val)} disabled={u.id === user?.id}>
                          <SelectTrigger className="w-24 h-7 text-xs rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="writer">Writer</SelectItem>
                            <SelectItem value="reader">Reader</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="icon" className="rounded-full h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => deleteUser(u.id)} disabled={u.id === user?.id}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
              {allUsers.length === 0 && (
                <div className={cn("text-center py-12", usersLoadError ? "text-destructive" : "text-muted-foreground")}>
                  {usersLoadError || "No users found"}
                </div>
              )}
            </div>

            {/* Desktop: Table layout for users */}
            <Card className="border-none shadow-sm overflow-hidden bg-secondary/10 hidden md:block">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                        {u.displayName || "Anonymous"}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
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
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="writer">Writer</SelectItem>
                            <SelectItem value="reader">Reader</SelectItem>
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
                          onClick={() => deleteUser(u.id)}
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
                Previous Page
              </Button>
              <span className="text-xs text-muted-foreground px-2">Page {usersPage}</span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!usersHasMore}
                onClick={() => setUsersPage(prev => prev + 1)}
              >
                Next Page
              </Button>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
