-- Orphaned-avatar detection, and a uniqueness constraint the categories
-- table has always implied without enforcing.
--
-- 1. list_orphaned_avatars()
--
-- The storage housekeeping in the admin dashboard only ever scanned the
-- `articles` bucket: list_orphaned_article_media joins bucket objects against
-- media_url / poster_url / media_urls. Nothing did the equivalent for
-- `avatars` against profiles.avatar_url, so unreferenced avatars accumulated
-- with no way to see or reclaim them. At the time of writing that is 10 of 12
-- objects (~9.9 MB) — nine of them predating the replace-avatar cleanup in
-- Profile.tsx, which only removes the file it is replacing and can do nothing
-- about what came before it.
--
-- Deliberately a sibling function rather than a bucket parameter on the
-- existing one: the reference sets have nothing in common (three columns on
-- articles vs one on profiles), so a shared implementation would be a CASE
-- over two unrelated queries wearing one name.
--
-- Google OAuth avatars live on lh3.googleusercontent.com and never match the
-- storage prefix, so they contribute no reference path and correctly cause no
-- bucket object to be considered referenced.
--
-- 2. categories_slug_key
--
-- slug had a length CHECK but no uniqueness, so two categories could share
-- one. Routing is by id so nothing breaks, but Categories.tsx keys its
-- artwork off slug — duplicates would silently render the same image for two
-- different categories. Verified zero duplicates before adding.

create or replace function public.list_orphaned_avatars(p_min_age_hours integer default 24)
returns table(object_name text, size_bytes bigint, last_modified timestamp with time zone)
language sql
stable
security definer
set search_path to ''
as $function$
  with ref_paths as (
    select distinct
      split_part(
        regexp_replace(p.avatar_url, '^.*/storage/v1/object/public/avatars/', ''),
        '?', 1
      ) as path
    from public.profiles p
    where p.avatar_url is not null
      and p.avatar_url like '%/storage/v1/object/public/avatars/%'
  )
  select
    o.name,
    coalesce((o.metadata->>'size')::bigint, 0),
    greatest(o.created_at, o.updated_at)
  from storage.objects o
  where o.bucket_id = 'avatars'
    -- Supabase writes these to keep an empty prefix visible in the dashboard
    -- and recreates them on demand. Deleting one achieves nothing and makes
    -- the purge look busier than it is.
    and o.name not like '%/.emptyFolderPlaceholder'
    and o.name <> '.emptyFolderPlaceholder'
    and greatest(o.created_at, o.updated_at)
        < now() - (greatest(coalesce(p_min_age_hours, 24), 0)::text || ' hours')::interval
    and not exists (select 1 from ref_paths rp where rp.path = o.name)
    -- Second, looser guard mirroring list_orphaned_article_media: catches a
    -- stored URL whose prefix differs (custom domain, transform params)
    -- but still embeds the object name. A false negative here only means a
    -- file is kept; a false positive would delete a live avatar.
    and not exists (
      select 1 from public.profiles p2
      where p2.avatar_url is not null and p2.avatar_url like '%' || o.name || '%'
    )
  order by greatest(o.created_at, o.updated_at);
$function$;

comment on function public.list_orphaned_avatars(integer) is
  'Objects in the avatars bucket that no profiles.avatar_url references, older than p_min_age_hours. Admin-only; called by the admin-api edge function under the service role.';

-- Same posture as list_orphaned_article_media: reachable only by the service
-- role, so the edge function''s admin check is the sole way in. Revoking from
-- PUBLIC first is what actually closes it — new functions are granted to
-- PUBLIC by default, and anon/authenticated inherit from there.
revoke all on function public.list_orphaned_avatars(integer) from public;
revoke all on function public.list_orphaned_avatars(integer) from anon;
revoke all on function public.list_orphaned_avatars(integer) from authenticated;
grant execute on function public.list_orphaned_avatars(integer) to service_role;

-- Uniqueness on categories.slug. Guarded so re-running the migration is a
-- no-op rather than an error.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_slug_key'
  ) then
    alter table public.categories add constraint categories_slug_key unique (slug);
  end if;
end
$$;
