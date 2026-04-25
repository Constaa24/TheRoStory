import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Category } from "@/lib/supabase";
import { fetchPublicContent, supabase, uploadFile } from "@/lib/supabase";
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
import { Card } from "@/components/ui/card";
import { ArrowLeft, Images, Loader2, Save, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn, isAbortError } from "@/lib/utils";
import { COUNTIES } from "@/lib/constants";

interface GalleryGridProps {
  mediaUrls: string[];
  isUploading: boolean;
  addImageLabel: string;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

const GalleryGrid = React.memo<GalleryGridProps>(({ mediaUrls, isUploading, addImageLabel, onRemove, onAdd }) => (
  <div className="grid grid-cols-2 gap-2">
    {mediaUrls.map((url, index) => (
      <div key={index} className="relative group aspect-square rounded-xl overflow-hidden shadow-sm border border-border">
        <img src={url} className="w-full h-full object-cover" alt={`Image ${index + 1}`} loading="lazy" />
        <button
          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onRemove(index)}
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
          {index + 1}
        </div>
      </div>
    ))}
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

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await fetchPublicContent();
      setCategories(data.categories || []);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error fetching categories:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(language === 'en' ? "Please upload an image file" : "Vă rugăm să încărcați o imagine");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'en' ? "Image must be under 10MB" : "Imaginea trebuie să fie sub 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const extension = file.name.split('.').pop();
      const path = `carousels/${user?.id}/${Date.now()}.${extension}`;
      
      const publicUrl = await uploadFile('articles', path, file);
      
      setMediaUrls(prev => [...prev, publicUrl]);
      toast.success(language === 'en' ? "Image uploaded successfully" : "Imagine încărcată cu succes");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(language === 'en' ? "Error uploading image" : "Eroare la încărcarea imaginii");
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    const url = mediaUrls[index];
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
    // Best-effort cleanup of the uploaded file from storage
    const match = url?.match(/\/object\/public\/articles\/(.+)$/);
    if (match) {
      supabase.storage.from('articles').remove([match[1]]).catch(() => {});
    }
  };

  const handleSave = async () => {
    if (!titleEn || !titleRo || !categoryId || mediaUrls.length === 0 || !user) {
      toast.error(language === 'en' ? "Please fill all required fields and upload at least one image" : "Vă rugăm să completați toate câmpurile obligatorii și să încărcați cel puțin o imagine");
      return;
    }

    setIsSaving(true);
    try {
      const id = `art_car_${Date.now()}`;
      const { error } = await supabase.from('articles').insert({
        id,
        title_en: titleEn,
        title_ro: titleRo,
        content_en: descriptionEn,
        content_ro: descriptionRo,
        category_id: categoryId,
        location: location,
        media_urls: mediaUrls,
        media_url: mediaUrls[0], // Set first image as main media_url for compatibility
        user_id: user.id,
        is_published: isAdmin,
        type: 'carousel',
        created_at: new Date().toISOString()
      });

      if (error) throw error;

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
                onRemove={removeImage}
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
                    ? "Upload multiple images to create a carousel. You can reorder images by deleting and re-uploading them." 
                    : "Încarcă mai multe imagini pentru a crea un carusel. Poți reordona imaginile prin ștergere și re-încărcare."}
                </p>
              </div>
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
