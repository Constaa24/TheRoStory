-- ================================================================
-- Films: subtitles and chapters. Text stories: dated moments.
-- ================================================================
-- Two features from the storybook redesign (the canvas's "Read along" for
-- films and "the story in three moments" for text stories).
--
-- Films (all four have narration and dialogue, 2026-11-02):
--   subtitles_en_url / subtitles_ro_url  a WebVTT file per language in the
--     articles bucket. The editor accepts .srt or .vtt and converts SRT to
--     WebVTT before uploading, so storage only ever holds text/vtt.
--   film_chapters  [{ "t": seconds, "en": title, "ro": title }]: marks on
--     the player's progress bar and headings in the transcript.
--
-- Text stories:
--   moments  [{ "chapter": 0-based index, "when_en", "when_ro", "label_en",
--     "label_ro" }]: a dated point per chapter ("1383 · The first stones"),
--     drawn as a strip under the title that links to the chapter. Shown
--     when a story has two or more.
--
-- Additive and nullable, like the story-note columns before them: the site
-- reads articles with select('*'), and the editors only send these columns
-- once they exist or the author has filled them in, so the site works the
-- same before and after this runs.
--
-- Also here, because subtitle files would otherwise be destroyed:
--   - the articles bucket accepts text/vtt (it allowed images and video);
--   - list_orphaned_article_media, which admin-api's purge uses to delete
--     files no story references, now counts the subtitle columns as
--     references. Without that, every subtitle file older than a day would
--     have been listed as an orphan and purged.
-- ================================================================

alter table public.articles
  add column if not exists subtitles_en_url text,
  add column if not exists subtitles_ro_url text,
  add column if not exists film_chapters jsonb,
  add column if not exists moments jsonb;

alter table public.articles
  add constraint articles_subtitles_url_length
  check (
    (subtitles_en_url is null or char_length(subtitles_en_url) <= 2000)
    and (subtitles_ro_url is null or char_length(subtitles_ro_url) <= 2000)
  );

-- ---------------------------------------------------------------- checks

