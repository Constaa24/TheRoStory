-- ================================================================
-- Audit fixes: storage policy, performance indexes, search_path
-- ================================================================
-- Three independent fixes from the deep audit:
--
--   1. Drop the storage policy that lets any authenticated user
--      upload anywhere in the `articles` bucket. The strict
--      folder-restricted policy alone is enough.
--
--   2. Add the 6 missing performance indexes. The schema only had
--      indexes on PKs and unique constraints. Lookups by article_id,
--      user_id, category_id, and is_published were doing full scans.
--
--   3. Standardize SECURITY DEFINER functions to `SET search_path
--      TO ''` and fully qualify references. Mixing '' and 'public'
--      across functions was inconsistent and made future audits
--      harder.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Storage: drop the bypassing INSERT policy
-- ----------------------------------------------------------------
-- "Authenticated users can upload to articles" had a check of
-- (bucket_id = 'articles' AND auth.role() = 'authenticated'),
-- which is OR'd with the strict per-folder policy. Any logged-in
-- user could upload to any path, overwriting other users' files.
-- The strict "Users can upload to own folder in articles bucket"
-- policy below it is the one we want to keep.

drop policy if exists "Authenticated users can upload to articles"
  on "storage"."objects";


-- ----------------------------------------------------------------
-- 2. Performance indexes
-- ----------------------------------------------------------------
-- IF NOT EXISTS so the migration is idempotent — safe to re-run
-- and won't conflict with any indexes Supabase added automatically.

create index if not exists articles_category_id_idx
  on public.articles (category_id);

create index if not exists articles_user_id_idx
  on public.articles (user_id);

-- Composite index covers the most common query pattern:
-- WHERE is_published = true ORDER BY created_at DESC
create index if not exists articles_is_published_created_at_idx
  on public.articles (is_published, created_at desc);

create index if not exists comments_article_id_created_at_idx
  on public.comments (article_id, created_at desc);

create index if not exists comments_user_id_created_at_idx
  on public.comments (user_id, created_at desc);

-- favorites already has a unique (user_id, article_id) index that
-- covers user_id queries, so no extra index is needed there.


-- ----------------------------------------------------------------
-- 3. Standardize search_path on increment_article_view
-- ----------------------------------------------------------------
-- Was `SET search_path TO 'public'`. Tighten to '' and fully
-- qualify the table reference for consistency with the other
-- SECURITY DEFINER functions.

create or replace function public.increment_article_view(p_article_id text)
  returns void
  language plpgsql
  security definer
  set search_path to ''
as $function$
begin
  insert into public.article_views (id, article_id, view_count, updated_at)
  values (
    'view_' || p_article_id,
    p_article_id,
    1,
    now()
  )
  on conflict (article_id) do update
    set view_count = public.article_views.view_count + 1,
        updated_at = now();
end;
$function$;
