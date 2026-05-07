-- ================================================================
-- Audit-driven hardening
-- ================================================================
-- Closes the issues identified by the full-stack audit:
--
--   * Article writes are now gated by writer/admin role, not just
--     ownership. Readers can no longer create or update articles.
--   * Length CHECK constraints on text columns mirror the client-side
--     ARTICLE_LIMITS so a malicious client can't bypass them.
--   * NOT NULL on foreign-key columns that the app already requires.
--   * profiles.email column dropped — it was anon-readable and
--     duplicated auth.users.email. The client only ever reads
--     auth.users.email via supabase.auth.
--   * Storage UPDATE/DELETE policies for the avatars bucket and the
--     articles bucket so users can replace and clean up their own
--     files (avatar rotation, removed gallery images).
--   * BEFORE INSERT trigger forces comments.user_display_name to
--     match profiles.display_name — clients can no longer post a
--     comment under any name they choose.
--   * handle_new_user is now idempotent (ON CONFLICT DO NOTHING).
--   * user_roles.role gains a CHECK constraint so values are bounded.
--   * RLS predicates that call private.is_admin() / is_writer_or_admin()
--     wrap them in (select fn()) so the planner evaluates the helper
--     once per query instead of once per row.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. New helper: private.is_writer_or_admin()
-- ----------------------------------------------------------------
-- Mirrors private.is_admin(): SECURITY DEFINER, empty search_path,
-- granted to authenticated/service_role/anon (anon needs EXECUTE so
-- the planner can plan public-table queries whose RLS predicates
-- reference the function — same reason 20260429040000 grants anon
-- EXECUTE on private.is_admin).

create or replace function private.is_writer_or_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('writer', 'admin')
  );
$$;

revoke all on function private.is_writer_or_admin() from public;
grant execute on function private.is_writer_or_admin() to authenticated, service_role, anon;


-- ----------------------------------------------------------------
-- 2. Lock article writes behind writer/admin role
-- ----------------------------------------------------------------
-- The previous policies allowed any authenticated user (including
-- the default 'reader' role) to INSERT/UPDATE articles, which meant
-- anyone signed in could publish public content by hitting the REST
-- API directly. Frontend route guards (`canAccessAdmin`) only hid
-- the UI.

drop policy if exists "Articles can be inserted by owner or admin" on public.articles;
drop policy if exists "Articles can be updated by owner or admin" on public.articles;
drop policy if exists "Articles can be deleted by owner or admin" on public.articles;

create policy "Articles can be inserted by writer or admin"
  on public.articles
  as permissive
  for insert
  to authenticated
  with check (
    (user_id = (select auth.uid()) and (select private.is_writer_or_admin()))
    or (select private.is_admin())
  );

create policy "Articles can be updated by writer or admin"
  on public.articles
  as permissive
  for update
  to authenticated
  using (
    (user_id = (select auth.uid()) and (select private.is_writer_or_admin()))
    or (select private.is_admin())
  )
  with check (
    (user_id = (select auth.uid()) and (select private.is_writer_or_admin()))
    or (select private.is_admin())
  );

-- DELETE remains owner-or-admin. A demoted writer should still be
-- able to remove their own work; only admins can delete other users'
-- articles.
create policy "Articles can be deleted by owner or admin"
  on public.articles
  as permissive
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
  );


-- Hoist private.is_admin() in the SELECT policy so the planner
-- evaluates it once per query.
drop policy if exists "Articles are visible to readers, owners, and admins" on public.articles;
create policy "Articles are visible to readers, owners, and admins"
  on public.articles
  as permissive
  for select
  to public
  using (
    is_published = true
    or user_id = (select auth.uid())
    or (select private.is_admin())
  );


-- ----------------------------------------------------------------
-- 3. Hoist private.is_admin() in the other RLS predicates
-- ----------------------------------------------------------------

drop policy if exists "Categories can be inserted by admins" on public.categories;
create policy "Categories can be inserted by admins"
  on public.categories
  as permissive
  for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "Categories can be updated by admins" on public.categories;
create policy "Categories can be updated by admins"
  on public.categories
  as permissive
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Categories can be deleted by admins" on public.categories;
create policy "Categories can be deleted by admins"
  on public.categories
  as permissive
  for delete
  to authenticated
  using ((select private.is_admin()));