create or replace function private.film_chapters_valid(p jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select p is null
    or (
      jsonb_typeof(p) = 'array'
      and jsonb_array_length(p) <= 30
      and not exists (
        select 1
        from jsonb_array_elements(p) as c(entry)
        where jsonb_typeof(c.entry) <> 'object'
          or exists (select 1 from jsonb_object_keys(c.entry) as k(name) where k.name not in ('t', 'en', 'ro'))
          -- CASE, not OR: Postgres may evaluate OR operands in any order,
          -- and casting a non-number to numeric would raise.
          or case when jsonb_typeof(c.entry -> 't') = 'number'
               then (c.entry ->> 't')::numeric not between 0 and 86400
               else true end
          or (c.entry ? 'en' and jsonb_typeof(c.entry -> 'en') <> 'string')
          or (c.entry ? 'ro' and jsonb_typeof(c.entry -> 'ro') <> 'string')
          or char_length(coalesce(c.entry ->> 'en', '')) > 80
          or char_length(coalesce(c.entry ->> 'ro', '')) > 80
          or (btrim(coalesce(c.entry ->> 'en', '')) = '' and btrim(coalesce(c.entry ->> 'ro', '')) = '')
      )
    );
$function$;

comment on function private.film_chapters_valid(jsonb) is
  'CHECK helper for articles.film_chapters: at most 30 {t, en, ro}; t in seconds 0-86400; titles at most 80 chars, at least one present.';

create or replace function private.story_moments_valid(p jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select p is null
    or (
      jsonb_typeof(p) = 'array'
      and jsonb_array_length(p) <= 10
      and not exists (
        select 1
        from jsonb_array_elements(p) as m(entry)
        where jsonb_typeof(m.entry) <> 'object'
          or exists (
            select 1 from jsonb_object_keys(m.entry) as k(name)
            where k.name not in ('chapter', 'when_en', 'when_ro', 'label_en', 'label_ro')
          )
          or case when jsonb_typeof(m.entry -> 'chapter') = 'number'
               then (m.entry ->> 'chapter')::numeric not between 0 and 49
                 or (m.entry ->> 'chapter')::numeric <> trunc((m.entry ->> 'chapter')::numeric)
               else true end
          or exists (
            select 1 from unnest(array['when_en', 'when_ro', 'label_en', 'label_ro']) as f(name)
            where m.entry ? f.name and jsonb_typeof(m.entry -> f.name) <> 'string'
          )
          or char_length(coalesce(m.entry ->> 'when_en', '')) > 24
          or char_length(coalesce(m.entry ->> 'when_ro', '')) > 24
          or char_length(coalesce(m.entry ->> 'label_en', '')) > 60
          or char_length(coalesce(m.entry ->> 'label_ro', '')) > 60
          or (btrim(coalesce(m.entry ->> 'when_en', '')) = '' and btrim(coalesce(m.entry ->> 'when_ro', '')) = '')
      )
    );
$function$;

comment on function private.story_moments_valid(jsonb) is
  'CHECK helper for articles.moments: at most 10 {chapter, when_en, when_ro, label_en, label_ro}; chapter an integer 0-49; when at most 24 chars and required in one language; labels at most 60.';

-- As for media_captions_valid: a CHECK constraint's function is privilege-
-- checked against the role doing the INSERT/UPDATE, so authenticated needs
-- EXECUTE or every article save fails. anon never writes articles.
revoke all on function private.film_chapters_valid(jsonb) from public;
revoke all on function private.film_chapters_valid(jsonb) from anon;
grant execute on function private.film_chapters_valid(jsonb) to authenticated, service_role;
revoke all on function private.story_moments_valid(jsonb) from public;
revoke all on function private.story_moments_valid(jsonb) from anon;
grant execute on function private.story_moments_valid(jsonb) to authenticated, service_role;

alter table public.articles
  add constraint articles_film_chapters_shape check (private.film_chapters_valid(film_chapters));
alter table public.articles
  add constraint articles_moments_shape check (private.story_moments_valid(moments));

comment on column public.articles.subtitles_en_url is 'WebVTT subtitles for a film, English. Public URL in the articles bucket.';
comment on column public.articles.subtitles_ro_url is 'WebVTT subtitles for a film, Romanian. Public URL in the articles bucket.';
comment on column public.articles.film_chapters is 'Film chapters: [{t: seconds, en, ro}]. Marks on the progress bar, headings in the transcript.';
comment on column public.articles.moments is 'Text-story moments: [{chapter, when_en, when_ro, label_en, label_ro}]. The dated strip under the title.';

-- ------------------------------------------------------- storage: .vtt

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'text/vtt')
where id = 'articles'
  and allowed_mime_types is not null
  and not ('text/vtt' = any (allowed_mime_types));

-- ------------------------------------- orphans: subtitles are references

create or replace function public.list_orphaned_article_media(p_min_age_hours integer default 24)
returns table(object_name text, size_bytes bigint, last_modified timestamp with time zone)
language sql
stable security definer
set search_path to ''
as $function$
  with refs as (
    select a.media_url as url from public.articles a where a.media_url is not null
    union
    select a.poster_url from public.articles a where a.poster_url is not null
    union
    select unnest(a.media_urls) from public.articles a where a.media_urls is not null
    union
    select a.subtitles_en_url from public.articles a where a.subtitles_en_url is not null
    union
    select a.subtitles_ro_url from public.articles a where a.subtitles_ro_url is not null
  ),
  ref_paths as (
    select distinct
      split_part(
        regexp_replace(r.url, '^.*/storage/v1/object/public/articles/', ''),
        '?', 1
      ) as path
    from refs r
    where r.url like '%/storage/v1/object/public/articles/%'
  )
  select
    o.name,
    coalesce((o.metadata->>'size')::bigint, 0),
    greatest(o.created_at, o.updated_at)
  from storage.objects o
  where o.bucket_id = 'articles'
    and greatest(o.created_at, o.updated_at)
        < now() - (greatest(coalesce(p_min_age_hours, 24), 0)::text || ' hours')::interval
    and not exists (select 1 from ref_paths rp where rp.path = o.name)
    and not exists (select 1 from refs r2 where r2.url like '%' || o.name || '%')
  order by greatest(o.created_at, o.updated_at);
$function$;

comment on function public.list_orphaned_article_media(integer) is
  'Objects in the articles bucket older than p_min_age_hours that no article media_url / poster_url / media_urls / subtitles_en_url / subtitles_ro_url entry references. Consumed by admin-api (listOrphanedMedia / purgeOrphanedMedia). service_role only.';
