import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Category, CHAPTER_DELIMITER, ARTICLE_LIMITS, parseChapters, ArticleSubtype } from "@/lib/supabase";
import { fetchCategories, uploadUserFile, createArticle, updateArticle, fetchAnyArticle, deleteStorageFile, extractStoragePath } from "@/lib/supabase";
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
import {
  ArrowLeft,
  Loader2,
  Save,
  Image as ImageIcon,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { isAbortError } from "@/lib/utils";
import { COUNTIES, LOCATION_NONE } from "@/lib/constants";

const MIN_CHAPTERS = 1;
const MAX_CHAPTERS = 10;
// Per-chapter cap, derived so the delimiter-joined content can never exceed
// ARTICLE_LIMITS.CONTENT_MAX (which the DB enforces via a CHECK constraint).
// Joining N chapters inserts (N-1) delimiters, so reserve that headroom up
// front rather than letting MAX_CHAPTERS * 5000 + delimiters overshoot 50k.
const PER_CHAPTER_MAX = Math.floor(
  (ARTICLE_LIMITS.CONTENT_MAX - (MAX_CHAPTERS - 1) * CHAPTER_DELIMITER.length) / MAX_CHAPTERS
);

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const TextStoryCreate: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const isEditing = !!editingId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  // Tracks the in-bucket path for the cover image so we can clean it up
  // when the user replaces or clears the cover. Set both on load (from
  // an existing article) and after upload. NULL means "we don't own this
  // file" — typed URLs are left alone on replace.
  const [mediaStoragePath, setMediaStoragePath] = useState<string | null>(null);
  const [chaptersEn, setChaptersEn] = useState<string[]>([""]);
  const [chaptersRo, setChaptersRo] = useState<string[]>([""]);
  const [subtype, setSubtype] = useState<ArticleSubtype>("essay");
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const formSnapshot = JSON.stringify({ titleEn, titleRo, categoryId, location, mediaUrl, subtype, chaptersEn, chaptersRo });
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
          if (!article || article.type !== 'text') {
            toast.error(language === 'en' ? 'Article not found' : 'Articol negăsit');
            navigate('/admin', { replace: true });
            return;
          }
          setTitleEn(article.titleEn || '');
          setTitleRo(article.titleRo || '');
          setCategoryId(article.categoryId || '');
          setLocation(article.location || '');
          setMediaUrl(article.mediaUrl || '');
          // Backfill storage path so replacing the cover during edit
          // actually cleans up the original file in storage.
          setMediaStoragePath(article.mediaUrl ? extractStoragePath(article.mediaUrl, 'articles') : null);
          setSubtype((article.subtype as ArticleSubtype | null) || 'essay');
          setPublishImmediately(!!article.isPublished);
          const trimTrailing = (arr: string[]): string[] => {
            const out = [...arr];
            while (out.length > 1 && !out[out.length - 1].trim()) out.pop();
            return out;
          };
          const en = trimTrailing(parseChapters(article.contentEn || ''));
          const ro = trimTrailing(parseChapters(article.contentRo || ''));
          const len = Math.max(en.length, ro.length, 1);
          while (en.length < len) en.push('');
          while (ro.length < len) ro.push('');
          setChaptersEn(en);
          setChaptersRo(ro);
          initialSnapshotRef.current = JSON.stringify({
            titleEn: article.titleEn || '',
            titleRo: article.titleRo || '',
            categoryId: article.categoryId || '',
            location: article.location || '',
            mediaUrl: article.mediaUrl || '',
            subtype: (article.subtype as ArticleSubtype | null) || 'essay',
            chaptersEn: en,
            chaptersRo: ro,
          });
        } else {
          initialSnapshotRef.current = JSON.stringify({
            titleEn: '', titleRo: '', categoryId: '', location: '', mediaUrl: '',
            subtype: 'essay', chaptersEn: [''], chaptersRo: [''],
          });
        }
      } catch (err) {
        if (!isAbortError(err)) console.error("Error loading text data:", err);
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!user?.id) {
      toast.error(language === "en" ? "Not authenticated" : "Neautentificat");
      event.target.value = "";
      return;
    }
    setIsUploading(true);
    try {
      // Best-effort cleanup of the previous upload so replacing the cover
      // doesn't leave the old file orphaned in the bucket. We only delete
      // when we have a tracked path — typed URLs (paste box) aren't ours
      // to remove.
      const previousPath = mediaStoragePath;
      const { publicUrl, storagePath } = await uploadUserFile(file, {
        bucket: "articles",
        kind: "image",
        userId: user.id,
      });
      setMediaUrl(publicUrl);
      setMediaStoragePath(storagePath);
      sessionUploadsRef.current.add(storagePath);
      if (previousPath && previousPath !== storagePath) {
        sessionUploadsRef.current.delete(previousPath);
        void deleteStorageFile('articles', previousPath);
      }
      toast.success(language === "en" ? "Image uploaded" : "Imagine încărcată");
    } catch (error) {
      console.error("Error uploading image:", error);
      const message = error instanceof Error ? error.message : (language === "en" ? "Error uploading image" : "Eroare la încărcarea imaginii");
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleRemoveCover = () => {
    if (mediaStoragePath) {
      sessionUploadsRef.current.delete(mediaStoragePath);
      void deleteStorageFile('articles', mediaStoragePath);
    }
    setMediaUrl('');
    setMediaStoragePath(null);
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
      toast.error(language === "en" ? "Please fix the highlighted fields" : "Te rugăm să corectezi câmpurile evidențiate");
      return;
    }
    setIsSaving(true);
    try {
      const filledEn = [...chaptersEn];
      const filledRo = [...chaptersRo];
      while (filledEn.length > 1 && !filledEn[filledEn.length - 1].trim() && !filledRo[filledRo.length - 1]?.trim()) {
        filledEn.pop();
        filledRo.pop();
      }

      const payload = {
        type: 'text' as const,
        subtype,
        titleEn,
        titleRo,
        contentEn: filledEn.join(CHAPTER_DELIMITER),
        contentRo: filledRo.join(CHAPTER_DELIMITER),
        categoryId,
        location: location || undefined,
        mediaUrl: mediaUrl || null,
      };

      if (isEditing && editingId) {
        await updateArticle({ ...payload, id: editingId, isPublished: isAdmin ? publishImmediately : false });
        toast.success(language === "en" ? "Story updated!" : "Povestea a fost actualizată!");
      } else {
        await createArticle({ ...payload, userId: user.id, isPublished: isAdmin ? publishImmediately : false });
        toast.success(language === "en" ? "Story created!" : "Povestea a fost creată!");
      }
      savedRef.current = true;
      navigate("/admin");
    } catch (error) {
      if (!isAbortError(error)) console.error("Error saving text story:", error);
      const message = error instanceof Error ? error.message : (language === "en" ? "Error saving story" : "Eroare la salvarea poveștii");
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
              ? (language === 'en' ? 'Editing · Long read' : 'Editare · Lectură lungă')
              : (language === 'en' ? 'New entry · Long read' : 'Intrare nouă · Lectură lungă')}
          </div>
          <h1 className="font-display italic font-medium m-0" style={{ fontSize: 'clamp(48px, 7vw, 96px)', lineHeight: 0.95, letterSpacing: '-0.01em', color: 'var(--parchment)' }}>
            {isEditing
              ? (language === 'en' ? 'Edit long read.' : 'Editează lectura.')
              : (language === 'en' ? 'Write a long read.' : 'Scrie o lectură lungă.')}
          </h1>
          <p className="mt-5 max-w-[640px]" style={{ fontSize: 17, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {language === 'en'
              ? 'Up to ten chapters, in two languages. The first chapter renders with a drop cap; later chapters get Roman-numeral headers.'
              : 'Până la zece capitole, în două limbi. Primul capitol primește o literă inițială; capitolele următoare au cifre romane.'}
          </p>
        </div>
      </section>

      {/* Validation summary */}
      {showErrors && validationErrors.length > 0 && (
        <section style={{ padding: '20px 0 0' }}>
          <div className="ed-container">
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-3 p-5"
              style={{ border: '1px solid var(--oxblood-2)', background: 'rgba(168,60,60,0.08)' }}
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--oxblood-2)' }} />
              <div>
                <p className="font-display italic m-0 mb-2" style={{ fontSize: 18, color: 'var(--oxblood-2)' }}>
                  {language === 'en'
                    ? `Please fix ${validationErrors.length} ${validationErrors.length === 1 ? 'issue' : 'issues'}.`
                    : `Te rugăm să corectezi ${validationErrors.length} ${validationErrors.length === 1 ? 'problemă' : 'probleme'}.`}
                </p>
                <ul className="m-0 pl-5" style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.7 }}>
                  {validationErrors.map(e => <li key={e.field}>{e.message}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={{ padding: '40px 0 60px' }} className="ed-form">
        <div className="ed-container">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 items-start">
            {/* LEFT — meta */}
            <div className="flex flex-col gap-7 lg:sticky lg:top-24">
              <FormBlock title={language === 'en' ? 'Story details' : 'Detalii poveste'}>
                <Field label={language === 'en' ? 'Title (English)' : 'Titlu (Engleză)'} required error={showErrors ? errorFor('titleEn')?.message : undefined}>
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    placeholder={language === 'en' ? 'Enter title in English' : 'Introdu titlul în engleză'}
                    maxLength={ARTICLE_LIMITS.TITLE_MAX}
                    style={showErrors && errorFor('titleEn') ? { borderColor: 'var(--oxblood-2)' } : undefined}
                  />
                </Field>
                <Field label={language === 'en' ? 'Title (Romanian)' : 'Titlu (Română)'} required error={showErrors ? errorFor('titleRo')?.message : undefined}>
                  <input
                    type="text"
                    value={titleRo}
                    onChange={(e) => setTitleRo(e.target.value)}
                    placeholder={language === 'en' ? 'Enter title in Romanian' : 'Introdu titlul în română'}
                    maxLength={ARTICLE_LIMITS.TITLE_MAX}
                    style={showErrors && errorFor('titleRo') ? { borderColor: 'var(--oxblood-2)' } : undefined}
                  />
                </Field>
                <Field label={language === 'en' ? 'Category' : 'Categorie'} required error={showErrors ? errorFor('category')?.message : undefined}>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="rounded-sm border-line bg-[color:var(--ink-2)]" style={showErrors && errorFor('category') ? { borderColor: 'var(--oxblood-2)' } : undefined}>
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
                <Field label={language === 'en' ? 'Format' : 'Format'}>
                  <Select value={subtype} onValueChange={(v) => setSubtype(v as ArticleSubtype)}>
                    <SelectTrigger className="rounded-sm border-line bg-[color:var(--ink-2)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="essay">{language === 'en' ? 'Long read (essay)' : 'Lectură lungă (eseu)'}</SelectItem>
                      <SelectItem value="poetry">{language === 'en' ? 'Poem' : 'Poem'}</SelectItem>
                      <SelectItem value="short_story">{language === 'en' ? 'Short story' : 'Povestire'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="font-ui text-[10px] uppercase mt-1.5" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                    {subtype === 'poetry'
                      ? (language === 'en' ? 'Line breaks are preserved; no drop cap.' : 'Pauzele de rând sunt păstrate; fără literă inițială.')
                      : subtype === 'short_story'
                        ? (language === 'en' ? 'Prose layout without a drop cap.' : 'Aspect de proză, fără literă inițială.')
                        : (language === 'en' ? 'Essay layout with a drop cap on the first chapter.' : 'Aspect de eseu, cu literă inițială în primul capitol.')}
                  </p>
                </Field>
              </FormBlock>

              <FormBlock title={language === 'en' ? 'Lead image' : 'Imagine principală'}>
                {mediaUrl ? (
                  <div className="ph relative" data-tone="warm" style={{ aspectRatio: '4/3' }}>
                    <img src={mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="absolute top-2 right-2 grid w-8 h-8 place-items-center rounded-full transition-colors"
                      style={{ background: 'var(--overlay-dark)', border: '1px solid var(--oxblood-2)', color: 'var(--oxblood-2)' }}
                      aria-label={language === 'en' ? 'Remove cover image' : 'Elimină imaginea'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-colors"
                    style={{
                      border: '2px dashed var(--line)',
                      background: isUploading ? 'rgba(201,169,110,0.05)' : 'transparent',
                      color: 'var(--text-dim)',
                      aspectRatio: '4/3',
                    }}
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--gold)' }} />
                    ) : (
                      <>
                        <ImageIcon className="w-6 h-6" style={{ color: 'var(--gold)' }} />
                        <span className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.18em' }}>
                          {language === 'en' ? 'Upload cover' : 'Încarcă coperta'}
                        </span>
                        <span className="font-ui text-[10px]" style={{ color: 'var(--text-mute)' }}>
                          JPG · PNG · WebP · 10 MB
                        </span>
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
                <Field label={language === 'en' ? 'Or paste image URL' : 'Sau lipește URL imagine'}>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={mediaUrl}
                    onChange={(e) => {
                      // Manual URL paste means the user is taking ownership of
                      // a URL we didn't upload. Forget any tracked storage
                      // path so we don't accidentally delete an unrelated
                      // file later.
                      setMediaUrl(e.target.value);
                      setMediaStoragePath(null);
                    }}
                    maxLength={ARTICLE_LIMITS.MEDIA_URL_MAX}
                  />
                </Field>
              </FormBlock>

              {isAdmin && (
                <FormBlock title={language === 'en' ? 'Visibility' : 'Vizibilitate'}>
                  <label className="flex items-start gap-3 cursor-pointer select-none" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={publishImmediately}
                      onChange={(e) => setPublishImmediately(e.target.checked)}
                      className="mt-1 w-4 h-4 accent-[color:var(--gold)]"
                    />
                    <span style={{ flex: 1, marginBottom: 0, textTransform: 'none', letterSpacing: 'normal' }}>
                      <span className="font-display italic block" style={{ color: 'var(--parchment)', fontSize: 17 }}>
                        {isEditing
                          ? (language === 'en' ? 'Published' : 'Publicat')
                          : (language === 'en' ? 'Publish immediately' : 'Publică imediat')}
                      </span>
                      <span className="font-ui text-[11px] uppercase mt-1 block" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                        {isEditing
                          ? (language === 'en' ? 'Toggle off to revert to draft.' : 'Dezactivează pentru a reveni la ciornă.')
                          : (language === 'en' ? 'Otherwise saved as a draft only you can see.' : 'Altfel se salvează ca ciornă, vizibilă doar pentru tine.')}
                      </span>
                    </span>
                  </label>
                </FormBlock>
              )}
            </div>

            {/* RIGHT — chapters */}
            <div className="flex flex-col gap-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="eyebrow mb-2">{language === 'en' ? 'Chapters' : 'Capitole'}</div>
                  <h2 className="font-display italic m-0" style={{ fontSize: 32, lineHeight: 1.1, color: 'var(--parchment)' }}>
                    {chaptersEn.length} / {MAX_CHAPTERS}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={addChapter}
                  disabled={chaptersEn.length >= MAX_CHAPTERS}
                  className="btn-ed btn-ed-ghost"
                  style={{ opacity: chaptersEn.length >= MAX_CHAPTERS ? 0.4 : 1 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Add chapter' : 'Adaugă capitol'}
                </button>
              </div>

              {showErrors && errorFor('content') && (
                <p className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.15em', color: 'var(--oxblood-2)' }}>
                  {errorFor('content')?.message}
                </p>
              )}

              <div className="flex flex-col gap-6">
                {chaptersEn.map((_, index) => (
                  <div
                    key={index}
                    className="p-6 flex flex-col gap-4"
                    style={{ border: '1px solid var(--line)', background: 'var(--overlay-panel-soft)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-3">
                        <span
                          className="font-display italic"
                          style={{ color: 'var(--gold)', fontSize: 28, lineHeight: 1, fontStyle: 'italic' }}
                        >
                          {ROMAN[index]}.
                        </span>
                        <span className="eyebrow">
                          {language === 'en' ? `Chapter ${index + 1}` : `Capitolul ${index + 1}`}
                        </span>
                        {index === 0 && (
                          <span className="font-ui text-[10px] uppercase" style={{ letterSpacing: '0.18em', color: 'var(--text-mute)' }}>
                            · {language === 'en' ? 'Drop cap' : 'Literă inițială'}
                          </span>
                        )}
                      </div>
                      {chaptersEn.length > MIN_CHAPTERS && (
                        <button
                          type="button"
                          onClick={() => removeChapter(index)}
                          className="grid w-8 h-8 place-items-center rounded-full transition-colors"
                          style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-mute)' }}
                          aria-label={language === 'en' ? `Remove chapter ${index + 1}` : `Elimină capitolul ${index + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label={language === 'en' ? 'English' : 'Engleză'} compact>
                        <textarea
                          rows={8}
                          value={chaptersEn[index]}
                          onChange={(e) => updateChapter('en', index, e.target.value)}
                          placeholder={language === 'en' ? 'Write this chapter in English. Wrap a paragraph with > to make it a pull quote.' : 'Scrie acest capitol în engleză. Începe un paragraf cu > pentru un citat scos în evidență.'}
                          maxLength={PER_CHAPTER_MAX}
                          style={{ resize: 'vertical', fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.65 }}
                        />
                        <p className="font-ui text-[10px] uppercase mt-1.5" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                          {chaptersEn[index]?.length || 0} / {PER_CHAPTER_MAX}
                        </p>
                      </Field>
                      <Field label={language === 'en' ? 'Romanian' : 'Română'} compact>
                        <textarea
                          rows={8}
                          value={chaptersRo[index]}
                          onChange={(e) => updateChapter('ro', index, e.target.value)}
                          placeholder={language === 'en' ? 'Write this chapter in Romanian.' : 'Scrie acest capitol în română.'}
                          maxLength={PER_CHAPTER_MAX}
                          style={{ resize: 'vertical', fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.65 }}
                        />
                        <p className="font-ui text-[10px] uppercase mt-1.5" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                          {chaptersRo[index]?.length || 0} / {PER_CHAPTER_MAX}
                        </p>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>

              <p className="font-ui text-[11px] uppercase" style={{ letterSpacing: '0.15em', color: 'var(--text-mute)' }}>
                {language === 'en'
                  ? `Up to ${MAX_CHAPTERS} chapters. Empty trailing chapters are removed automatically on save.`
                  : `Până la ${MAX_CHAPTERS} capitole. Capitolele goale de la final sunt eliminate automat la salvare.`}
              </p>
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
            disabled={isSaving || isUploading}
            className="btn-ed"
            style={{ opacity: isSaving || isUploading ? 0.5 : 1 }}
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
                  : (isAdmin && publishImmediately
                      ? (language === 'en' ? 'Publish story' : 'Publică povestea')
                      : (language === 'en' ? 'Save as draft' : 'Salvează ca ciornă'))}
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

const Field: React.FC<{ label: string; required?: boolean; compact?: boolean; error?: string; children: React.ReactNode }> = ({ label, required, compact, error, children }) => (
  <div className={compact ? '' : 'flex flex-col'}>
    <label style={{ marginBottom: compact ? 4 : 8 }}>
      {label}
      {required && <span style={{ color: 'var(--oxblood-2)', marginLeft: 4 }}>*</span>}
    </label>
    {children}
    {error && (
      <p className="font-ui text-[10px] uppercase mt-1.5" style={{ letterSpacing: '0.15em', color: 'var(--oxblood-2)' }}>
        {error}
      </p>
    )}
  </div>
);

export default TextStoryCreate;
