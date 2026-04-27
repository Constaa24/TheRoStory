import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Category, CHAPTER_DELIMITER } from "@/lib/supabase";
import { fetchCategories, supabase, uploadFile, createArticle } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BookText,
  Loader2,
  Save,
  Image as ImageIcon,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn, isAbortError } from "@/lib/utils";
import { COUNTIES } from "@/lib/constants";

const MIN_CHAPTERS = 1;
const MAX_CHAPTERS = 10;

const TextStoryCreate: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [titleEn, setTitleEn] = useState("");
  const [titleRo, setTitleRo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [chaptersEn, setChaptersEn] = useState<string[]>([""]);
  const [chaptersRo, setChaptersRo] = useState<string[]>([""]);
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const isDirty =
    titleEn.trim() !== "" ||
    titleRo.trim() !== "" ||
    categoryId !== "" ||
    location !== "" ||
    mediaUrl !== "" ||
    chaptersEn.some(c => c.trim() !== "") ||
    chaptersRo.some(c => c.trim() !== "");

  useUnsavedChangesWarning(isDirty && !isSaving);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then(cats => {
        if (!cancelled) setCategories(cats);
      })
      .catch(err => {
        if (!isAbortError(err)) console.error("Error loading categories:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(language === "en" ? "Please upload an image file" : "Vă rugăm să încărcați o imagine");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === "en" ? "Image must be under 10MB" : "Imaginea trebuie să fie sub 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const ownerId = user?.id || "anonymous";
      const extension = file.name.split(".").pop() || "jpg";
      const path = `${ownerId}/${Date.now()}.${extension}`;
      const url = await uploadFile("articles", path, file);
      setMediaUrl(url);
      toast.success(language === "en" ? "Image uploaded" : "Imagine încărcată");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(language === "en" ? "Error uploading image" : "Eroare la încărcarea imaginii");
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const updateChapter = (lang: "en" | "ro", index: number, value: string) => {
    const setter = lang === "en" ? setChaptersEn : setChaptersRo;
    setter(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addChapter = () => {
    if (chaptersEn.length >= MAX_CHAPTERS) return;
    setChaptersEn(prev => [...prev, ""]);
    setChaptersRo(prev => [...prev, ""]);
  };

  const removeChapter = (index: number) => {
    if (chaptersEn.length <= MIN_CHAPTERS) return;
    setChaptersEn(prev => prev.filter((_, i) => i !== index));
    setChaptersRo(prev => prev.filter((_, i) => i !== index));
  };

  const validationErrors = useMemo(() => {
    const errs: { field: string; message: string }[] = [];
    if (!titleEn.trim()) errs.push({ field: "titleEn", message: language === "en" ? "English title is required" : "Titlul în engleză este obligatoriu" });
    if (!titleRo.trim()) errs.push({ field: "titleRo", message: language === "en" ? "Romanian title is required" : "Titlul în română este obligatoriu" });
    if (!categoryId) errs.push({ field: "category", message: language === "en" ? "Please choose a category" : "Alege o categorie" });
    const hasContent = chaptersEn.some(c => c.trim() !== "") || chaptersRo.some(c => c.trim() !== "");
    if (!hasContent) errs.push({ field: "content", message: language === "en" ? "Write at least one chapter" : "Scrie cel puțin un capitol" });
    return errs;
  }, [titleEn, titleRo, categoryId, chaptersEn, chaptersRo, language]);

  const errorFor = (field: string) => validationErrors.find(e => e.field === field);

  const handleSave = async () => {
    if (!user) return;
    setShowErrors(true);
    if (validationErrors.length > 0) {
      toast.error(language === "en"
        ? "Please fix the highlighted fields"
        : "Te rugăm să corectezi câmpurile evidențiate");
      return;
    }

    setIsSaving(true);
    try {
      // Trim trailing empty chapters before joining so we don't store padding
      const filledEn = [...chaptersEn];
      const filledRo = [...chaptersRo];
      while (filledEn.length > 1 && !filledEn[filledEn.length - 1].trim() && !filledRo[filledRo.length - 1]?.trim()) {
        filledEn.pop();
        filledRo.pop();
      }

      await createArticle({
        type: "text",
        titleEn,
        titleRo,
        contentEn: filledEn.join(CHAPTER_DELIMITER),
        contentRo: filledRo.join(CHAPTER_DELIMITER),
        categoryId,
        userId: user.id,
        isPublished: isAdmin ? publishImmediately : false,
        location: location || undefined,
        mediaUrl: mediaUrl || null,
      });

      toast.success(language === "en" ? "Story created!" : "Povestea a fost creată!");
      navigate("/admin");
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error saving text story:", error);
      }
      toast.error(language === "en" ? "Error saving story" : "Eroare la salvarea poveștii");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-fade-in pb-32">
      <Button
        variant="ghost"
        className="mb-6 rounded-full group"
        onClick={() => navigate("/admin")}
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        {language === "en" ? "Back to Dashboard" : "Înapoi la Panou"}
      </Button>

      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-accent/10 rounded-2xl">
          <BookText className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-black italic text-primary">
            {language === "en" ? "Create Text Story" : "Creează Poveste Text"}
          </h1>
          <p className="text-muted-foreground">
            {language === "en"
              ? "Write a chapter-based story about Romanian culture"
              : "Scrie o poveste pe capitole despre cultura română"}
          </p>
        </div>
      </div>

      {/* Validation summary */}
      {showErrors && validationErrors.length > 0 && (
        <Card className="p-4 mb-6 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive mb-1">
                {language === "en"
                  ? `Please fix ${validationErrors.length} ${validationErrors.length === 1 ? "issue" : "issues"} before saving:`
                  : `Te rugăm să corectezi ${validationErrors.length} ${validationErrors.length === 1 ? "problemă" : "probleme"} înainte de salvare:`}
              </p>
              <ul className="text-sm text-destructive/80 list-disc list-inside space-y-0.5">
                {validationErrors.map(e => <li key={e.field}>{e.message}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN — metadata */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-6 border-none shadow-elegant bg-background/50 backdrop-blur-sm space-y-4">
            <h2 className="text-xl font-serif italic mb-2">
              {language === "en" ? "Story Details" : "Detalii Poveste"}
            </h2>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "en" ? "Title (English)" : "Titlu (Engleză)"} <span className="text-destructive">*</span>
              </label>
              <Input
                value={titleEn}
                onChange={e => setTitleEn(e.target.value)}
                placeholder={language === "en" ? "Enter title in English" : "Introdu titlul în engleză"}
                className={cn(showErrors && errorFor("titleEn") && "border-destructive")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "en" ? "Title (Romanian)" : "Titlu (Română)"} <span className="text-destructive">*</span>
              </label>
              <Input
                value={titleRo}
                onChange={e => setTitleRo(e.target.value)}
                placeholder={language === "en" ? "Enter title in Romanian" : "Introdu titlul în română"}
                className={cn(showErrors && errorFor("titleRo") && "border-destructive")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "en" ? "Category" : "Categorie"} <span className="text-destructive">*</span>
              </label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className={cn("rounded-xl", showErrors && errorFor("category") && "border-destructive")}>
                  <SelectValue placeholder={language === "en" ? "Select a category" : "Selectează o categorie"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {language === "en" ? cat.nameEn : cat.nameRo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("location.label")}</label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("location.select")} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTIES.map(county => (
                    <SelectItem key={county} value={county}>{county}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-6 border-none shadow-elegant bg-background/50 backdrop-blur-sm space-y-4">
            <h2 className="text-xl font-serif italic mb-2">
              {language === "en" ? "Cover Image" : "Imagine Copertă"}
            </h2>

            {mediaUrl ? (
              <div className="relative group rounded-xl overflow-hidden border border-border">
                <img src={mediaUrl} alt="" className="w-full aspect-[4/3] object-cover" />
                <button
                  type="button"
                  onClick={() => setMediaUrl("")}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={language === "en" ? "Remove cover image" : "Elimină imaginea"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  "w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors",
                  isUploading ? "border-accent/50 bg-accent/5" : "border-muted-foreground/20 hover:border-accent/50 hover:bg-accent/5"
                )}
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-accent" />
                    <span className="text-sm font-medium">
                      {language === "en" ? "Click to upload" : "Apasă pentru încărcare"}
                    </span>
                    <span className="text-xs text-muted-foreground">JPG, PNG, WebP · 10 MB max</span>
                  </>
                )}
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "en" ? "Or paste image URL" : "Sau lipește URL imagine"}
              </label>
              <Input
                placeholder="https://..."
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
              />
            </div>
          </Card>

          {isAdmin && (
            <Card className="p-6 border-none shadow-elegant bg-background/50 backdrop-blur-sm">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={e => setPublishImmediately(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-accent"
                />
                <div>
                  <span className="font-medium">
                    {language === "en" ? "Publish immediately" : "Publică imediat"}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {language === "en"
                      ? "Otherwise saved as a draft only you can see."
                      : "Altfel se salvează ca ciornă, vizibilă doar pentru tine."}
                  </p>
                </div>
              </label>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN — chapters */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 border-none shadow-elegant bg-background/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif italic">
                {language === "en" ? "Chapters" : "Capitole"}
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addChapter}
                disabled={chaptersEn.length >= MAX_CHAPTERS}
                className="rounded-full"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {language === "en" ? "Add chapter" : "Adaugă capitol"}
              </Button>
            </div>

            {showErrors && errorFor("content") && (
              <p className="text-sm text-destructive mb-4">{errorFor("content")?.message}</p>
            )}

            <div className="space-y-6">
              {chaptersEn.map((_, index) => (
                <div key={index} className="space-y-3 pb-6 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
                      {language === "en" ? `Chapter ${index + 1}` : `Capitolul ${index + 1}`}
                    </h3>
                    {chaptersEn.length > MIN_CHAPTERS && (
                      <button
                        type="button"
                        onClick={() => removeChapter(index)}
                        className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={language === "en" ? `Remove chapter ${index + 1}` : `Elimină capitolul ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {language === "en" ? "English" : "Engleză"}
                      </label>
                      <Textarea
                        rows={6}
                        value={chaptersEn[index]}
                        onChange={e => updateChapter("en", index, e.target.value)}
                        placeholder={language === "en" ? "Write this chapter in English..." : "Scrie acest capitol în engleză..."}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {language === "en" ? "Romanian" : "Română"}
                      </label>
                      <Textarea
                        rows={6}
                        value={chaptersRo[index]}
                        onChange={e => updateChapter("ro", index, e.target.value)}
                        placeholder={language === "en" ? "Write this chapter in Romanian..." : "Scrie acest capitol în română..."}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              {language === "en"
                ? `Up to ${MAX_CHAPTERS} chapters. Empty trailing chapters are removed automatically on save.`
                : `Până la ${MAX_CHAPTERS} capitole. Capitolele goale de la final sunt eliminate automat la salvare.`}
            </p>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="container mx-auto px-4 py-3 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            disabled={isSaving}
            className="rounded-full"
          >
            {language === "en" ? "Cancel" : "Anulează"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="rounded-full px-8 h-11"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving
              ? (language === "en" ? "Saving..." : "Se salvează...")
              : (isAdmin && publishImmediately
                  ? (language === "en" ? "Publish Story" : "Publică Povestea")
                  : (language === "en" ? "Save as Draft" : "Salvează ca Ciornă"))}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TextStoryCreate;
