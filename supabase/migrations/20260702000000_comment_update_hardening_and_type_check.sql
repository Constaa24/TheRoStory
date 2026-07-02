-- ================================================================
-- July 2026 audit fixes: comment-update hardening, articles.type
-- CHECK, profiles SELECT scoping
-- ================================================================
-- Closes three issues from the July 2026 full-stack audit:
--
--   1. Comment display-name spoofing via UPDATE. The
--      set_comment_display_name trigger only fired BEFORE INSERT, and
--      the `authenticated` role held a table-wide UPDATE grant. A
--      logged-in user could PATCH their own comment through PostgREST
--      and set user_display_name to any value (impersonation), or
--      rewrite created_at / article_id. Fixed two ways (belt and
--      suspenders):
--        a. Column-level grant: authenticated may UPDATE only
--           `content`. The app never updates anything else.
--        b. The display-name trigger now also fires BEFORE UPDATE, so
--           even if a broad grant is ever reintroduced, the name is
--           re-resolved from profiles and cannot be spoofed.
--
--   2. articles.type had no CHECK constraint. A writer hitting the
--      REST API directly could insert an arbitrary type string; such
--      an article renders with an empty body (none of the three
--      renderers in EditorialArticle match). Bound it like subtype.
--
--   3. profiles SELECT was `to authenticated USING (true)` — any
--      logged-in user could enumerate every profile. The client only
--      ever reads its own row (use-auth, Profile page); the admin
--      user list goes through the admin-api Edge Function with the
--      service-role key, which bypasses RLS. Scope SELECT to
--      self-or-admin.
-- ================================================================


-- ----------------------------------------------------------------
-- 1a. Column-level UPDATE grant on comments
-- ----------------------------------------------------------------
-- service_role keeps its full grant (data imports / admin tooling);
-- anon already had UPDATE revoked in 20260409140000.

revoke update on table public.comments from authenticated;
grant update (content) on table public.comments to authenticated;


-- ----------------------------------------------------------------
-- 1b. Fire set_comment_display_name on UPDATE too
-- ----------------------------------------------------------------
-- The function already skips service_role callers and resolves the
-- name from profiles → auth metadata → email-local-part → 'Anonymous',
-- so re-running it on UPDATE simply re-pins the current profile name.
-- The profiles → comments sync trigger (sync_comment_display_names)
-- runs AFTER UPDATE on profiles, so when its UPDATE of comments fires
-- this trigger the profile row is already committed with the new name
-- and both paths agree.

drop trigger if exists set_comment_display_name_trigger on public.comments;
create trigger set_comment_display_name_trigger
  before insert or update on public.comments
  for each row
  execute function public.set_comment_display_name();


-- ----------------------------------------------------------------
-- 2. Bound articles.type
-- ----------------------------------------------------------------
-- Backfill any NULLs (the column defaulted to 'text' but was
-- nullable), then pin NOT NULL + CHECK. NOT VALID + VALIDATE avoids
-- holding a long lock on a large table.

update public.articles set type = 'text' where type is null;

alter table public.articles alter column type set not null;
alter table public.articles alter column type set default 'text';

alter table public.articles
  add constraint articles_type_check
  check (type in ('text', 'video', 'carousel')) not valid;
alter table public.articles validate constraint articles_type_check;


-- ----------------------------------------------------------------
-- 3. Scope profiles SELECT to self and admins
-- ----------------------------------------------------------------

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;

create policy "Profiles are viewable by self and admins"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  );
