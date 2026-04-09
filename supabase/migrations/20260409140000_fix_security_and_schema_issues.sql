-- ================================================================
-- Fix: Security and schema issues found in remote schema audit
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Revoke excessive permissions from the anon role
--    RLS does NOT protect TRUNCATE — any role granted TRUNCATE can
--    wipe a table regardless of row-level policies.
--    Anonymous users should only be able to SELECT public data.
-- ----------------------------------------------------------------

revoke delete, insert, update, truncate, trigger, references
  on table "public"."article_views" from "anon";

revoke delete, insert, update, truncate, trigger, references
  on table "public"."articles" from "anon";

revoke delete, insert, update, truncate, trigger, references
  on table "public"."categories" from "anon";

revoke delete, insert, update, truncate, trigger, references
  on table "public"."comments" from "anon";

-- favorites and user_roles are private — anon needs no access at all
revoke select, delete, insert, update, truncate, trigger, references
  on table "public"."favorites" from "anon";

revoke select, delete, insert, update, truncate, trigger, references
  on table "public"."user_roles" from "anon";

revoke delete, insert, update, truncate, trigger, references
  on table "public"."profiles" from "anon";


-- ----------------------------------------------------------------
-- 2. Revoke TRUNCATE and TRIGGER from the authenticated role
--    End users should never be able to truncate tables or define
--    triggers through the API.
-- ----------------------------------------------------------------

revoke truncate, trigger
  on table "public"."article_views" from "authenticated";

revoke truncate, trigger
  on table "public"."articles" from "authenticated";

revoke truncate, trigger
  on table "public"."categories" from "authenticated";

revoke truncate, trigger
  on table "public"."comments" from "authenticated";

revoke truncate, trigger
  on table "public"."favorites" from "authenticated";

revoke truncate, trigger
  on table "public"."profiles" from "authenticated";

revoke truncate, trigger
  on table "public"."user_roles" from "authenticated";


-- ----------------------------------------------------------------
-- 3. Drop redundant author_id column from articles
--    Both author_id (text, no FK) and user_id (uuid, FK to auth.users)
--    stored the same value. RLS and all app logic uses user_id.
--    author_id has been removed from all insert paths in the app.
-- ----------------------------------------------------------------

alter table "public"."articles" drop column "author_id";


-- ----------------------------------------------------------------
-- 5. Fix articles → categories foreign key
--    ON DELETE CASCADE silently deleted all articles belonging to a
--    category when that category was removed. Use SET NULL instead
--    so articles are preserved and can be reassigned.
-- ----------------------------------------------------------------

alter table "public"."articles"
  drop constraint "articles_category_id_fkey";

alter table "public"."articles"
  add constraint "articles_category_id_fkey"
  foreign key (category_id)
  references public.categories(id)
  on delete set null
  not valid;

alter table "public"."articles"
  validate constraint "articles_category_id_fkey";


-- ----------------------------------------------------------------
-- 6. Remove duplicate RLS policies
-- ----------------------------------------------------------------

-- article_views: two identical SELECT policies
drop policy if exists "Article views are viewable by everyone"
  on "public"."article_views";

-- comments: two identical SELECT policies
drop policy if exists "Comments are viewable by everyone"
  on "public"."comments";

-- comments: two identical DELETE policies
drop policy if exists "Users can delete their own comments"
  on "public"."comments";

-- comments: rate-limit bypass
--   "Authenticated users can post comments" has no rate limit, so
--   any authenticated user could satisfy it and bypass the
--   rate-limited policy. Remove the unlimited policy; the
--   rate-limited "Authenticated users can insert with rate limit"
--   policy remains as the sole INSERT gate.
drop policy if exists "Authenticated users can post comments"
  on "public"."comments";

-- favorites: SELECT already covered by the ALL policy
drop policy if exists "Users can view their own favorites"
  on "public"."favorites";


-- ----------------------------------------------------------------
-- 7. Add admin policy for user_roles
--    Admins had no RLS policy to manage roles, forcing any role
--    assignment to go through the service_role key.
-- ----------------------------------------------------------------

create policy "Admins can manage all user roles"
  on "public"."user_roles"
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );


-- ----------------------------------------------------------------
-- 8. Attach the rls_auto_enable event trigger
--    The function public.rls_auto_enable() existed but had no event
--    trigger wired to it, making it dead code.
-- ----------------------------------------------------------------

create event trigger rls_auto_enable_trigger
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();


-- ----------------------------------------------------------------
-- 9. Keep comments.user_display_name in sync with profiles
--    The column was populated at insert time and never updated,
--    causing stale display names on old comments after a user
--    renamed themselves. This trigger propagates the change.
-- ----------------------------------------------------------------

create or replace function public.sync_comment_display_names()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $$
begin
  update public.comments
  set user_display_name = new.display_name
  where user_id = new.id;
  return new;
end;
$$;

create trigger sync_comment_display_names_trigger
  after update of display_name on public.profiles
  for each row
  when (old.display_name is distinct from new.display_name)
  execute function public.sync_comment_display_names();
