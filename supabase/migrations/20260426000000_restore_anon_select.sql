-- ================================================================
-- Hotfix: Restore SELECT privilege for the anon role on public tables
-- ================================================================
-- After applying earlier security migrations and/or a Supabase platform
-- update, the anon role lost SELECT privilege on the tables that need
-- to be publicly readable. PostgREST returned 401 (proxy-status error
-- 42501 = insufficient_privilege) for any anonymous request.
--
-- Logged-in users were unaffected because their role is `authenticated`,
-- which still had SELECT.
--
-- The intended posture from the original security audit:
--   anon → SELECT only on publicly readable tables, no writes anywhere
--   anon → no access at all to favorites or user_roles (private)
-- This migration explicitly restores that posture.
-- ================================================================

grant select on table "public"."articles"      to "anon";
grant select on table "public"."categories"    to "anon";
grant select on table "public"."article_views" to "anon";
grant select on table "public"."comments"      to "anon";
grant select on table "public"."profiles"      to "anon";

-- favorites and user_roles intentionally remain inaccessible to anon.
