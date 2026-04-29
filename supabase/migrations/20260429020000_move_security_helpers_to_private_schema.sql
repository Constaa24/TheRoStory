-- ================================================================
-- Move SECURITY DEFINER helpers out of the API-exposed schema
-- ================================================================
-- After the previous migration (20260429000000) we still had two
-- WARN-level lints because `is_admin()` and `comment_count_last_minute()`
-- live in the `public` schema, where PostgREST exposes everything as
-- an RPC. The `authenticated` role MUST keep EXECUTE on these for
-- RLS policy evaluation, but exposing them as a callable RPC is
-- unnecessary surface area.
--
-- Supabase's recommended fix is to move helpers like these to a
-- non-API schema (`private` by convention). PostgREST's `db_schemas`
-- setting is `public, graphql_public` by default, so anything in
-- `private` is unreachable as an RPC regardless of grants.
--
-- Inside RLS policies the role still needs USAGE on `private` and
-- EXECUTE on the function. We grant both explicitly to
-- `authenticated` and `service_role` only — anon is never on a path
-- that calls these helpers (the comment INSERT policy short-circuits
-- on `auth.uid() IS NOT NULL` before reaching the rate-limit call;
-- admin policies are scoped `to authenticated`).
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Create the private schema
-- ----------------------------------------------------------------

create schema if not exists private;

-- Tighten USAGE: revoke from PUBLIC, grant only to roles that need it.
revoke usage on schema private from public;
grant usage on schema private to authenticated, service_role;


-- ----------------------------------------------------------------
-- 2. Recreate is_admin() in private
-- ----------------------------------------------------------------

create or replace function private.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated, service_role;


-- ----------------------------------------------------------------
-- 3. Recreate comment_count_last_minute(uuid) in private
-- ----------------------------------------------------------------

create or replace function private.comment_count_last_minute(uid uuid)
  returns integer
  language sql
  stable
  security definer
  set search_path to ''
as $$
  select count(*)::integer
  from public.comments
  where user_id = uid
    and created_at > (now() - interval '1 minute');
$$;

revoke all on function private.comment_count_last_minute(uuid) from public;
grant execute on function private.comment_count_last_minute(uuid) to authenticated, service_role;


-- ----------------------------------------------------------------
-- 4. Re-create policies that referenced public.* helpers
--    Postgres doesn't allow CREATE OR REPLACE POLICY, so each is
--    a DROP + CREATE pair. Behavior preserved verbatim except for
--    swapping the schema-qualified function names.
-- ----------------------------------------------------------------

-- 4a. user_roles: Admins can manage all user roles
drop policy if exists "Admins can manage all user roles" on public.user_roles;
create policy "Admins can manage all user roles"
  on public.user_roles
  as permissive
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- 4b. articles: Admins can manage all articles
drop policy if exists "Admins can manage all articles" on public.articles;
create policy "Admins can manage all articles"
  on public.articles
  as permissive
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- 4c. articles: Writers can update own draft articles
drop policy if exists "Writers can update own draft articles" on public.articles;
create policy "Writers can update own draft articles"
  on public.articles
  as permissive
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    (user_id = auth.uid())
    and ((is_published = false) or private.is_admin())
  );

-- 4d. categories: Admins can manage categories
drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories"
  on public.categories
  as permissive
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- 4e. comments: Authenticated users can insert with rate limit
--     Kept `to public` to match the original. Anon callers short-circuit
--     on the `auth.uid() IS NOT NULL` check, never reaching the rate-limit
--     function — so anon doesn't need USAGE on the private schema.
drop policy if exists "Authenticated users can insert with rate limit" on public.comments;
create policy "Authenticated users can insert with rate limit"
  on public.comments
  as permissive
  for insert
  to public
  with check (
    (auth.uid() is not null)
    and (user_id = auth.uid())
    and (private.comment_count_last_minute(auth.uid()) < 5)
  );


-- ----------------------------------------------------------------
-- 5. Drop the now-unreferenced public.* versions
--    Postgres will refuse if anything still references them, which
--    is the safety net we want — if any policy was missed above,
--    the migration fails fast instead of leaving a dangling reference.
-- ----------------------------------------------------------------

drop function if exists public.is_admin();
drop function if exists public.comment_count_last_minute(uuid);