drop policy if exists "User roles are visible to self and admins" on public.user_roles;
create policy "User roles are visible to self and admins"
  on public.user_roles
  as permissive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists "User roles can be inserted by admins" on public.user_roles;
create policy "User roles can be inserted by admins"
  on public.user_roles
  as permissive
  for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "User roles can be updated by admins" on public.user_roles;
create policy "User roles can be updated by admins"
  on public.user_roles
  as permissive
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "User roles can be deleted by admins" on public.user_roles;
create policy "User roles can be deleted by admins"
  on public.user_roles
  as permissive
  for delete
  to authenticated
  using ((select private.is_admin()));


-- ----------------------------------------------------------------
-- 4. Length CHECK constraints
-- ----------------------------------------------------------------
-- Mirror src/lib/supabase.ts:ARTICLE_LIMITS so the DB enforces what
-- the client claims to. NOT VALID lets us add the constraint without
-- a full table scan; the VALIDATE step below scans once and is
-- replaceable in production with a CONCURRENTLY pattern if needed.

-- Helper for the array-of-text constraints — Postgres forbids subqueries
-- directly inside CHECK expressions, but allows IMMUTABLE function calls
-- whose bodies happen to use them. This lets us cap each element of an
-- array column without resorting to per-row triggers.
create or replace function private.text_array_within_length(arr text[], max_len integer)
  returns boolean
  language sql
  immutable
  parallel safe
  set search_path to ''
as $$
  select arr is null
    or coalesce(
         (select bool_and(char_length(u) <= max_len) from unnest(arr) as u),
         true
       );
$$;

revoke all on function private.text_array_within_length(text[], integer) from public;
grant execute on function private.text_array_within_length(text[], integer) to authenticated, service_role, anon;

alter table public.articles
  add constraint articles_title_en_length check (char_length(title_en) <= 200) not valid;
alter table public.articles validate constraint articles_title_en_length;

alter table public.articles
  add constraint articles_title_ro_length check (char_length(title_ro) <= 200) not valid;
alter table public.articles validate constraint articles_title_ro_length;

alter table public.articles
  add constraint articles_content_en_length check (char_length(content_en) <= 50000) not valid;
alter table public.articles validate constraint articles_content_en_length;

alter table public.articles
  add constraint articles_content_ro_length check (char_length(content_ro) <= 50000) not valid;
alter table public.articles validate constraint articles_content_ro_length;

alter table public.articles
  add constraint articles_location_length check (location is null or char_length(location) <= 100) not valid;
alter table public.articles validate constraint articles_location_length;

alter table public.articles
  add constraint articles_media_url_length check (media_url is null or char_length(media_url) <= 2000) not valid;
alter table public.articles validate constraint articles_media_url_length;

alter table public.articles
  add constraint articles_poster_url_length check (poster_url is null or char_length(poster_url) <= 2000) not valid;
alter table public.articles validate constraint articles_poster_url_length;

-- media_urls: at most 30 entries, each up to 2000 chars.
alter table public.articles
  add constraint articles_media_urls_length check (
    media_urls is null
    or (array_length(media_urls, 1) <= 30
        and private.text_array_within_length(media_urls, 2000))
  ) not valid;
alter table public.articles validate constraint articles_media_urls_length;

-- comments.content: cap at 2000 chars.
alter table public.comments
  add constraint comments_content_length check (char_length(content) <= 2000) not valid;
alter table public.comments validate constraint comments_content_length;

-- profiles.display_name and avatar_url.
alter table public.profiles
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 100) not valid;
alter table public.profiles validate constraint profiles_display_name_length;

alter table public.profiles
  add constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2000) not valid;
alter table public.profiles validate constraint profiles_avatar_url_length;

-- categories.name_en/ro and slug.
alter table public.categories
  add constraint categories_name_en_length check (char_length(name_en) <= 100) not valid;
alter table public.categories validate constraint categories_name_en_length;

alter table public.categories
  add constraint categories_name_ro_length check (char_length(name_ro) <= 100) not valid;
alter table public.categories validate constraint categories_name_ro_length;

alter table public.categories
  add constraint categories_slug_length check (char_length(slug) <= 100) not valid;
alter table public.categories validate constraint categories_slug_length;


-- ----------------------------------------------------------------
-- 5. CHECK on user_roles.role
-- ----------------------------------------------------------------

alter table public.user_roles
  add constraint user_roles_role_check check (role in ('reader', 'writer', 'admin')) not valid;
