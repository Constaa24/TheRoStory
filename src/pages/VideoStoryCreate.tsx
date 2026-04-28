import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Category } from "@/lib/supabase";
import { fetchCategories, uploadUserFile, createArticle } from "@/lib/supabase";
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
import { ArrowLeft, Video, Upload, Loader2, Save, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { isAbortError } from "@/lib/utils";
import { COUNTIES } from "@/lib/constants";
import { createVideoPosterImageFile } from "@/lib/video-poster";

const VideoStoryCreate: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [titleEn, setTitleEn] = useState("");
  const [titleRo, setTitleRo] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionRo, setDescriptionRo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");

  const isDirty =
    titleEn.trim() !== "" ||
    titleRo.trim() !== "" ||
    descriptionEn.trim() !== "" ||
    descriptionRo.trim() !== "" ||
    categoryId !== "" ||
    location !== "" ||
    videoUrl !== "" ||
    posterUrl !== "";

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

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user?.id) {
      toast.error(language === 'en' ? "Not authenticated" : "Neautentificat");
      event.target.value = "";
      return;
    }

    // Clear input immediately so the same file can be re-selected if needed
    if (event.target) event.target.value = "";

    setIsUploading(true);
    try {
      setVideoUrl("");
      setPosterUrl("");

      const { publicUrl } = await uploadUserFile(file, {
        bucket: 'articles',
        kind: 'video',
        userId: user.id,
        subfolder: 'stories/videos',
        maxBytes: 500 * 1024 * 1024,
      });
      setVideoUrl(publicUrl);
      toast.success(language === 'en' ? "Video uploaded successfully" : "Video încărcat cu succes");

      // Generate and upload poster in the background — don't block the UI
      createVideoPosterImageFile(file, `${crypto.randomUUID()}-poster.jpg`)
        .then(async (posterFile) => {
          if (!posterFile) return;
          const posterRes = await uploadUserFile(posterFile, {
            bucket: 'articles',
            kind: 'image',
            userId: user.id,
            subfolder: 'stories/posters',
          });
          setPosterUrl(posterRes.publicUrl);
        })
        .catch((posterError) => {
          console.warn("Poster generation/upload failed:", posterError);
          toast.warning(language === 'en' ? "Poster generation failed — you can upload one manually." : "Generarea posterului a eșuat — îl poți încărca manual.");
        });
    } catch (error) {
      console.error("Error uploading video:", error);
      const message = error instanceof Error ? error.message : (language === 'en' ? "Error uploading video" : "Eroare la încărcarea videoclipului");
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePosterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        subfolder: 'stories/posters',
      });

      setPosterUrl(publicUrl);
      toast.success(language === 'en' ? "Poster uploaded successfully" : "Poster încărcat cu succes");
    } catch (error) {
      console.error("Error uploading poster:", error);
      const message = error instanceof Error ? error.message : (language === 'en' ? "Error uploading poster" : "Eroare la încărcarea posterului");
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!titleEn || !titleRo || !categoryId || !videoUrl || !user) {
      toast.error(language === 'en' ? "Please fill all required fields and upload a video" : "Vă rugăm să completați toate câmpurile obligatorii și să încărcați un video");
      return;
    }

    setIsSaving(true);
    try {
      await createArticle({
        type: 'video',
        titleEn,
        titleRo,
        contentEn: descriptionEn,
        contentRo: descriptionRo,
        categoryId,
        userId: user.id,
        isPublished: isAdmin,
        location: location || undefined,
        mediaUrl: videoUrl,
        posterUrl: posterUrl || null,
      });

      toast.success(language === 'en' ? "Video story created successfully!" : "Povestea video a fost creată cu succes!");
      navigate("/admin");
    } catch (error) {
      console.error("Error saving video story:", error);
      toast.error(language === 'en' ? "Error saving video story" : "Eroare la salvarea poveștii video");
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
          <Video className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-black italic text-primary">
            {language === 'en' ? "Create Video Story" : "Crează Poveste Video"}
          </h1>
          <p className="text-muted-foreground">
            {language === 'en' ? "Share a visual story about Romanian culture" : "Împărtășește o poveste vizuală despre cultura română"}
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
                placeholder="What is this video about?"
                className="min-h-[120px] rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{language === 'en' ? "Description (Romanian)" : "Descriere (Română)"}</label>
              <Textarea 
                value={descriptionRo} 
                onChange={(e) => setDescriptionRo(e.target.value)} 
                placeholder="Despre ce este acest video?"
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
            <h2 className="text-xl font-serif italic mb-4">{language === 'en' ? "Video Upload" : "Încărcare Video"}</h2>
            
            <div 
              className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-colors ${
                videoUrl ? 'border-green-500/50 bg-green-50/10' : 'border-muted-foreground/20 hover:border-accent/50'
              }`}
            >
              {videoUrl ? (
                <div className="w-full space-y-4">
                  <video 
                    src={videoUrl} 
                    poster={posterUrl || undefined}
                    controls 
                    className="w-full rounded-xl shadow-lg aspect-video object-cover"
                  />
                  <div className="flex justify-between items-center bg-green-500/10 p-3 rounded-xl">
                    <span className="text-xs text-green-600 font-medium">Video Ready</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 rounded-full hover:bg-red-500/10 hover:text-red-500"
                      onClick={() => {
                        setVideoUrl("");
                        setPosterUrl("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-accent/5 rounded-full mb-4">
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    ) : (
                      <Upload className="h-8 w-8 text-accent" />
                    )}
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-medium">
                      {isUploading ? (language === 'en' ? "Uploading..." : "Se încarcă...") : (language === 'en' ? "Click to upload video" : "Click pentru a încărca video")}
                    </p>
                    <p className="text-xs text-muted-foreground">MP4, WebM or MOV (Max 500MB)</p>
                  </div>
                  <Button 
                    disabled={isUploading}
                    className="mt-6 rounded-full"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    {language === 'en' ? "Select Video" : "Selectează Video"}
                  </Button>
                </>
              )}
              <input 
                type="file" 
                ref={videoInputRef} 
                onChange={handleVideoUpload} 
                accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                className="hidden" 
              />
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">
                {language === 'en' ? "Poster URL (Thumbnail)" : "URL Poster (Miniatură)"}
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                />
                <input
                  type="file"
                  ref={posterInputRef}
                  onChange={handlePosterUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => posterInputRef.current?.click()}
                  disabled={isUploading}
                  title={language === 'en' ? "Upload poster image" : "Încarcă imagine poster"}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'en'
                  ? "A poster is auto-generated when you upload a video, but you can override it here."
                  : "Un poster este generat automat la încărcarea video-ului, dar îl poți înlocui aici."}
              </p>
            </div>

            <Button 
              className="w-full mt-6 rounded-full h-12 text-lg font-serif italic"
              disabled={isSaving || isUploading || !videoUrl}
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
                  {language === 'en' ? "Publish Video Story" : "Publică Povestea Video"}
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VideoStoryCreate;
