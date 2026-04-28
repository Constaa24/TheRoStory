import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Category, MediaCaption } from "@/lib/supabase";
import { fetchCategories, supabase, uploadUserFile, createArticle } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
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
import { Card } from "@/components/ui/card";
import { ArrowLeft, Images, Loader2, Save, X, Plus, ArrowUp, ArrowDown, Star } from "lucide-react";
import { toast } from "sonner";
import { cn, isAbortError } from "@/lib/utils";
import { COUNTIES } from "@/lib/constants";

interface GalleryGridProps {
  mediaUrls: string[];
  isUploading: boolean;
  addImageLabel: string;
  galleryLabel: string;
  coverLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  setCoverLabel: string;
  removeLabel: string;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
}

const GalleryGrid = React.memo<GalleryGridProps>(({
  mediaUrls,
  isUploading,
  addImageLabel,
  galleryLabel,
  coverLabel,
  moveUpLabel,
  moveDownLabel,
  setCoverLabel,
  removeLabel,
  onRemove,
  onMove,
  onAdd,
}) => (
  <div className="grid grid-cols-2 gap-2">
    {mediaUrls.map((url, index) => {
      const isFirst = index === 0;
      const isLast = index === mediaUrls.length - 1;
      return (
        <div key={url} className="relative group aspect-square rounded-xl overflow-hidden shadow-sm border border-border">
          <img
            src={url}
            className="w-full h-full object-cover"
            alt={`${galleryLabel} ${index + 1}/${mediaUrls.length}`}
            loading="lazy"
          />

          {/* Index + cover badge (always visible) */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <div className="bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              {index + 1}
            </div>
            {isFirst && (
              <div className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                <Star className="h-2.5 w-2.5 fill-current" />
                {coverLabel}
              </div>
            )}
          </div>

          {/* Hover controls */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex items-center gap-1 bg-background/95 rounded-full p-1 shadow-lg">
              <button
                type="button"
                onClick={() => onMove(index, index - 1)}
                disabled={isFirst}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={moveUpLabel}
                title={moveUpLabel}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMove(index, index + 1)}
                disabled={isLast}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={moveDownLabel}
                title={moveDownLabel}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => onMove(index, 0)}
                  className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-accent/10"
                  aria-label={setCoverLabel}
                  title={setCoverLabel}
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10"
                aria-label={removeLabel}
                title={removeLabel}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    })}

    <button
      className={cn(
        "aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors gap-2",
        isUploading ? "border-accent/50 bg-accent/5" : "border-muted-foreground/20 hover:border-accent/50 hover:bg-accent/5"
      )}
      onClick={onAdd}
      disabled={isUploading}
      type="button"
    >
      {isUploading ? (
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      ) : (
        <>
          <Plus className="h-6 w-6 text-accent" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{addImageLabel}</span>
        </>
      )}
    </button>
  </div>
));
GalleryGrid.displayName = "GalleryGrid";

const CarouselStoryCreate: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [titleEn, setTitleEn] = useState("");
  const [titleRo, setTitleRo] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionRo, setDescriptionRo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaCaptions, setMediaCaptions] = useState<MediaCaption[]>([]);

  const isDirty =
    titleEn.trim() !== "" ||
    titleRo.trim() !== "" ||
    descriptionEn.trim() !== "" ||
    descriptionRo.trim() !== "" ||
    categoryId !== "" ||
    location !== "" ||
    mediaUrls.length > 0;

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
    return () => { cancelled = true; };
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user?.id) {
      toast.error(language === 'en' ? "Not authenticated" : "Neautentificat");
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

      setMediaUrls(prev => [...prev, publicUrl]);
      setMediaCaptions(prev => [...prev, { en: "", ro: "" }]);
      toast.success(language === 'en' ? "Image uploaded successfully" : "Imagine încărcată cu succes");
    } catch (error) {
      console.error("Error uploading image:", error);
      const message = error instanceof Error ? error.message : (language === 'en' ? "Error uploading image" : "Eroare la încărcarea imaginii");
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    const url = mediaUrls[index];
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
    setMediaCaptions(prev => prev.filter((_, i) => i !== index));
    // Best-effort cleanup of the uploaded file from storage
    const match = url?.match(/\/object\/public\/articles\/(.+)$/);
    if (match) {
      supabase.storage.from('articles').remove([match[1]]).catch(() => {});
    }
  };

  const moveImage = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= mediaUrls.length || to >= mediaUrls.length) return;
    setMediaUrls(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setMediaCaptions(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const updateCaption = (index: number, lang: "en" | "ro", value: string) => {
    setMediaCaptions(prev => {
      const next = [...prev];
      // Pad with empty objects if needed (for backward compat)
      while (next.length <= index) next.push({ en: "", ro: "" });
      next[index] = { ...next[index], [lang]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!titleEn || !titleRo || !categoryId || mediaUrls.length === 0 || !user) {
      toast.error(language === 'en' ? "Please fill all required fields and upload at least one image" : "Vă rugăm să completați toate câmpurile obligatorii și să încărcați cel puțin o imagine");
      return;
    }

    setIsSaving(true);
    try {
      // Only persist captions if at least one has content
      const hasAnyCaption = mediaCaptions.some(c => c?.en?.trim() || c?.ro?.trim());

      await createArticle({
        type: 'carousel',
        titleEn,
        titleRo,
        contentEn: descriptionEn,
        contentRo: descriptionRo,
        categoryId,
        userId: user.id,
        isPublished: isAdmin,
        location: location || undefined,
        mediaUrl: mediaUrls[0],
        mediaUrls,
        mediaCaptions: hasAnyCaption ? mediaCaptions : undefined,
      });

      toast.success(language === 'en' ? "Carousel story created successfully!" : "Povestea de tip carusel a fost creată cu succes!");
      navigate("/admin");
    } catch (error) {
      console.error("Error saving carousel story:", error);
      toast.error(language === 'en' ? "Error saving carousel story" : "Eroare la salvarea poveștii");
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
    <div className="container mx-auto px-4 py-8 max-w-4xl animate-fade-in">
      <Button 
        variant="ghost" 
        className="mb-6 rounded-full group"
        onClick={() => navigate("/admin")}
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        {language === 'en' ? "Back to Dashboard" : "Înapoi la Panou"}
      </Button>

      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-accent/10 rounded-2xl">
          <Images className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-black italic text-primary">
            {language === 'en' ? "Create Carousel Story" : "Crează Poveste Carusel"}
          </h1>
          <p className="text-muted-foreground">
            {language === 'en' ? "Share a sequence of images about Romanian culture" : "Împărtășește o secvență de imagini despre cultura română"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="p-6 border-none shadow-elegant bg-background/50 backdrop-blur-sm space-y-4">
            <h2 className="text-xl font-serif italic mb-2">{language === 'en' ? "Story Details" : "Detalii Poveste"}</h2>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{language === 'en' ? "Title (English)" : "Titlu (Engleză)"}</label>
              <Input 
                value={titleEn} 
                onChange={(e) => setTitleEn(e.target.value)} 
                placeholder="Enter title in English"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{language === 'en' ? "Title (Romanian)" : "Titlu (Română)"}</label>
              <Input 
                value={titleRo} 
                onChange={(e) => setTitleRo(e.target.value)} 
                placeholder="Introdu titlul în română"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{language === 'en' ? "Category" : "Categorie"}</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={language === 'en' ? "Select a category" : "Selectează o categorie"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {language === 'en' ? cat.nameEn : cat.nameRo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-6 border-none shadow-elegant bg-background/50 backdrop-blur-sm space-y-4">
            <h2 className="text-xl font-serif italic mb-2">{language === 'en' ? "Description" : "Descriere"}</h2>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{language === 'en' ? "Description (English)" : "Descriere (Engleză)"}</label>
              <Textarea 
                value={descriptionEn} 
                onChange={(e) => setDescriptionEn(e.target.value)} 
                placeholder="What is this gallery about?"
                className="min-h-[120px] rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{language === 'en' ? "Description (Romanian)" : "Descriere (Română)"}</label>
              <Textarea 
                value={descriptionRo} 
                onChange={(e) => setDescriptionRo(e.target.value)} 
                placeholder="Despre ce este această galerie?"
                className="min-h-[120px] rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("location.label")}</label>
              <Select value={location} onValueChange={setLocation}>
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
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 border-none shadow-elegant bg-background/50 backdrop-blur-sm h-full flex flex-col">
            <h2 className="text-xl font-serif italic mb-4">{language === 'en' ? "Images Gallery" : "Galerie Imagini"}</h2>
            
            <div className="flex-1 space-y-4">
              <GalleryGrid
                mediaUrls={mediaUrls}
                isUploading={isUploading}
                addImageLabel={t("admin.addImage")}
                galleryLabel={language === 'en' ? "Carousel image" : "Imagine carusel"}
                coverLabel={language === 'en' ? "Cover" : "Copertă"}
                moveUpLabel={language === 'en' ? "Move earlier" : "Mută mai devreme"}
                moveDownLabel={language === 'en' ? "Move later" : "Mută mai târziu"}
                setCoverLabel={language === 'en' ? "Make cover" : "Setează copertă"}
                removeLabel={language === 'en' ? "Remove" : "Elimină"}
                onRemove={removeImage}
                onMove={moveImage}
                onAdd={() => imageInputRef.current?.click()}
              />

              <input
                type="file" 
                ref={imageInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />

              <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <Images className="h-3 w-3 inline mr-1 text-accent" />
                  {language === 'en'
                    ? "Hover any image to reorder, set as cover, or remove. The first image is used as the cover."
                    : "Plasează cursorul peste o imagine pentru a o reordona, seta ca și copertă sau elimina. Prima imagine este folosită ca și copertă."}
                </p>
              </div>

              {/* Per-image captions — optional, shown beneath the gallery */}
              {mediaUrls.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
                      {language === 'en' ? "Image Captions" : "Legende imagini"}
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                      {language === 'en' ? "Optional" : "Opțional"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    {language === 'en'
                      ? "A short line shown beneath each image when readers view the story."
                      : "O linie scurtă afișată sub fiecare imagine când cititorii văd povestea."}
                  </p>
                  <div className="space-y-3">
                    {mediaUrls.map((url, index) => {
                      const caption = mediaCaptions[index] ?? { en: "", ro: "" };
                      return (
                        <div key={url} className="flex items-start gap-3 p-3 rounded-xl bg-background/40 border border-border/40">
                          <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 border border-border">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                            <Input
                              placeholder={language === 'en' ? "Caption (English)" : "Legendă (Engleză)"}
                              value={caption.en}
                              onChange={e => updateCaption(index, "en", e.target.value)}
                              className="text-sm"
                              maxLength={200}
                            />
                            <Input
                              placeholder={language === 'en' ? "Caption (Romanian)" : "Legendă (Română)"}
                              value={caption.ro}
                              onChange={e => updateCaption(index, "ro", e.target.value)}
                              className="text-sm"
                              maxLength={200}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Button 
              className="w-full mt-6 rounded-full h-12 text-lg font-serif italic"
              disabled={isSaving || isUploading || mediaUrls.length === 0}
              onClick={handleSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {language === 'en' ? "Saving Story..." : "Se salvează..."}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  {language === 'en' ? "Publish Carousel Story" : "Publică Povestea Carusel"}
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CarouselStoryCreate;
