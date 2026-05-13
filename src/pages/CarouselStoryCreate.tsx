import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Category, MediaCaption } from "@/lib/supabase";
import { fetchCategories, uploadUserFile, createArticle, updateArticle, deleteStorageFile, fetchAnyArticle, extractStoragePath, ARTICLE_LIMITS } from "@/lib/supabase";

type GalleryItem = { id: string; url: string; storagePath: string | null };
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
import { ArrowLeft, Loader2, Save, X, Plus, ArrowUp, ArrowDown, Star, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { isAbortError } from "@/lib/utils";
import { COUNTIES, LOCATION_NONE } from "@/lib/constants";

const CarouselStoryCreate: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const isEditing = !!editingId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [titleEn, setTitleEn] = useState("");
  const [titleRo, setTitleRo] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionRo, setDescriptionRo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [mediaCaptions, setMediaCaptions] = useState<MediaCaption[]>([]);
  const [posterUrl, setPosterUrl] = useState("");
  const [posterStoragePath, setPosterStoragePath] = useState<string | null>(null);
  const isFull = items.length >= ARTICLE_LIMITS.MEDIA_URLS_MAX;

  const isDirty =
    titleEn.trim() !== "" ||
    titleRo.trim() !== "" ||
    descriptionEn.trim() !== "" ||
    descriptionRo.trim() !== "" ||
    categoryId !== "" ||
    location !== "" ||
    items.length > 0 ||
    posterUrl !== "";

  useUnsavedChangesWarning(isDirty && !isSaving);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        const [cats] = await Promise.all([fetchCategories()]);
        if (cancelled) return;
        setCategories(cats);
        if (editingId) {
          const article = await fetchAnyArticle(editingId);
          if (cancelled) return;
          if (!article || article.type !== 'carousel') {
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
          setIsPublished(!!article.isPublished);
          setPosterUrl(article.posterUrl || '');
          setPosterStoragePath(article.posterUrl ? extractStoragePath(article.posterUrl, 'articles') : null);
          const urls = article.mediaUrls || (article.mediaUrl ? [article.mediaUrl] : []);
          // Backfill storage paths so removing a pre-existing image during
          // edit actually cleans up the file in storage instead of orphaning it.
          setItems(urls.map(url => ({
            id: crypto.randomUUID(),
            url,
            storagePath: extractStoragePath(url, 'articles'),
          })));
          setMediaCaptions(article.mediaCaptions && article.mediaCaptions.length === urls.length
            ? article.mediaCaptions
            : urls.map(() => ({ en: '', ro: '' })));
        }
      } catch (err) {
        if (!isAbortError(err)) console.error('Error loading carousel data:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!user?.id) {
      toast.error(language === 'en' ? "Not authenticated" : "Neautentificat");
      event.target.value = "";
      return;
    }
    if (isFull) {
      toast.error(language === 'en'
        ? `Gallery limit reached (max ${ARTICLE_LIMITS.MEDIA_URLS_MAX} images).`
        : `Limita galeriei atinsă (maxim ${ARTICLE_LIMITS.MEDIA_URLS_MAX} imagini).`);
      event.target.value = "";
      return;
    }
    setIsUploading(true);
    try {
      const { publicUrl, storagePath } = await uploadUserFile(file, {
        bucket: 'articles',
        kind: 'image',
        userId: user.id,
        subfolder: 'carousels',
      });
      setItems(prev => [...prev, { id: crypto.randomUUID(), url: publicUrl, storagePath }]);
      setMediaCaptions(prev => [...prev, { en: "", ro: "" }]);
      toast.success(language === 'en' ? "Image uploaded" : "Imagine încărcată");
    } catch (error) {
      console.error("Error uploading image:", error);
      const message = error instanceof Error ? error.message : (language === 'en' ? "Error uploading image" : "Eroare la încărcarea imaginii");
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
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
      if (posterStoragePath) await deleteStorageFile('articles', posterStoragePath);
      const { publicUrl, storagePath } = await uploadUserFile(file, {
        bucket: 'articles',
        kind: 'image',
        userId: user.id,
        subfolder: 'stories/posters',
      });
      setPosterUrl(publicUrl);
      setPosterStoragePath(storagePath);
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

  const removePoster = () => {
    if (posterStoragePath) void deleteStorageFile('articles', posterStoragePath);
    setPosterUrl('');
    setPosterStoragePath(null);
  };

  const removeImage = (index: number) => {
    const removed = items[index];
    setItems(prev => prev.filter((_, i) => i !== index));
    setMediaCaptions(prev => prev.filter((_, i) => i !== index));
    if (removed?.storagePath) void deleteStorageFile('articles', removed.storagePath);
  };

  const moveImage = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    setItems(prev => {
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
    if (index < 0 || index >= items.length) return;
    setMediaCaptions(prev => {
      if (index >= prev.length) {
        const next = prev.slice();
        while (next.length <= index) next.push({ en: "", ro: "" });
        next[index] = { ...next[index], [lang]: value };
        return next;
      }
      const next = prev.slice();
      next[index] = { ...next[index], [lang]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!titleEn || !titleRo || !categoryId || items.length === 0 || !user) {
      toast.error(language === 'en' ? "Please fill all required fields and upload at least one image" : "Vă rugăm să completați toate câmpurile obligatorii și să încărcați cel puțin o imagine");
      return;
    }
    setIsSaving(true);
    try {
      const mediaUrls = items.map(i => i.url);
      const hasAnyCaption = mediaCaptions.some(c => c?.en?.trim() || c?.ro?.trim());

      const payload = {
        type: 'carousel' as const,
        titleEn,
        titleRo,
        contentEn: descriptionEn,
        contentRo: descriptionRo,
        categoryId,
        location: location || undefined,
        mediaUrl: mediaUrls[0],
        mediaUrls,
        mediaCaptions: hasAnyCaption ? mediaCaptions : undefined,
        posterUrl: posterUrl || null,
      };

      if (isEditing && editingId) {
        await updateArticle({ ...payload, id: editingId, isPublished });
        toast.success(language === 'en' ? "Photo essay updated!" : "Eseul a fost actualizat!");
      } else {
        await createArticle({ ...payload, userId: user.id, isPublished: isAdmin });
        toast.success(language === 'en' ? "Photo essay created!" : "Eseul a fost creat!");
      }
      navigate("/admin");
    } catch (error) {
      console.error("Error saving carousel story:", error);
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

  const captionsFilled = mediaCaptions.filter(c => c?.en?.trim() || c?.ro?.trim()).length;

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
              ? (language === 'en' ? 'Editing · Photo essay' : 'Editare · Eseu foto')
              : (language === 'en' ? 'New entry · Photo essay' : 'Intrare nouă · Eseu foto')}
          </div>
          <h1 className="font-display italic font-medium m-0" style={{ fontSize: 'clamp(48px, 7vw, 96px)', lineHeight: 0.95, letterSpacing: '-0.01em', color: 'var(--parchment)' }}>
            {isEditing
              ? (language === 'en' ? 'Edit photo essay.' : 'Editează eseul foto.')
              : (language === 'en' ? 'Build a photo essay.' : 'Construiește un eseu foto.')}
          </h1>
          <p className="mt-5 max-w-[640px]" style={{ fontSize: 17, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {language === 'en'
              ? 'Order your frames as a sequence. Each image gets a caption shown beneath it on the page.'
              : 'Ordonează cadrele ca o secvență. Fiecare imagine primește o legendă afișată sub ea în pagină.'}
          </p>
        </div>
      </section>

      <section style={{ padding: '40px 0 60px' }} className="ed-form">
        <div className="ed-container">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
            {/* LEFT — meta */}
            <div className="flex flex-col gap-7 lg:sticky lg:top-24">
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

              <FormBlock title={language === 'en' ? 'Description (dek)' : 'Descriere (subtitlu)'}>
                <p className="font-ui text-[11px] uppercase mb-2" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                  {language === 'en' ? 'Used as the lead paragraph above the photos.' : 'Folosit ca paragraf principal deasupra fotografiilor.'}
                </p>
                <Field label={language === 'en' ? 'English' : 'Engleză'}>
                  <textarea
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    placeholder={language === 'en' ? 'What is this gallery about?' : 'Despre ce este această galerie?'}
                    rows={4}
                    maxLength={ARTICLE_LIMITS.CONTENT_MAX}
                    style={{ resize: 'vertical' }}
                  />
                </Field>
                <Field label={language === 'en' ? 'Romanian' : 'Română'}>
                  <textarea
                    value={descriptionRo}
                    onChange={(e) => setDescriptionRo(e.target.value)}
                    placeholder={language === 'en' ? 'What is this gallery about?' : 'Despre ce este această galerie?'}
                    rows={4}
                    maxLength={ARTICLE_LIMITS.CONTENT_MAX}
                    style={{ resize: 'vertical' }}
                  />
                </Field>
              </FormBlock>
            </div>

            {/* RIGHT — frames */}
            <div className="flex flex-col gap-6">
              {/* Poster (cover) — shown as the article thumbnail in listings and
                  as the hero on the article page. Optional: falls back to the
                  first frame for older essays without a dedicated poster. */}
              <FormBlock title={language === 'en' ? 'Poster (cover)' : 'Poster (copertă)'}>
                <p className="font-ui text-[11px] uppercase mb-2" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                  {language === 'en'
                    ? 'Used as the article thumbnail and hero image — does not appear in the gallery itself. Falls back to the first frame if left empty.'
                    : 'Folosită ca miniatură și ca imagine principală a articolului — nu apare în galerie. Dacă rămâne goală, se folosește primul cadru.'}
                </p>

                {posterUrl && (
                  <div className="ph relative mb-3" data-tone="warm" style={{ aspectRatio: '16/9' }}>
                    <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={removePoster}
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
              </FormBlock>

              <div className="flex items-end justify-between mb-1">
                <div>
                  <div className="eyebrow mb-2">{language === 'en' ? 'Frames' : 'Cadre'}</div>
                  <h2 className="font-display italic m-0" style={{ fontSize: 32, lineHeight: 1.1, color: 'var(--parchment)' }}>
                    {items.length === 0
                      ? (language === 'en' ? 'Add your first image.' : 'Adaugă prima imagine.')
                      : (language === 'en' ? `${items.length} frame${items.length === 1 ? '' : 's'}.` : `${items.length} ${items.length === 1 ? 'cadru' : 'cadre'}.`)}
                  </h2>
                </div>
                {items.length > 0 && (
                  <div className="font-ui text-[11px] uppercase text-right" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
                    <div><span style={{ color: 'var(--gold)' }}>{captionsFilled}</span> / {items.length}</div>
                    <div style={{ marginTop: 2 }}>{language === 'en' ? 'with caption' : 'cu legendă'}</div>
                  </div>
                )}
              </div>

              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />

              {/* Frame list — image LEFT, captions RIGHT */}
              <div className="flex flex-col gap-4">
                {items.map((item, index) => {
                  const isFirst = index === 0;
                  const isLast = index === items.length - 1;
                  const caption = mediaCaptions[index] ?? { en: '', ro: '' };
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 p-4"
                      style={{ border: '1px solid var(--line)', background: 'var(--overlay-panel-soft)' }}
                    >
                      {/* Image + index + reorder controls */}
                      <div className="relative">
                        <div className="ph relative overflow-hidden" data-tone="warm" style={{ aspectRatio: '1/1' }}>
                          <img
                            src={item.url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                            <span
                              className="font-ui text-[10px]"
                              style={{
                                background: 'var(--overlay-dark)',
                                color: 'var(--gold)',
                                padding: '3px 8px',
                                letterSpacing: '0.15em',
                                border: '1px solid var(--gold)',
                              }}
                            >
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            {isFirst && (
                              <span
                                className="font-ui text-[9px] flex items-center gap-1"
                                style={{
                                  background: 'var(--gold)',
                                  color: 'var(--ink)',
                                  padding: '3px 8px',
                                  letterSpacing: '0.15em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                <Star className="w-2.5 h-2.5 fill-current" />
                                {language === 'en' ? 'Cover' : 'Copertă'}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Reorder rail */}
                        <div className="flex items-center justify-between mt-2 gap-1">
                          <button
                            type="button"
                            onClick={() => moveImage(index, index - 1)}
                            disabled={isFirst}
                            aria-label={language === 'en' ? 'Move earlier' : 'Mută mai devreme'}
                            className="grid w-7 h-7 place-items-center rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:text-gold"
                            style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)' }}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImage(index, index + 1)}
                            disabled={isLast}
                            aria-label={language === 'en' ? 'Move later' : 'Mută mai târziu'}
                            className="grid w-7 h-7 place-items-center rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:text-gold"
                            style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)' }}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          {!isFirst && (
                            <button
                              type="button"
                              onClick={() => moveImage(index, 0)}
                              aria-label={language === 'en' ? 'Set as cover' : 'Setează copertă'}
                              className="grid w-7 h-7 place-items-center rounded-full transition-colors hover:text-gold"
                              style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)' }}
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            aria-label={language === 'en' ? 'Remove' : 'Elimină'}
                            className="grid w-7 h-7 place-items-center rounded-full transition-colors"
                            style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--oxblood-2)' }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Caption inputs — placed beside the image so the user
                          fills them while the frame is still in view. */}
                      <div className="flex flex-col gap-3 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="eyebrow">
                            {language === 'en' ? `Caption · Frame ${index + 1}` : `Legendă · Cadru ${index + 1}`}
                          </span>
                          <span className="font-ui text-[10px] uppercase" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                            {language === 'en' ? 'Optional' : 'Opțional'}
                          </span>
                        </div>
                        <Field label={language === 'en' ? 'English caption' : 'Legendă engleză'} compact>
                          <textarea
                            placeholder={language === 'en' ? 'Shown beneath this image on the article page…' : 'Afișată sub această imagine în pagina articolului…'}
                            value={caption.en}
                            onChange={(e) => updateCaption(index, 'en', e.target.value)}
                            maxLength={ARTICLE_LIMITS.MEDIA_CAPTION_MAX}
                            rows={3}
                            style={{ resize: 'vertical' }}
                          />
                          <div className="font-ui text-[10px] mt-1 text-right" style={{ color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
                            {caption.en.length}/{ARTICLE_LIMITS.MEDIA_CAPTION_MAX}
                          </div>
                        </Field>
                        <Field label={language === 'en' ? 'Romanian caption' : 'Legendă română'} compact>
                          <textarea
                            placeholder={language === 'en' ? 'Aceeași legendă, în română…' : 'Aceeași legendă, în română…'}
                            value={caption.ro}
                            onChange={(e) => updateCaption(index, 'ro', e.target.value)}
                            maxLength={ARTICLE_LIMITS.MEDIA_CAPTION_MAX}
                            rows={3}
                            style={{ resize: 'vertical' }}
                          />
                          <div className="font-ui text-[10px] mt-1 text-right" style={{ color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
                            {caption.ro.length}/{ARTICLE_LIMITS.MEDIA_CAPTION_MAX}
                          </div>
                        </Field>
                      </div>
                    </div>
                  );
                })}

                {!isFull && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-colors"
                    style={{
                      border: '2px dashed var(--line)',
                      background: isUploading ? 'rgba(201,169,110,0.05)' : 'transparent',
                      color: 'var(--text-dim)',
                    }}
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--gold)' }} />
                    ) : (
                      <>
                        <Plus className="w-6 h-6" style={{ color: 'var(--gold)' }} />
                        <span className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em' }}>
                          {language === 'en' ? `Add image (${items.length}/${ARTICLE_LIMITS.MEDIA_URLS_MAX})` : `Adaugă imagine (${items.length}/${ARTICLE_LIMITS.MEDIA_URLS_MAX})`}
                        </span>
                      </>
                    )}
                  </button>
                )}

                {isFull && (
                  <p className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.15em', color: 'var(--oxblood-2)' }}>
                    {language === 'en'
                      ? `Gallery limit reached (max ${ARTICLE_LIMITS.MEDIA_URLS_MAX}). Remove an image to add another.`
                      : `Limita galeriei atinsă (maxim ${ARTICLE_LIMITS.MEDIA_URLS_MAX}). Elimină o imagine pentru a mai adăuga.`}
                  </p>
                )}
              </div>
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
            disabled={isSaving || isUploading || items.length === 0}
            className="btn-ed"
            style={{ opacity: isSaving || isUploading || items.length === 0 ? 0.5 : 1 }}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {language === 'en' ? 'Saving…' : 'Se salvează…'}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {isEditing
                  ? (language === 'en' ? 'Save changes' : 'Salvează modificările')
                  : (language === 'en' ? 'Publish photo essay' : 'Publică eseul')}
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

export default CarouselStoryCreate;
