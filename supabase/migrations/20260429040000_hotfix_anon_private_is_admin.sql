-- ================================================================
-- Hotfix: anon needs EXECUTE on private.is_admin() for the
-- articles SELECT policy to plan correctly
-- ================================================================
-- Migration 20260429030000 collapsed the articles SELECT policies
-- into one policy `to public`, with the body:
--
--   USING (
--     is_published = true
--     or user_id = (select auth.uid())
--     or private.is_admin()
--   )
--
-- Migration 20260429020000 had moved is_admin() into the `private`
-- schema and granted USAGE/EXECUTE only to `authenticated` and
-- `service_role`. As a result, when anon queries `articles`,
-- Postgres's planner refuses to even plan the query — it verifies
-- EXECUTE permission on every function referenced in the policy
-- up front, regardless of whether runtime short-circuit would
-- reach that branch. The error surfaces as
-- "permission denied for function is_admin" (SQLSTATE 42501),
-- which PostgREST returns as HTTP 401 to the client.
--
-- Granting anon USAGE on the schema and EXECUTE on the function
-- is safe:
--   * PostgREST's `db_schemas` setting does not expose `private`,
--     so anon still cannot call /rest/v1/rpc/is_admin.
--   * is_admin() returns false for anon because auth.uid() is
--     null, so no information leaks.
-- ================================================================

grant usage on schema private to anon;
grant execute on function private.is_admin() to anon;

-- Note: anon does NOT need EXECUTE on private.comment_count_last_minute
-- because the comments INSERT policy is `to authenticated` — anon
-- never evaluates it.
