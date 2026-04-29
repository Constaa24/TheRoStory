-- ================================================================
-- Lock down SECURITY DEFINER functions in public schema
-- ================================================================
-- Supabase's database linter (lints 0028 / 0029) flags every
-- SECURITY DEFINER function in the `public` schema as reachable
-- by `anon` and `authenticated` via PostgREST RPC
-- (/rest/v1/rpc/<name>). Even when the function returns nothing
-- useful when called directly, exposing it widens the attack
-- surface and lets attackers fingerprint internals.
--
-- Postgres only checks EXECUTE on trigger functions at trigger
-- *creation* time, not when the trigger fires. Same applies to
-- event-trigger functions. So we can fully revoke EXECUTE from
-- anon/authenticated for the three trigger helpers below without
-- breaking anything — the triggers continue to fire as before.
--
-- The two RLS helper functions (`is_admin`, `comment_count_last_minute`)
-- are evaluated inside RLS policies. The role making the request
-- (typically `authenticated`) needs EXECUTE for those policy checks
-- to run, otherwise we'd get 42501 (insufficient_privilege) on every
-- INSERT/UPDATE that touches the affected tables.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. comment_count_last_minute(uid uuid)
--    Used by the INSERT WITH CHECK policy on public.comments to
--    enforce the 5-comments-per-minute rate limit. The authenticated
--    role must keep EXECUTE so the policy can be evaluated; anon
--    never gets there because the same policy short-circuits on
--    `auth.uid() IS NOT NULL`.
-- ----------------------------------------------------------------

revoke execute on function public.comment_count_last_minute(uuid)
  from public, anon;

grant execute on function public.comment_count_last_minute(uuid)
  to authenticated, service_role;


-- ----------------------------------------------------------------
-- 2. handle_new_user()
--    AFTER INSERT trigger on auth.users — bootstraps profile and
--    user_roles rows. Trigger fires regardless of EXECUTE grants,
--    so no API role needs to call it directly.
-- ----------------------------------------------------------------

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;


-- ----------------------------------------------------------------
-- 3. is_admin()
--    Used by admin RLS policies on user_roles, articles, categories.
--    Authenticated must keep EXECUTE for those policy checks; anon
--    never passes the admin gate so revoking from anon is safe.
--    Re-asserts the grants from migration 20260409150000 in case
--    any subsequent CREATE OR REPLACE re-introduced the public grant.
-- ----------------------------------------------------------------

revoke execute on function public.is_admin()
  from public, anon;

grant execute on function public.is_admin()
  to authenticated, service_role;


-- ----------------------------------------------------------------
-- 4. rls_auto_enable()
--    Event trigger function — runs on DDL command end. Postgres
--    does not check EXECUTE for event triggers, so we can fully
--    revoke from the API tier.
-- ----------------------------------------------------------------

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;


-- ----------------------------------------------------------------
-- 5. sync_comment_display_names()
--    AFTER UPDATE trigger on public.profiles — propagates display
--    name changes to historical comments. Trigger fires regardless
--    of EXECUTE grants on its function.
-- ----------------------------------------------------------------

revoke execute on function public.sync_comment_display_names()
  from public, anon, authenticated;
