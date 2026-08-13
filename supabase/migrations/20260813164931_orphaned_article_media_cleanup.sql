-- ================================================================
-- Orphaned article media: detection function
-- ================================================================
-- The `articles` bucket had accumulated ~1.6 GB (29 of 96 objects) that
-- no article row references — leftovers from media deleted or replaced
-- before the editors learned to clean up after themselves, plus the
-- files an interrupted session leaves behind (the editors delete their
-- session uploads on unmount, which never runs if the tab is killed).
--
-- The app has no way to notice these: nothing joins storage.objects
-- against the article columns that point into the bucket. This function
-- is that join. `admin-api` calls it (action: listOrphanedMedia /
-- purgeOrphanedMedia) and deletes through the Storage API — note that
-- deleting rows from storage.objects directly would drop the metadata
-- while leaving the actual bytes billable in S3.
--
-- Three deliberate safety properties, because the consumer deletes what
-- this returns:
--
--   * A grace period (default 24h). A file uploaded seconds ago belongs
--     to a draft that hasn't been saved yet; it is not garbage.
--   * Two independent reference tests. The exact path match is the real
--     one; the LIKE containment test is a backstop in case a stored URL
--     ever carries percent-encoding or a suffix the path extraction
--     doesn't anticipate. An object must fail *both* to be reported.
--   * greatest(created_at, updated_at) as the age, so a file overwritten
--     in place (upsert) gets a fresh grace period rather than inheriting
--     the original upload's timestamp.
--
-- Only article columns are scanned: media_url, poster_url, media_urls.
-- content_en/content_ro are plain prose in this schema — no embedded
-- image markup — and currently reference zero storage objects. If the
-- editors ever gain inline media, add those columns to `refs` below.
-- ================================================================

create or replace function public.list_orphaned_article_media(
  p_min_age_hours integer default 24
)
returns table (
  object_name   text,
  size_bytes    bigint,
  last_modified timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  with refs as (
    select a.media_url as url from public.articles a where a.media_url is not null
    union
    select a.poster_url from public.articles a where a.poster_url is not null
    union
    select unnest(a.media_urls) from public.articles a where a.media_urls is not null
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
  'Objects in the articles bucket older than p_min_age_hours that no article media_url / poster_url / media_urls entry references. Consumed by admin-api (listOrphanedMedia / purgeOrphanedMedia). service_role only.';

-- Lockdown, matching the convention in 20260429000000: SECURITY DEFINER
-- functions get EXECUTE revoked from everyone and granted back only to
-- the roles that need them. This one reads storage.objects across all
-- users, so it is service_role only — admins reach it through admin-api,
-- which already verifies the caller's role before it runs.

revoke all on function public.list_orphaned_article_media(integer) from public;
revoke all on function public.list_orphaned_article_media(integer) from anon;
revoke all on function public.list_orphaned_article_media(integer) from authenticated;
grant execute on function public.list_orphaned_article_media(integer) to service_role;