alter table public.user_roles validate constraint user_roles_role_check;


-- ----------------------------------------------------------------
-- 6. Clean up rows with NULL critical FKs, then SET NOT NULL
-- ----------------------------------------------------------------
-- Rows with NULL user_id / article_id are already broken: RLS predicates
-- that compare against auth.uid() return NULL on those rows, so they're
-- effectively orphaned. Deleting them unblocks the NOT NULL.

delete from public.favorites where user_id is null or article_id is null;
alter table public.favorites alter column user_id set not null;
alter table public.favorites alter column article_id set not null;

delete from public.comments where user_id is null or article_id is null;
alter table public.comments alter column user_id set not null;
alter table public.comments alter column article_id set not null;

-- Articles with NULL user_id are similarly orphaned — they can't be
-- updated or deleted by their owner because there is no owner. They
-- were either created via a now-dropped author_id-only path or via
-- service_role. Delete them.
delete from public.articles where user_id is null;
alter table public.articles alter column user_id set not null;


-- ----------------------------------------------------------------
-- 7. Drop profiles.email — it's anon-readable and duplicates
--    auth.users.email. The frontend reads auth.users.email via
--    supabase.auth, never profiles.email. The admin-api Edge
--    Function reads auth.users.email server-side.
-- ----------------------------------------------------------------

alter table public.profiles drop column if exists email;


-- ----------------------------------------------------------------
-- 8. Restrict profiles SELECT to authenticated
-- ----------------------------------------------------------------
-- The remaining columns (id, display_name, avatar_url, updated_at)
-- are already denormalized into comments.user_display_name for the
-- only public-facing use case. Anon users see commenter names via
-- the comments table itself.

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (true);


-- ----------------------------------------------------------------
-- 9. Update handle_new_user — drop email column reference, add
--    ON CONFLICT DO NOTHING so a re-fired trigger (or duplicate
--    auth.users insert) doesn't blow up.
-- ----------------------------------------------------------------

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $function$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'reader')
  on conflict (user_id) do nothing;

  return new;
end;
$function$;


-- ----------------------------------------------------------------
-- 10. comments.user_display_name BEFORE INSERT trigger
-- ----------------------------------------------------------------
-- The column was previously trusted from the client. A user could
-- post a comment under any name. Force it from profiles at insert
-- time. Combined with the existing AFTER UPDATE sync trigger, the
-- display name now always matches the current profile.

create or replace function public.set_comment_display_name()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $$
declare
  resolved_name text;
begin
  select display_name into resolved_name
  from public.profiles
  where id = new.user_id;

  new.user_display_name := coalesce(nullif(trim(resolved_name), ''), 'Anonymous');
  return new;
end;
$$;

drop trigger if exists set_comment_display_name_trigger on public.comments;
create trigger set_comment_display_name_trigger
  before insert on public.comments
  for each row
  execute function public.set_comment_display_name();


-- ----------------------------------------------------------------
-- 11. Storage policies — explicit UPDATE / DELETE for avatars and
--     articles buckets, scoped to the user's folder.
-- ----------------------------------------------------------------
-- The base schema only had INSERT policies. UPDATE was needed for
-- supabase.storage.upload({upsert:true}) to replace existing files
-- (currently safe only because the client uses random UUID paths).
-- DELETE lets the frontend clean up orphaned files when an avatar
-- is replaced or a gallery image is removed.

-- avatars bucket
drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects
  as permissive
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects
  as permissive
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- articles bucket — match the existing INSERT path patterns
drop policy if exists "Users can update own files in articles bucket" on storage.objects;
create policy "Users can update own files in articles bucket"
  on storage.objects
  as permissive
  for update
  to authenticated
  using (
    bucket_id = 'articles'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'articles' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'stories' and (storage.foldername(name))[3] = (select auth.uid())::text)
    )
  )
  with check (
    bucket_id = 'articles'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'articles' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'stories' and (storage.foldername(name))[3] = (select auth.uid())::text)
    )
  );

drop policy if exists "Users can delete own files in articles bucket" on storage.objects;
create policy "Users can delete own files in articles bucket"
  on storage.objects
  as permissive
  for delete
  to authenticated
  using (
    bucket_id = 'articles'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'articles' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'stories' and (storage.foldername(name))[3] = (select auth.uid())::text)
    )
  );
