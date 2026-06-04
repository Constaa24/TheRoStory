import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Category } from "@/lib/supabase";
import { fetchCategories, uploadUserFile, createArticle, updateArticle, deleteStorageFile, fetchAnyArticle, extractStoragePath } from "@/lib/supabase";
import { ARTICLE_LIMITS } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, Loader2, Save, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { isAbortError } from "@/lib/utils";
import { COUNTIES, LOCATION_NONE } from "@/lib/constants";
import { createVideoPosterImageFile } from "@/lib/video-poster";

const VideoStoryCreate: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const isEditing = !!editingId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  // Set true on a successful save so the unmount cleanup doesn't delete media
  // the saved article now references.
  const savedRef = useRef(false);
  // Storage paths uploaded during THIS session — orphans if the user leaves
  // without saving. Never holds an opened article's pre-existing media.
  const sessionUploadsRef = useRef<Set<string>>(new Set());
  // Serialized form state at load time; isDirty compares against it so an
  // unchanged edit page doesn't trigger the "unsaved changes" prompt.
  const initialSnapshotRef = useRef<string | null>(null);

  const [titleEn, setTitleEn] = useState("");
  const [titleRo, setTitleRo] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionRo, setDescriptionRo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoStoragePath, setVideoStoragePath] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState("");
  const [posterStoragePath, setPosterStoragePath] = useState<string | null>(null);

  const formSnapshot = JSON.stringify({ titleEn, titleRo, descriptionEn, descriptionRo, categoryId, location, videoUrl, posterUrl });
  const isDirty = initialSnapshotRef.current !== null && formSnapshot !== initialSnapshotRef.current;

  useUnsavedChangesWarning(isDirty && !isSaving);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        const cats = await fetchCategories();
        if (cancelled) return;
        setCategories(cats);
        if (editingId) {
          const article = await fetchAnyArticle(editingId);
          if (cancelled) return;
          if (!article || article.type !== 'video') {
            toast.error(language === 'en' ? 'Article not found' : 'Articol negăsit');
            navigate('/admin', { replace: true });
            return;
          }
          setTitleEn(article.titleEn || '');
          setTitleRo(article.titleRo || '');
          setDescriptionEn(article.contentEn || '');
          setDescriptionRo(article.contentRo || '');
          setCategoryId(article.categoryId || '');
          setLocation(article.location || '');
          setVideoUrl(article.mediaUrl || '');
          setPosterUrl(article.posterUrl || '');
          // Backfill storage paths from URLs so a replacement upload during
          // edit can clean up the previous file. Without this, the original
          // media stayed orphaned in storage.
          setVideoStoragePath(article.mediaUrl ? extractStoragePath(article.mediaUrl, 'articles') : null);
          setPosterStoragePath(article.posterUrl ? extractStoragePath(article.posterUrl, 'articles') : null);
          setIsPublished(!!article.isPublished);
          initialSnapshotRef.current = JSON.stringify({
            titleEn: article.titleEn || '',
            titleRo: article.titleRo || '',
            descriptionEn: article.contentEn || '',
            descriptionRo: article.contentRo || '',
            categoryId: article.categoryId || '',
            location: article.location || '',
            videoUrl: article.mediaUrl || '',
            posterUrl: article.posterUrl || '',
          });
        } else {
          initialSnapshotRef.current = JSON.stringify({
            titleEn: '', titleRo: '', descriptionEn: '', descriptionRo: '',
            categoryId: '', location: '', videoUrl: '', posterUrl: '',
          });
        }
      } catch (err) {
        if (!isAbortError(err)) console.error("Error loading video data:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  // Clean up files uploaded this session if the user leaves without saving.
  // savedRef gates it so a successful save (which navigates away) keeps its
  // media. Only session uploads are tracked, never pre-existing article media.
  useEffect(() => () => {
    if (savedRef.current) return;
    for (const path of sessionUploadsRef.current) {
      void deleteStorageFile('articles', path);
    }
  }, []);

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!user?.id) {
      toast.error(language === 'en' ? "Not authenticated" : "Neautentificat");
      event.target.value = "";
      return;
    }
    if (event.target) event.target.value = "";

    setIsUploading(true);
    try {
      if (videoStoragePath) {
        sessionUploadsRef.current.delete(videoStoragePath);
        await deleteStorageFile('articles', videoStoragePath);
      }
      if (posterStoragePath) {
        sessionUploadsRef.current.delete(posterStoragePath);
        await deleteStorageFile('articles', posterStoragePath);
      }
      setVideoUrl("");
      setPosterUrl("");
      setVideoStoragePath(null);
      setPosterStoragePath(null);

      const { publicUrl, storagePath } = await uploadUserFile(file, {
        bucket: 'articles',
        kind: 'video',
        userId: user.id,
        subfolder: 'stories/videos',
        maxBytes: 500 * 1024 * 1024,
      });
      setVideoUrl(publicUrl);
      setVideoStoragePath(storagePath);
      sessionUploadsRef.current.add(storagePath);
      toast.success(language === 'en' ? "Video uploaded" : "Video încărcat");

      setIsGeneratingPoster(true);
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
          setPosterStoragePath(posterRes.storagePath);
          sessionUploadsRef.current.add(posterRes.storagePath);
        })
        .catch((posterError) => {
          console.warn("Poster generation/upload failed:", posterError);
          toast.warning(language === 'en' ? "Poster generation failed — upload one manually." : "Generarea posterului a eșuat — încarcă unul manual.");
        })
        .finally(() => setIsGeneratingPoster(false));
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
      if (posterStoragePath) {
        sessionUploadsRef.current.delete(posterStoragePath);
        await deleteStorageFile('articles', posterStoragePath);
      }
      const { publicUrl, storagePath } = await uploadUserFile(file, {
        bucket: 'articles',
        kind: 'image',
        userId: user.id,
        subfolder: 'stories/posters',
      });
      setPosterUrl(publicUrl);
      setPosterStoragePath(storagePath);
      sessionUploadsRef.current.add(storagePath);
      toast.success(language === 'en' ? "Poster uploaded" : "Poster încărcat");
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
      const payload = {
        type: 'video' as const,
        titleEn,
        titleRo,
        contentEn: descriptionEn,
        contentRo: descriptionRo,
        categoryId,
        location: location || undefined,
        mediaUrl: videoUrl,
        posterUrl: posterUrl || null,
      };
      if (isEditing && editingId) {
        await updateArticle({ ...payload, id: editingId, isPublished });
        toast.success(language === 'en' ? "Film updated!" : "Filmul a fost actualizat!");
      } else {
        await createArticle({ ...payload, userId: user.id, isPublished: isAdmin });
        toast.success(language === 'en' ? "Film created!" : "Filmul a fost creat!");
      }
      savedRef.current = true;
      navigate("/admin");
    } catch (error) {
      console.error("Error saving video story:", error);
      const message = error instanceof Error ? error.message : (language === 'en' ? "Error saving story" : "Eroare la salvarea poveștii");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--gold)' }} />
      </div>
    );
  }

  return (
    <div className="screen-anim pb-32">
      {/* Page hero */}
      <section style={{ padding: '60px 0 32px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 mb-6 transition-colors hover:text-gold cursor-pointer"
            style={{ color: 'var(--text-dim)', background: 'transparent', border: 0, fontFamily: 'var(--ui)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {language === 'en' ? 'Back to dashboard' : 'Înapoi la panou'}
          </button>
          <div className="eyebrow mb-3">
            {isEditing
              ? (language === 'en' ? 'Editing · Film' : 'Editare · Film')
              : (language === 'en' ? 'New entry · Film' : 'Intrare nouă · Film')}
          </div>
          <h1 className="font-display italic font-medium m-0" style={{ fontSize: 'clamp(48px, 7vw, 96px)', lineHeight: 0.95, letterSpacing: '-0.01em', color: 'var(--parchment)' }}>
            {isEditing
              ? (language === 'en' ? 'Edit film.' : 'Editează filmul.')
              : (language === 'en' ? 'Publish a film.' : 'Publică un film.')}
          </h1>
          <p className="mt-5 max-w-[640px]" style={{ fontSize: 17, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {language === 'en'
              ? 'Upload the video and a poster image. The description becomes the synopsis on the article page.'
              : 'Încarcă videoclipul și o imagine poster. Descrierea devine sinopsisul pe pagina articolului.'}
          </p>
        </div>
      </section>

      <section style={{ padding: '40px 0 60px' }} className="ed-form">
        <div className="ed-container">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 items-start">
            {/* LEFT — meta */}
            <div className="flex flex-col gap-7">
              <FormBlock title={language === 'en' ? 'Story details' : 'Detalii poveste'}>
                <Field label={language === 'en' ? 'Title (English)' : 'Titlu (Engleză)'} required>
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    placeholder={language === 'en' ? 'Enter title in English' : 'Introdu titlul în engleză'}
                    maxLength={ARTICLE_LIMITS.TITLE_MAX}
                  />
                </Field>
                <Field label={language === 'en' ? 'Title (Romanian)' : 'Titlu (Română)'} required>
                  <input
                    type="text"
                    value={titleRo}
                    onChange={(e) => setTitleRo(e.target.value)}
                    placeholder={language === 'en' ? 'Enter title in Romanian' : 'Introdu titlul în română'}
                    maxLength={ARTICLE_LIMITS.TITLE_MAX}
                  />
                </Field>
                <Field label={language === 'en' ? 'Category' : 'Categorie'} required>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="rounded-sm border-line bg-[color:var(--ink-2)]">
                      <SelectValue placeholder={language === 'en' ? 'Select a category' : 'Selectează o categorie'} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {language === 'en' ? cat.nameEn : cat.nameRo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('location.label')}>
                  <Select
                    value={location || LOCATION_NONE}
                    onValueChange={(v) => setLocation(v === LOCATION_NONE ? "" : v)}
                  >
                    <SelectTrigger className="rounded-sm border-line bg-[color:var(--ink-2)]">
                      <SelectValue placeholder={t('location.select')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LOCATION_NONE}>
                        {language === 'en' ? '— None —' : '— Niciuna —'}
                      </SelectItem>
                      {COUNTIES.map(county => (
                        <SelectItem key={county} value={county}>{county}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FormBlock>

              {isEditing && isAdmin && (
                <FormBlock title={language === 'en' ? 'Visibility' : 'Vizibilitate'}>
                  <label className="flex items-start gap-3 cursor-pointer select-none" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-[color:var(--gold)]"
                    />
                    <span style={{ flex: 1, marginBottom: 0, textTransform: 'none', letterSpacing: 'normal' }}>
                      <span className="font-display italic block" style={{ color: 'var(--parchment)', fontSize: 17 }}>
                        {language === 'en' ? 'Published' : 'Publicat'}
                      </span>
                      <span className="font-ui text-[11px] uppercase mt-1 block" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                        {language === 'en' ? 'Toggle off to revert to draft.' : 'Dezactivează pentru a reveni la ciornă.'}
                      </span>
                    </span>
                  </label>
                </FormBlock>
              )}

              <FormBlock title={language === 'en' ? 'Synopsis' : 'Sinopsis'}>
                <p className="font-ui text-[11px] uppercase mb-2" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                  {language === 'en' ? 'Shown beside the video on the article page.' : 'Afișat lângă video pe pagina articolului.'}
                </p>
                <Field label={language === 'en' ? 'English' : 'Engleză'}>
                  <textarea
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    placeholder={language === 'en' ? 'What is this film about?' : 'Despre ce este acest film?'}
                    rows={5}
                    maxLength={ARTICLE_LIMITS.CONTENT_MAX}
                    style={{ resize: 'vertical' }}
                  />
                </Field>
                <Field label={language === 'en' ? 'Romanian' : 'Română'}>
                  <textarea
                    value={descriptionRo}
                    onChange={(e) => setDescriptionRo(e.target.value)}
                    placeholder={language === 'en' ? 'What is this film about?' : 'Despre ce este acest film?'}
                    rows={5}
                    maxLength={ARTICLE_LIMITS.CONTENT_MAX}
                    style={{ resize: 'vertical' }}
                  />
                </Field>
              </FormBlock>
            </div>

            {/* RIGHT — video */}
            <div className="flex flex-col gap-7">
              <div>
                <div className="eyebrow mb-2">{language === 'en' ? 'Video file' : 'Fișier video'}</div>
                <h2 className="font-display italic m-0" style={{ fontSize: 28, lineHeight: 1.1, color: 'var(--parchment)' }}>
                  {videoUrl
                    ? (language === 'en' ? 'Preview' : 'Previzualizare')
                    : (language === 'en' ? 'Upload your film.' : 'Încarcă filmul tău.')}
                </h2>
              </div>

              <input
                type="file"
                ref={videoInputRef}
                onChange={handleVideoUpload}
                accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                className="hidden"
              />

              {videoUrl ? (
                <div className="flex flex-col gap-4">
                  <div className="video-frame relative" style={{ aspectRatio: '16/9' }}>
                    <video
                      src={videoUrl}
                      poster={posterUrl || undefined}
                      controls
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3" style={{ border: '1px solid var(--line)', background: 'var(--overlay-panel-soft)' }}>
                    <span className="font-ui text-[11px] uppercase flex items-center gap-2" style={{ letterSpacing: '0.18em', color: 'var(--gold)' }}>
                      <span className="rounded-full" style={{ width: 6, height: 6, background: 'var(--gold)' }} />
                      {language === 'en' ? 'Video ready' : 'Video pregătit'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (videoStoragePath) {
                          sessionUploadsRef.current.delete(videoStoragePath);
                          void deleteStorageFile('articles', videoStoragePath);
                        }
                        if (posterStoragePath) {
                          sessionUploadsRef.current.delete(posterStoragePath);
                          void deleteStorageFile('articles', posterStoragePath);
                        }
                        setVideoUrl('');
                        setPosterUrl('');
                        setVideoStoragePath(null);
                        setPosterStoragePath(null);
                      }}
                      className="grid w-8 h-8 place-items-center rounded-full transition-colors"
                      style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--oxblood-2)' }}
                      aria-label={language === 'en' ? 'Remove video' : 'Elimină videoul'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex flex-col items-center justify-center gap-4 py-16 cursor-pointer transition-colors"
                  style={{
                    border: '2px dashed var(--line)',
                    background: isUploading ? 'rgba(201,169,110,0.05)' : 'transparent',
                    color: 'var(--text-dim)',
                    aspectRatio: '16/9',
                  }}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--gold)' }} />
                      <span className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em' }}>
                        {language === 'en' ? 'Uploading…' : 'Se încarcă…'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7" style={{ color: 'var(--gold)' }} />
                      <span className="font-display italic" style={{ color: 'var(--parchment)', fontSize: 22 }}>
                        {language === 'en' ? 'Click to upload video' : 'Apasă pentru a încărca video'}
                      </span>
                      <span className="font-ui text-[10px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
                        MP4 · WebM · MOV · 500 MB max
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Poster section */}
              <FormBlock title={language === 'en' ? 'Poster (thumbnail)' : 'Poster (miniatură)'}>
                <p className="font-ui text-[11px] uppercase mb-2" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                  {language === 'en'
                    ? 'Auto-generated when you upload a video — override below if you prefer.'
                    : 'Generat automat la încărcarea videoului — înlocuiește dedesubt dacă preferi.'}
                </p>

                {posterUrl && (
                  <div className="ph relative mb-3" data-tone="warm" style={{ aspectRatio: '16/9' }}>
                    <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        if (posterStoragePath) {
                          sessionUploadsRef.current.delete(posterStoragePath);
                          void deleteStorageFile('articles', posterStoragePath);
                        }
                        setPosterUrl('');
                        setPosterStoragePath(null);
                      }}
                      className="absolute top-2 right-2 grid w-8 h-8 place-items-center rounded-full"
                      style={{ background: 'var(--overlay-dark)', border: '1px solid var(--oxblood-2)', color: 'var(--oxblood-2)' }}
                      aria-label={language === 'en' ? 'Remove poster' : 'Elimină posterul'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <Field label={language === 'en' ? 'Poster URL' : 'URL Poster'}>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="file"
                      ref={posterInputRef}
                      onChange={handlePosterUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => posterInputRef.current?.click()}
                      disabled={isUploading}
                      className="grid w-12 h-12 place-items-center rounded-sm cursor-pointer transition-colors hover:text-gold shrink-0"
                      style={{ border: '1px solid var(--line)', background: 'var(--ink-2)', color: 'var(--text)' }}
                      title={language === 'en' ? 'Upload poster' : 'Încarcă poster'}
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>

                {isGeneratingPoster && (
                  <p className="font-ui text-[10px] uppercase flex items-center gap-2 mt-2" style={{ letterSpacing: '0.18em', color: 'var(--gold)' }}>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {language === 'en' ? 'Generating poster…' : 'Se generează posterul…'}
                  </p>
                )}
              </FormBlock>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky save bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          borderTop: '1px solid var(--line)',
          background: 'var(--overlay-nav)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <div className="ed-container py-4 flex items-center justify-end gap-3">
          <button
            onClick={() => navigate('/admin')}
            disabled={isSaving}
            className="font-ui text-[11px] uppercase cursor-pointer transition-colors hover:text-gold"
            style={{ background: 'transparent', border: 0, color: 'var(--text-dim)', letterSpacing: '0.18em', padding: '10px 18px' }}
          >
            {language === 'en' ? 'Cancel' : 'Anulează'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isUploading || isGeneratingPoster || !videoUrl}
            className="btn-ed"
            style={{ opacity: isSaving || isUploading || isGeneratingPoster || !videoUrl ? 0.5 : 1 }}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {language === 'en' ? 'Saving…' : 'Se salvează…'}
              </>
            ) : isGeneratingPoster ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {language === 'en' ? 'Generating poster…' : 'Se generează posterul…'}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {isEditing
                  ? (language === 'en' ? 'Save changes' : 'Salvează modificările')
                  : (language === 'en' ? 'Publish film' : 'Publică filmul')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const FormBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-4 p-6" style={{ border: '1px solid var(--line)', background: 'var(--overlay-panel-soft)' }}>
    <div className="eyebrow">{title}</div>
    {children}
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; compact?: boolean; children: React.ReactNode }> = ({ label, required, compact, children }) => (
  <div className={compact ? '' : 'flex flex-col'}>
    <label style={{ marginBottom: compact ? 4 : 8 }}>
      {label}
      {required && <span style={{ color: 'var(--oxblood-2)', marginLeft: 4 }}>*</span>}
    </label>
    {children}
  </div>
);

export default VideoStoryCreate;
