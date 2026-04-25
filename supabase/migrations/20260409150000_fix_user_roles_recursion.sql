-- ================================================================
-- Hotfix: Resolve infinite recursion in user_roles admin policy
-- ================================================================
-- The "Admins can manage all user roles" policy added in the
-- previous migration queried public.user_roles inside its USING
-- clause. Because that subquery is itself subject to RLS on
-- public.user_roles, evaluating the policy re-evaluates the same
-- policy, causing infinite recursion (SQLSTATE 42P17).
--
-- The error cascades: any other policy that queries user_roles
-- (e.g. the admin policies on articles and categories) also
-- triggers the recursive evaluation, which is why every endpoint
-- returns 500.
--
-- Fix: extract the admin check into a SECURITY DEFINER function.
-- SECURITY DEFINER functions run with the function owner's
-- privileges and bypass RLS, so the check itself does not trigger
-- policy evaluation on user_roles.
-- ================================================================

create or replace function public.is_admin()
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

-- Restrict who can call the helper. anon never needs it.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- Replace the recursive policy with one that uses the function
drop policy if exists "Admins can manage all user roles"
  on "public"."user_roles";

create policy "Admins can manage all user roles"
  on "public"."user_roles"
  as permissive
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
