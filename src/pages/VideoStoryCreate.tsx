import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Category } from "@/lib/supabase";
import { fetchCategories, uploadUserFile, uploadSubtitleFile, createArticle, updateArticle, deleteStorageFile, fetchAnyArticle, extractStoragePath, previewArticle, type Article } from "@/lib/supabase";
import { ARTICLE_LIMITS, MAX_VIDEO_BYTES, asMb } from "@/lib/supabase";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { PublishingFields, usePublishGuard, publishAtToSave, scheduleProblem, toLocalInput, fromLocalInput, type CheckItem } from "@/components/organisms/PublishingFields";
import { useStoryDraft } from "@/hooks/use-story-draft";
import { DraftOfferBanner, PreviewLink, useSaveBar } from "@/components/organisms/StoryDraftUi";
import { FormBlock, Field } from "@/components/ui/form-field";
import { PageHead } from "@/components/layout/PageHead";
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
import { PlaceTimeFields } from "@/components/organisms/PlaceTimeFields";
import { StoryNoteFields, EMPTY_NOTE, shouldSendNote, type StoryNoteDraft } from "@/components/organisms/StoryNoteFields";
import { EMPTY_PLACE_DATE, draftFromArticle, draftToPlaceDate, placeDateErrors, shouldSendPlaceDate, type PlaceDateDraft } from "@/lib/atlas/place-date";
import {
  FilmExtrasFields, EMPTY_FILM_EXTRAS, filmExtrasFromArticle, filmExtrasSnapshot, filmExtrasErrors,
  shouldSendFilmExtras, draftToFilm, type FilmExtrasDraft,
} from "@/components/organisms/FilmExtrasFields";
import { prepareSubtitleFile } from "@/lib/subtitles";

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
  // Pre-existing article media the user removed/replaced this session. These
  // files are still referenced by the saved article, so deleting them
  // immediately would break the article if the user cancels — they're only
  // deleted after a successful save.
  const pendingDeletesRef = useRef<Set<string>>(new Set());
  // Serialized form state at load time; isDirty compares against it so an
  // unchanged edit page doesn't trigger the "unsaved changes" prompt.
  const initialSnapshotRef = useRef<string | null>(null);

  // Removes a file the form no longer references. Session uploads are ours
  // and unsaved, so they can be deleted right away; pre-existing article
  // media is deferred until the save commits (see pendingDeletesRef).
  const discardStoredFile = (path: string | null) => {
    if (!path) return;
    if (sessionUploadsRef.current.has(path)) {
      sessionUploadsRef.current.delete(path);
      void deleteStorageFile('articles', path);
    } else {
      pendingDeletesRef.current.add(path);
    }
  };

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
  const [placeDate, setPlaceDate] = useState<PlaceDateDraft>(EMPTY_PLACE_DATE);
  // Whether the story was read with the place/date columns; see
  // shouldSendPlaceDate().
  const placeDateSupportedRef = useRef(false);
  const [note, setNote] = useState<StoryNoteDraft>(EMPTY_NOTE);
  const noteSupportedRef = useRef(false);
  // Subtitles and chapters (migration 20261102140000).
  const [film, setFilm] = useState<FilmExtrasDraft>(EMPTY_FILM_EXTRAS);
  const filmSupportedRef = useRef(false);
  const [subtitleUploading, setSubtitleUploading] = useState<'en' | 'ro' | null>(null);
  const [showFilmErrors, setShowFilmErrors] = useState(false);
  const [showPlaceErrors, setShowPlaceErrors] = useState(false);
  const placeErrors = placeDateErrors(placeDate, language);
  // Publishing: a schedule (a datetime-local value, "" when there is none)
  // and what the loaded story's state was.
  const [publishAt, setPublishAt] = useState("");
  const [hadSchedule, setHadSchedule] = useState(false);
  const [wasPublished, setWasPublished] = useState(false);
  // The saved story's dates: when it was last saved (does a kept copy
  // predate that?) and the date readers see (for the preview).
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const [loadedCreatedAt, setLoadedCreatedAt] = useState<string | null>(null);

  // The status and the schedule count as changes too: leaving after
  // choosing "Scheduled" and a time would otherwise lose them silently.
  const formState = { titleEn, titleRo, descriptionEn, descriptionRo, categoryId, location, videoUrl, posterUrl, placeDate, note, film: filmExtrasSnapshot(film), published: isPublished, publishAt };
  const formSnapshot = JSON.stringify(formState);
  const isDirty = initialSnapshotRef.current !== null && formSnapshot !== initialSnapshotRef.current;

  useUnsavedChangesWarning(isDirty && !isSaving);

  useSaveBar();

  // A copy of unsaved work kept in this browser, and the Preview tab.
  const draft = useStoryDraft<typeof formState>({
    userId: user?.id,
    kind: 'video',
    storyId: editingId ?? null,
    ready: !isLoading && initialSnapshotRef.current !== null,
    form: formState,
    snapshot: formSnapshot,
    dirty: isDirty,
    updatedAt: loadedUpdatedAt,
    buildPreview: () => buildPreviewArticle(),
    onRestore: (f) => applyForm(f),
  });

  // Confirm before leaving via the in-editor Back/Cancel buttons while there
  // are unsaved changes, using the site's styled dialog. (beforeunload covers
  // tab close/refresh; this covers the editor's own exits.)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // What a finished story has.
  const checklist: CheckItem[] = [
    { label: language === 'en' ? 'A title in English' : 'Un titlu în engleză', done: !!titleEn.trim() },
    { label: language === 'en' ? 'A title in Romanian' : 'Un titlu în română', done: !!titleRo.trim() },
    { label: language === 'en' ? 'A synopsis in both languages' : 'Un sinopsis în ambele limbi', done: !!descriptionEn.trim() && !!descriptionRo.trim() },
    { label: language === 'en' ? 'The film and its poster' : 'Filmul și afișul lui', done: !!videoUrl && !!posterUrl },
    { label: language === 'en' ? 'A place on the map' : 'Un loc pe hartă', done: !!location || !!placeDate.coords.trim() },
  ];
  const publishGuard = usePublishGuard({
    language,
    // Asked once, as the story first goes out; not on every later edit.
    goingOut: isAdmin && !wasPublished && (isPublished || !!publishAt),
    scheduled: !isPublished && !!publishAt,
    checklist,
  });
  const leaveToDashboard = () => {
    if (isDirty && !isSaving) {
      setShowLeaveConfirm(true);
      return;
    }
    navigate('/admin');
  };

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
          // Writers can only edit their own work — RLS rejects the save
          // anyway, but failing here avoids a dead-end form.
          if (!isAdmin && article.userId !== user?.id) {
            toast.error(language === 'en' ? 'You can only edit your own stories' : 'Poți edita doar propriile povești');
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
          setPublishAt(article.isPublished ? "" : toLocalInput(article.publishAt));
          setHadSchedule(!!article.publishAt);
          setWasPublished(!!article.isPublished);
          setLoadedUpdatedAt(article.updatedAt ?? article.createdAt ?? null);
          setLoadedCreatedAt(article.createdAt ?? null);
          const loadedPlaceDate = draftFromArticle(article);
          setPlaceDate(loadedPlaceDate.draft);
          placeDateSupportedRef.current = loadedPlaceDate.supported;
          const loadedNote = { en: article.noteEn ?? '', ro: article.noteRo ?? '' };
          setNote(loadedNote);
          noteSupportedRef.current = 'noteEn' in article;
          const loadedFilm = filmExtrasFromArticle(article, (url) => extractStoragePath(url, 'articles'));
          setFilm(loadedFilm.draft);
          filmSupportedRef.current = loadedFilm.supported;
          initialSnapshotRef.current = JSON.stringify({
            titleEn: article.titleEn || '',
            titleRo: article.titleRo || '',
            descriptionEn: article.contentEn || '',
            descriptionRo: article.contentRo || '',
            categoryId: article.categoryId || '',
            location: article.location || '',
            videoUrl: article.mediaUrl || '',
            posterUrl: article.posterUrl || '',
            placeDate: loadedPlaceDate.draft,
            note: loadedNote,
            film: filmExtrasSnapshot(loadedFilm.draft),
            published: !!article.isPublished,
            publishAt: article.isPublished ? "" : toLocalInput(article.publishAt),
          });
        } else {
          initialSnapshotRef.current = JSON.stringify({
            titleEn: '', titleRo: '', descriptionEn: '', descriptionRo: '',
            categoryId: '', location: '', videoUrl: '', posterUrl: '', placeDate: EMPTY_PLACE_DATE, note: EMPTY_NOTE,
            film: filmExtrasSnapshot(EMPTY_FILM_EXTRAS), published: false, publishAt: '',
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
  // A copy kept for later (unsaved work, see useStoryDraft) points at them,
  // so then they stay; the storage sweep finds any that are never used.
  // (flushDraft never changes: this runs once, on leaving.)
  const flushDraft = draft.flush;
  useEffect(() => () => {
    const kept = flushDraft();
    if (savedRef.current || kept) return;
    for (const path of sessionUploadsRef.current) {
      void deleteStorageFile('articles', path);
    }
  }, [flushDraft]);

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
      // Upload the replacement FIRST. The previous flow deleted the current
      // video/poster from storage before the new upload even started — a
      // failed upload (or a later cancel) left the published article
      // pointing at deleted files.
      const previousVideoPath = videoStoragePath;
      const previousPosterPath = posterStoragePath;

      // No maxBytes override: this used to pass 500 MB explicitly, which
      // silently overrode MAX_VIDEO_BYTES in lib/supabase.ts and made lowering
      // that constant to 150 MB a no-op for the only path that uploads video.
      // The constant is the single source of truth now, and the `articles`
      // bucket enforces the same 150 MB server-side.
      const { publicUrl, storagePath } = await uploadUserFile(file, {
        bucket: 'articles',
        kind: 'video',
        userId: user.id,
        subfolder: 'stories/videos',
      });

      // Only now discard the replaced files (session uploads immediately,
      // the article's pre-existing media after a successful save).
      discardStoredFile(previousVideoPath);
      discardStoredFile(previousPosterPath);

      setVideoUrl(publicUrl);
      setVideoStoragePath(storagePath);
      setPosterUrl("");
      setPosterStoragePath(null);
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
      const previousPosterPath = posterStoragePath;
      const { publicUrl, storagePath } = await uploadUserFile(file, {
        bucket: 'articles',
        kind: 'image',
        userId: user.id,
        subfolder: 'stories/posters',
      });
      // Discard the replaced poster only after the new upload succeeded.
      if (previousPosterPath !== storagePath) {
        discardStoredFile(previousPosterPath);
      }
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

  // Subtitles: read the file, check and convert it to WebVTT, upload it,
  // and only then let go of the file it replaces.
  const handleSubtitleUpload = async (lang: 'en' | 'ro', file: File) => {
    if (!user?.id) {
      toast.error(language === 'en' ? "Not authenticated" : "Neautentificat");
      return;
    }
    const previousPath = film.subtitles[lang]?.path ?? null;
    setSubtitleUploading(lang);
    try {
      const prepared = prepareSubtitleFile(await file.text(), file.name, language);
      const { publicUrl, storagePath } = await uploadSubtitleFile(prepared.vtt, user.id);
      sessionUploadsRef.current.add(storagePath);
      if (previousPath && previousPath !== storagePath) discardStoredFile(previousPath);
      setFilm((prev) => ({ ...prev, subtitles: { ...prev.subtitles, [lang]: { url: publicUrl, path: storagePath, lines: prepared.cues } } }));
      toast.success(language === 'en' ? `Subtitles uploaded: ${prepared.cues} lines` : `Subtitrare încărcată: ${prepared.cues} replici`);
    } catch (error) {
      console.error("Error uploading subtitles:", error);
      toast.error(error instanceof Error ? error.message : (language === 'en' ? "Error uploading subtitles" : "Eroare la încărcarea subtitrării"));
    } finally {
      setSubtitleUploading(null);
    }
  };

  const handleSubtitleRemove = (lang: 'en' | 'ro') => {
    discardStoredFile(film.subtitles[lang]?.path ?? null);
    setFilm((prev) => ({ ...prev, subtitles: { ...prev.subtitles, [lang]: null } }));
  };

  /** What a save sends. */
  const buildPayload = () => ({
    type: 'video' as const,
    titleEn,
    titleRo,
    contentEn: descriptionEn,
    contentRo: descriptionRo,
    categoryId,
    location: location || undefined,
    mediaUrl: videoUrl,
    posterUrl: posterUrl || null,
    ...(shouldSendPlaceDate(placeDate, placeDateSupportedRef.current) ? { placeDate: draftToPlaceDate(placeDate) } : {}),
    ...(shouldSendNote(note, noteSupportedRef.current) ? { note: { en: note.en, ro: note.ro } } : {}),
    ...(shouldSendFilmExtras(film, filmSupportedRef.current) ? { film: draftToFilm(film) } : {}),
  });

  /** The film as readers would see it once saved: the Preview tab's page. */
  const buildPreviewArticle = (): Article => {
    const at = isPublished ? null : fromLocalInput(publishAt);
    return previewArticle(
      { ...buildPayload(), userId: user?.id ?? '', isPublished, publishAt: at },
      // A scheduled story takes its time as its date; otherwise the date it has, or today's.
      { id: editingId ?? 'preview', createdAt: at ?? loadedCreatedAt ?? new Date().toISOString() },
    );
  };

  /** Puts a kept copy back into the form. */
  const applyForm = (f: typeof formState) => {
    setTitleEn(f.titleEn ?? '');
    setTitleRo(f.titleRo ?? '');
    setDescriptionEn(f.descriptionEn ?? '');
    setDescriptionRo(f.descriptionRo ?? '');
    setCategoryId(f.categoryId ?? '');
    setLocation(f.location ?? '');
    setVideoUrl(f.videoUrl ?? '');
    setVideoStoragePath(f.videoUrl ? extractStoragePath(f.videoUrl, 'articles') : null);
    setPosterUrl(f.posterUrl ?? '');
    setPosterStoragePath(f.posterUrl ? extractStoragePath(f.posterUrl, 'articles') : null);
    setPlaceDate(f.placeDate ?? EMPTY_PLACE_DATE);
    setNote(f.note ?? EMPTY_NOTE);
    // The copy keeps the subtitle files' addresses; their paths follow from them.
    const sub = (url: string | null | undefined) => (url ? { url, path: extractStoragePath(url, 'articles') } : null);
    setFilm({ subtitles: { en: sub(f.film?.en), ro: sub(f.film?.ro) }, chapters: f.film?.chapters ?? [] });
    if (isAdmin) {
      setIsPublished(!!f.published);
      setPublishAt(f.published ? '' : f.publishAt ?? '');
    }
  };

  const handleSave = async () => {
    const scheduleError = isAdmin ? scheduleProblem(isPublished, publishAt, language) : null;
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    if (!titleEn || !titleRo || !categoryId || !videoUrl || !user) {
      toast.error(language === 'en' ? "Please fill all required fields and upload a video" : "Vă rugăm să completați toate câmpurile obligatorii și să încărcați un video");
      return;
    }
    if (placeErrors.length) {
      setShowPlaceErrors(true);
      toast.error(placeErrors[0].message);
      return;
    }
    const filmErrors = filmExtrasErrors(film, language);
    if (filmErrors.length) {
      setShowFilmErrors(true);
      toast.error(filmErrors[0]);
      return;
    }
    setIsSaving(true);
    try {
      const payload = buildPayload();
      // The visibility checkbox is admin-only; writers pass their story's
      // loaded state through and the DB trigger
      // (enforce_article_publish_rights) pins it server-side regardless.
      if (isEditing && editingId) {
        // Only an editor schedules; a writer's save leaves the schedule alone.
        const at = isAdmin ? publishAtToSave(isPublished, publishAt, hadSchedule) : undefined;
        await updateArticle({ ...payload, id: editingId, isPublished: isPublished, ...(at !== undefined ? { publishAt: at } : {}) });
        toast.success(language === 'en' ? "Film updated!" : "Filmul a fost actualizat!");
      } else {
        const at = isAdmin ? publishAtToSave(isPublished, publishAt, false) : undefined;
        await createArticle({ ...payload, userId: user.id, isPublished: isAdmin && isPublished, ...(at !== undefined ? { publishAt: at } : {}) });
        toast.success(language === 'en' ? "Film created!" : "Filmul a fost creat!");
      }
      savedRef.current = true;
      draft.clear();
      // The save committed — the article no longer references media the
      // user removed/replaced this session, so it's safe to delete now.
      for (const path of pendingDeletesRef.current) {
        void deleteStorageFile('articles', path);
      }
      pendingDeletesRef.current.clear();
      navigate("/admin");
    } catch (error) {
      console.error("Error saving video story:", error);
      const message = error instanceof Error ? error.message : (language === 'en' ? "Error saving story" : "Eroare la salvarea poveștii");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Editor routes have no <title> otherwise (the static index.html fallback
  // is stripped at boot). noindex mirrors robots.txt's /admin block.
  const pageHead = (
    <PageHead
      title={isEditing
        ? (language === 'en' ? 'Edit film' : 'Editează filmul')
        : (language === 'en' ? 'Publish a film' : 'Publică un film')}
      description={language === 'en' ? 'Editorial dashboard — story editor.' : 'Panou editorial — editor de povești.'}
      language={language}
    >
      <meta name="robots" content="noindex, nofollow" />
    </PageHead>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        {pageHead}
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--gold)' }} />
      </div>
    );
  }

  return (
    <div className="screen-anim pb-32">
      {pageHead}
      {publishGuard.dialog}
      <UnsavedChangesDialog
        open={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        onConfirm={() => { draft.clear(); navigate('/admin'); }}
        language={language}
      />
      {/* Page hero */}
      <section style={{ padding: '60px 0 32px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="ed-container">
          <button
            onClick={leaveToDashboard}
            className="flex items-center gap-2 mb-6 transition-colors hover:text-gold cursor-pointer"
            style={{ color: 'var(--text-dim)', background: 'transparent', border: 0, fontFamily: 'var(--ui)', fontSize: 14 }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {language === 'en' ? 'Back to dashboard' : 'Înapoi la panou'}
          </button>
          <div className="eyebrow mb-3">
            {isEditing
              ? (language === 'en' ? 'Editing · Film' : 'Editare · Film')
              : (language === 'en' ? 'New entry · Film' : 'Intrare nouă · Film')}
          </div>
          <h1 className="font-display font-medium m-0" style={{ fontSize: 'clamp(48px, 7vw, 96px)', lineHeight: 0.95, letterSpacing: '-0.01em', color: 'var(--parchment)' }}>
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

      <DraftOfferBanner offer={draft.offer} language={language} onRestore={draft.restore} onDiscard={draft.dismiss} />

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
                    <SelectTrigger className="rounded-xl border-line bg-[color:var(--ink-2)]">
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
                    <SelectTrigger className="rounded-xl border-line bg-[color:var(--ink-2)]">
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

              <PublishingFields
                language={language}
                isAdmin={isAdmin}
                published={isPublished}
                onPublished={setIsPublished}
                publishAt={publishAt}
                onPublishAt={setPublishAt}
                checklist={checklist}
              />

              <FormBlock title={language === 'en' ? 'Synopsis' : 'Sinopsis'}>
                <p className="font-ui text-[13px] mb-2" style={{ color: 'var(--text-mute)' }}>
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
                <h2 className="font-display m-0" style={{ fontSize: 28, lineHeight: 1.1, color: 'var(--parchment)' }}>
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
                  <div className="flex items-center justify-between p-3" style={{ border: '1px solid var(--line-soft)', background: 'var(--paper)', borderRadius: 18 }}>
                    <span className="font-ui text-[13px] flex items-center gap-2" style={{ color: 'var(--gold)' }}>
                      <span className="rounded-full" style={{ width: 6, height: 6, background: 'var(--gold)' }} />
                      {language === 'en' ? 'Video ready' : 'Video pregătit'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        discardStoredFile(videoStoragePath);
                        discardStoredFile(posterStoragePath);
                        setVideoUrl('');
                        setPosterUrl('');
                        setVideoStoragePath(null);
                        setPosterStoragePath(null);
                      }}
                      className="grid w-8 h-8 place-items-center rounded-full transition-colors"
                      style={{ border: '1px solid var(--line)', background: 'transparent', color: 'var(--danger)' }}
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
                      <span className="font-ui text-[13px]">
                        {language === 'en' ? 'Uploading…' : 'Se încarcă…'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7" style={{ color: 'var(--gold)' }} />
                      <span className="font-display italic" style={{ color: 'var(--parchment)', fontSize: 22 }}>
                        {language === 'en' ? 'Click to upload video' : 'Apasă pentru a încărca video'}
                      </span>
                      <span className="font-ui text-[12px]" style={{ color: 'var(--text-mute)' }}>
                        MP4 · WebM · MOV · {asMb(MAX_VIDEO_BYTES)} MB max
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Poster section */}
              <FormBlock title={language === 'en' ? 'Poster (thumbnail)' : 'Poster (miniatură)'}>
                <p className="font-ui text-[13px] mb-2" style={{ color: 'var(--text-mute)' }}>
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
                        discardStoredFile(posterStoragePath);
                        setPosterUrl('');
                        setPosterStoragePath(null);
                      }}
                      className="absolute top-2 right-2 grid w-8 h-8 place-items-center rounded-full"
                      style={{ background: 'var(--overlay-dark)', border: '1px solid var(--oxblood-2)', color: 'var(--danger)' }}
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
                      onChange={(e) => {
                        // Manual URL paste means the user is taking ownership
                        // of a URL we didn't upload. Forget any tracked
                        // storage path so we don't delete an unrelated file
                        // later (mirrors the cover-URL field in TextStoryCreate).
                        setPosterUrl(e.target.value);
                        setPosterStoragePath(null);
                      }}
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
                      className="grid w-12 h-12 place-items-center rounded-xl cursor-pointer transition-colors hover:text-gold shrink-0"
                      style={{ border: '1px solid var(--line)', background: 'var(--ink-2)', color: 'var(--text)' }}
                      title={language === 'en' ? 'Upload poster' : 'Încarcă poster'}
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>

                {isGeneratingPoster && (
                  <p className="font-ui text-[12px] flex items-center gap-2 mt-2" style={{ color: 'var(--gold)' }}>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {language === 'en' ? 'Generating poster…' : 'Se generează posterul…'}
                  </p>
                )}
              </FormBlock>

              <FilmExtrasFields
                value={film}
                onChange={setFilm}
                onUpload={handleSubtitleUpload}
                onRemove={handleSubtitleRemove}
                uploading={subtitleUploading}
                errors={showFilmErrors ? filmExtrasErrors(film, language) : []}
                language={language}
              />

              <PlaceTimeFields
                value={placeDate}
                onChange={setPlaceDate}
                county={location}
                onCountyChange={setLocation}
                errorFor={(field) => (showPlaceErrors ? placeErrors.find((e) => e.field === field)?.message : undefined)}
                language={language}
              />

              <StoryNoteFields value={note} onChange={setNote} language={language} />
            </div>
          </div>
        </div>
      </section>

      {/* Sticky save bar. Its vertical padding is inline: .ed-container's own padding shorthand outranks py-4. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          borderTop: '1px solid var(--line)',
          background: 'var(--overlay-nav)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <div className="ed-container flex items-center justify-end gap-3" style={{ paddingTop: 12, paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <PreviewLink kind="video" storyId={editingId ?? null} language={language} />
          <button
            onClick={leaveToDashboard}
            disabled={isSaving}
            className="font-ui text-[13px] cursor-pointer transition-colors hover:text-gold"
            style={{ background: 'transparent', border: 0, color: 'var(--text-dim)', padding: '10px 18px' }}
          >
            {language === 'en' ? 'Cancel' : 'Anulează'}
          </button>
          <button
            onClick={() => publishGuard.guard(handleSave)}
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
                  : (isAdmin && !isPublished && publishAt
                      ? (language === 'en' ? 'Schedule film' : 'Programează filmul')
                      : isAdmin && isPublished
                      ? (language === 'en' ? 'Publish film' : 'Publică filmul')
                      : (language === 'en' ? 'Save as draft' : 'Salvează ca ciornă'))}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoStoryCreate;
