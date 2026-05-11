-- ================================================================
-- Revoke EXECUTE on set_comment_display_name from anon/authenticated
-- ================================================================
-- Supabase database linter (0028/0029) flagged that this
-- SECURITY DEFINER function is callable by anon and authenticated
-- via /rest/v1/rpc/set_comment_display_name.
--
-- The function is only ever invoked as a BEFORE INSERT trigger on
-- public.comments (see 20260507000000_audit_hardening.sql). Trigger
-- firing does not depend on EXECUTE grants — the trigger is attached
-- to the table and SECURITY DEFINER runs the body as the function
-- owner regardless. Revoking EXECUTE only removes the direct-RPC
-- attack surface, leaving normal comment INSERT behavior unchanged.
-- ================================================================

revoke execute on function public.set_comment_display_name() from anon;
revoke execute on function public.set_comment_display_name() from authenticated;
revoke execute on function public.set_comment_display_name() from public;
