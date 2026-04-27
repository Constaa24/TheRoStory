-- ================================================================
-- Carousel per-image captions
-- ================================================================
-- Adds an optional `media_captions` JSONB column on articles.
--
-- Shape: an array of { en: string, ro: string } objects, where the
-- array index matches the corresponding entry in `media_urls`.
--
-- Nullable + defaulted to NULL so existing carousel articles keep
-- working without changes — display code falls back gracefully when
-- captions are missing.
-- ================================================================

alter table "public"."articles"
  add column if not exists "media_captions" jsonb;

comment on column "public"."articles"."media_captions" is
  'Optional per-image captions for carousel articles. Array of {en, ro} objects, parallel to media_urls.';
