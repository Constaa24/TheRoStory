-- ================================================================
-- Revoke EXECUTE on touch_articles_updated_at from anon/authenticated
-- ================================================================
-- touch_articles_updated_at is a BEFORE UPDATE trigger on
-- public.articles (added by migration 20260511000000). Like all
-- trigger functions in the public schema, PostgREST exposes it via
-- /rest/v1/rpc/touch_articles_updated_at, which trips Supabase
-- linter rules 0028 / 0029. Triggers fire regardless of EXECUTE
-- grants, so revoking is safe — only the direct-RPC attack surface
-- is removed.
-- ================================================================

revoke execute on function public.touch_articles_updated_at() from anon;
revoke execute on function public.touch_articles_updated_at() from authenticated;
revoke execute on function public.touch_articles_updated_at() from public;
