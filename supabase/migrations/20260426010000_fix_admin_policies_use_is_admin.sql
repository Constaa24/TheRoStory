-- ================================================================
-- Hotfix: Convert admin RLS policies to use public.is_admin()
-- ================================================================
-- The admin policies on articles and categories used inline
-- `EXISTS (SELECT 1 FROM public.user_roles ...)` checks. When an
-- anonymous user queries articles, PostgreSQL evaluates ALL
-- applicable RLS policies, including these admin ones — and the
-- EXISTS subquery hits user_roles, which anon (correctly) has no
-- access to. Result: 42501 (insufficient_privilege), which PostgREST
-- returns as 401 Unauthorized for every anon request.
--
-- The fix:
--   1. Use the SECURITY DEFINER helper public.is_admin() so the
--      role check bypasses RLS and table grants on user_roles.
--   2. Scope admin policies to `authenticated` instead of `public`
--      so anon never evaluates them in the first place.
--
-- This mirrors the earlier fix for the user_roles recursion.
-- ================================================================

-- articles: admin manage policy
drop policy if exists "Admins can manage all articles" on "public"."articles";

create policy "Admins can manage all articles"
  on "public"."articles"
  as permissive
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- articles: writer policy referenced user_roles in its WITH CHECK
drop policy if exists "Writers can update own draft articles" on "public"."articles";

create policy "Writers can update own draft articles"
  on "public"."articles"
  as permissive
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    (user_id = auth.uid())
    and ((is_published = false) or public.is_admin())
  );

-- categories: admin manage policy (was already TO authenticated, just needs is_admin())
drop policy if exists "Admins can manage categories" on "public"."categories";

create policy "Admins can manage categories"
  on "public"."categories"
  as permissive
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
