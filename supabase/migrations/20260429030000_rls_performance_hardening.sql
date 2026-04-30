-- ================================================================
-- RLS performance hardening
-- ================================================================
-- Resolves the two perf-lint families flagged by the Supabase
-- database linter:
--
--   * 0003 auth_rls_initplan — wrap `auth.uid()` (and similar)
--     calls in `(select auth.uid())` so the planner evaluates them
--     once per query instead of once per row.
--
--   * 0006 multiple_permissive_policies — collapse overlapping
--     permissive policies for the same (role, action) so the
--     planner doesn't have to evaluate every one.
--
-- Functional behavior is preserved verbatim — the same rows are
-- visible/mutable to the same users. Only the *form* of policy
-- expressions and the *count* of policies per table changes.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. articles — collapse 7 policies into 4 (one per action)
-- ----------------------------------------------------------------
-- Today: admin "FOR ALL" + 4 user per-action + 1 public SELECT +
--        1 writer UPDATE → multiple permissive overlaps.
-- Tomorrow: a single SELECT policy that covers public/owner/admin
--          and three write policies that each include the admin
--          override inline.
--
-- Note on the writer policy: "Writers can update own draft articles"
-- was intended to block writers from editing already-published
-- articles, but the more permissive "Users can update their own
-- articles" sat alongside it and OR-ed in, so the strict check was
-- already a no-op. We preserve current effective behavior (writers
-- can edit their own published articles) and drop the redundant
-- writer policy.

drop policy if exists "Admins can manage all articles" on public.articles;
drop policy if exists "Published articles are viewable by everyone" on public.articles;
drop policy if exists "Users can delete their own articles" on public.articles;
drop policy if exists "Users can insert their own articles" on public.articles;
drop policy if exists "Users can update their own articles" on public.articles;
drop policy if exists "Users can view their own unpublished articles" on public.articles;
drop policy if exists "Writers can update own draft articles" on public.articles;

create policy "Articles are visible to readers, owners, and admins"
  on public.articles
  as permissive
  for select
  to public
  using (
    is_published = true
    or user_id = (select auth.uid())
    or private.is_admin()
  );

create policy "Articles can be inserted by owner or admin"
  on public.articles
  as permissive
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or private.is_admin()
  );

create policy "Articles can be updated by owner or admin"
  on public.articles
  as permissive
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_admin()
  )
  with check (
    user_id = (select auth.uid())
    or private.is_admin()
  );

create policy "Articles can be deleted by owner or admin"
  on public.articles
  as permissive
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_admin()
  );


-- ----------------------------------------------------------------
-- 2. categories — drop the admin FOR ALL, add per-action admin
--    policies so SELECT no longer overlaps with the public-read
--    policy.
-- ----------------------------------------------------------------

drop policy if exists "Admins can manage categories" on public.categories;
-- "Public categories are viewable by everyone" stays as-is.

create policy "Categories can be inserted by admins"
  on public.categories
  as permissive
  for insert
  to authenticated
  with check (private.is_admin());

create policy "Categories can be updated by admins"
  on public.categories
  as permissive
  for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "Categories can be deleted by admins"
  on public.categories
  as permissive
  for delete
  to authenticated
  using (private.is_admin());


-- ----------------------------------------------------------------
-- 3. user_roles — collapse SELECT (self + admin) into one policy,
--    split admin FOR ALL into per-action.
-- ----------------------------------------------------------------

drop policy if exists "Admins can manage all user roles" on public.user_roles;
drop policy if exists "Users can view their own role" on public.user_roles;

create policy "User roles are visible to self and admins"
  on public.user_roles
  as permissive
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_admin()
  );

create policy "User roles can be inserted by admins"
  on public.user_roles
  as permissive
  for insert
  to authenticated
  with check (private.is_admin());

create policy "User roles can be updated by admins"
  on public.user_roles
  as permissive
  for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "User roles can be deleted by admins"
  on public.user_roles
  as permissive
  for delete
  to authenticated
  using (private.is_admin());


-- ----------------------------------------------------------------
-- 4. profiles — wrap auth.uid() in (select), restrict to authenticated.
-- ----------------------------------------------------------------

drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
  on public.profiles
  as permissive
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- ----------------------------------------------------------------
-- 5. favorites — wrap auth.uid() in (select), restrict to authenticated.
-- ----------------------------------------------------------------

drop policy if exists "Users can manage their own favorites" on public.favorites;

create policy "Users can manage their own favorites"
  on public.favorites
  as permissive
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ----------------------------------------------------------------
-- 6. comments — wrap auth.uid() in (select), restrict mutations to
--    authenticated. The public SELECT policy ("Anyone can read
--    comments") stays as-is.
-- ----------------------------------------------------------------

drop policy if exists "Authenticated users can insert with rate limit" on public.comments;
drop policy if exists "Users can delete own comments" on public.comments;
drop policy if exists "Users can update own comments" on public.comments;

-- Restricting `to authenticated` makes `auth.uid() IS NOT NULL`
-- redundant (anon never evaluates this policy at all). The
-- rate-limit helper still receives the cached uid via (select).
create policy "Authenticated users can insert with rate limit"
  on public.comments
  as permissive
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.comment_count_last_minute((select auth.uid())) < 5
  );

create policy "Users can update own comments"
  on public.comments
  as permissive
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete own comments"
  on public.comments
  as permissive
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
