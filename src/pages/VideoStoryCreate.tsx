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

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      toast.error(language === 'en' ? "Please upload an MP4, WebM, MOV, or AVI video file" : "Vă rugăm să încărcați un fișier video MP4, WebM, MOV sau AVI");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error(language === 'en' ? "Video must be under 500MB" : "Videoclipul trebuie să fie sub 500MB");
      return;
    }

    // Clear input immediately so the same file can be re-selected if needed
    if (event.target) event.target.value = "";

    setIsUploading(true);
    try {
      const ownerId = user?.id || "anonymous";
      const uploadId = Date.now();
      const extension = file.name.split('.').pop() || "mp4";
      const videoPath = `${ownerId}/${uploadId}.${extension}`;
      const posterPath = `${ownerId}/${uploadId}-poster.jpg`;

      setVideoUrl("");
      setPosterUrl("");

      const publicUrl = await uploadFile('articles', videoPath, file);
      setVideoUrl(publicUrl);
      toast.success(language === 'en' ? "Video uploaded successfully" : "Video încărcat cu succes");

      // Generate and upload poster in the background — don't block the UI
      createVideoPosterImageFile(file, `${uploadId}-poster.jpg`)
        .then(async (posterFile) => {
          if (posterFile) {
            const url = await uploadFile('articles', posterPath, posterFile);
            setPosterUrl(url);
          }
        })
        .catch((posterError) => {
          console.warn("Poster generation/upload failed:", posterError);
        });
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error(language === 'en' ? "Error uploading video" : "Eroare la încărcarea videoclipului");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePosterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(language === 'en' ? "Please upload an image file" : "Vă rugăm să încărcați o imagine");
      return;
    }

    setIsUploading(true);
    try {
      const ownerId = user?.id || "anonymous";
      const uploadId = Date.now();
      const extension = file.name.split('.').pop() || "jpg";
      const path = `${ownerId}/${uploadId}-poster.${extension}`;
      const publicUrl = await uploadFile('articles', path, file);

      setPosterUrl(publicUrl);
      toast.success(language === 'en' ? "Poster uploaded successfully" : "Poster încărcat cu succes");
    } catch (error) {
      console.error("Error uploading poster:", error);
      toast.error(language === 'en' ? "Error uploading poster" : "Eroare la încărcarea posterului");
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
      const id = `art_vid_${Date.now()}`;
      const { error } = await supabase.from('articles').insert({
        id,
        title_en: titleEn,
        title_ro: titleRo,
        content_en: descriptionEn, // For videos, content can be the description
        content_ro: descriptionRo,
        category_id: categoryId,
        location: location,
        media_url: videoUrl,
        poster_url: posterUrl || null,
        author_id: user.id,
        user_id: user.id,
        is_published: isAdmin, // Supabase boolean
        type: 'video',
        created_at: new Date().toISOString()
      });

      if (error) throw error;

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
                accept="video/*" 
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
