-- ================================================================
-- Atomic favorite toggle via RPC
-- ================================================================
-- The client previously toggled a favorite by trying INSERT first and
-- treating the (user_id, article_id) unique-violation as "already
-- favorited → DELETE". That works and is race-safe, but every
-- un-favorite makes the browser log a noisy `409 Conflict` (browsers
-- log all non-2xx responses regardless of how the app handles them).
--
-- Move the toggle into a single RPC: it returns 200 in every case (no
-- 409), does the delete/insert in one statement-level transaction, and
-- collapses the un-favorite path from two round-trips to one.
--
-- SECURITY INVOKER: runs as the calling user, so the existing
-- "Users can manage their own favorites" RLS policy still applies and
-- the function can only ever touch the caller's own rows. auth.uid() is
-- wrapped in (select ...) so it's evaluated once. No SECURITY DEFINER,
-- so it doesn't widen the RPC attack surface beyond the table the caller
-- can already write.
-- ================================================================

create or replace function public.toggle_favorite(p_article_id text)
  returns boolean
  language plpgsql
  security invoker
  set search_path to ''
as $$
begin
  delete from public.favorites
   where user_id = (select auth.uid())
     and article_id = p_article_id;
  if found then
    return false; -- was favorited → now removed
  end if;

  -- ON CONFLICT keeps a race between two concurrent "add" calls from
  -- raising — the net state is "favorited" either way.
  insert into public.favorites (user_id, article_id)
  values ((select auth.uid()), p_article_id)
  on conflict (user_id, article_id) do nothing;
  return true; -- added
end;
$$;

revoke execute on function public.toggle_favorite(text) from public, anon;
grant execute on function public.toggle_favorite(text) to authenticated;
