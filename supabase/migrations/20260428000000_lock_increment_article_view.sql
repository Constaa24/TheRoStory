-- ================================================================
-- Lock down increment_article_view to service_role only
-- ================================================================
-- The view-counter RPC was previously callable by anon and authenticated
-- roles directly. Combined with no rate limiting, that let anyone run
-- `setInterval(() => rpc('increment_article_view', ...), 10)` to inflate
-- view counts arbitrarily.
--
-- The new `increment-view` Edge Function authenticates via the
-- service-role key and applies a per-IP, per-article rate limit before
-- calling this RPC. By revoking EXECUTE from anon/authenticated, the
-- only callable path is now through that function.
--
-- Postgres functions default to `EXECUTE TO public`, so we explicitly
-- revoke from `public` in addition to the named API roles.
-- ================================================================

revoke execute on function public.increment_article_view(text)
  from public, anon, authenticated;

grant execute on function public.increment_article_view(text)
  to service_role;
