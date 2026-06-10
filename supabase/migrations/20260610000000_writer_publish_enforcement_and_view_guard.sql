-- ================================================================
-- Writer publish enforcement + view-counter guard
-- ================================================================
-- Two fixes from the June 2026 full-stack audit:
--
--   1. Writer self-publish was only blocked client-side. The original
--      "Writers can update own draft articles" policy (WITH CHECK
--      is_published = false OR is_admin()) was dropped in
--      20260429030000 because a more permissive policy OR-ed in and
--      made it a no-op. Since 20260507000000 the INSERT/UPDATE
--      policies check ownership + writer/admin role but put no
--      constraint on is_published — so a writer could PATCH
--      is_published=true through PostgREST directly and publish
--      without review, despite the editors (and the Permissions tab)
--      claiming drafts are enforced.
--
--      RLS WITH CHECK cannot compare OLD vs NEW, so the clean fix is
--      a BEFORE INSERT/UPDATE trigger: non-admin callers get
--      is_published forced to false on INSERT and pinned to its
--      previous value on UPDATE. Writers can still edit their
--      published articles without unpublishing them (fixing the
--      editor bug where saving silently reverted to draft) — they
--      just can't flip the publish bit. Admins and service_role are
--      untouched.
--
--   2. increment_article_view inserted/updated a counter row for any
--      article id. Draft articles accrued views, and nonexistent ids
--      produced FK-violation noise in the increment-view edge
--      function logs. Guard the function so it silently no-ops unless
--      the article exists and is published.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. enforce_article_publish_rights trigger
-- ----------------------------------------------------------------

create or replace function public.enforce_article_publish_rights()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $$
declare
  jwt_role text;
begin
  -- Resolve the caller's role. Prefer the JSON claims blob (current
  -- PostgREST); fall back to the legacy per-claim GUC. Guard the
  -- ::jsonb cast so a malformed/absent setting can't raise. Same
  -- pattern as set_comment_display_name (20260604000000).
  begin
    jwt_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  exception when others then
    jwt_role := null;
  end;
  if jwt_role is null then
    jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
  end if;

  -- A NULL role means there is no API caller at all — a direct DB session
  -- (SQL editor, psql, migrations). PostgREST always sets a role claim
  -- (anon / authenticated / service_role), so this branch can't be reached
  -- through the API. Maintenance sessions keep full control.
  if jwt_role is null then
    return new;
  end if;

  -- service_role (data imports, admin tooling) and admins keep full
  -- control over the publish flag.
  if jwt_role = 'service_role' or (select private.is_admin()) then
    return new;
  end if;

  -- Everyone else: new articles are always drafts, and updates cannot
  -- change the publish state. Forcing (rather than raising) matches
  -- the editors' existing behavior and avoids breaking writer saves.
  if tg_op = 'INSERT' then
    new.is_published := false;
  else
    new.is_published := old.is_published;
  end if;
  return new;
end;
$$;

-- Trigger functions fire regardless of EXECUTE grants; revoke the
-- direct-RPC surface like the other trigger helpers (20260511010000).
revoke execute on function public.enforce_article_publish_rights() from public;
revoke execute on function public.enforce_article_publish_rights() from anon;
revoke execute on function public.enforce_article_publish_rights() from authenticated;

drop trigger if exists enforce_article_publish_rights on public.articles;
create trigger enforce_article_publish_rights
  before insert or update on public.articles
  for each row
  execute function public.enforce_article_publish_rights();


-- ----------------------------------------------------------------
-- 2. increment_article_view — published articles only
-- ----------------------------------------------------------------

create or replace function public.increment_article_view(p_article_id text)
  returns void
  language plpgsql
  security definer
  set search_path to ''
as $function$
begin
  -- No-op for drafts and unknown ids: drafts shouldn't accrue public
  -- view counts, and unknown ids previously surfaced as FK-violation
  -- errors in the increment-view edge function logs.
  if not exists (
    select 1 from public.articles
    where id = p_article_id and is_published = true
  ) then
    return;
  end if;

  insert into public.article_views (id, article_id, view_count, updated_at)
  values (
    'view_' || p_article_id,
    p_article_id,
    1,
    now()
  )
  on conflict (article_id) do update
    set view_count = public.article_views.view_count + 1,
        updated_at = now();
end;
$function$;

-- Re-assert the lockdown from 20260428000000. CREATE OR REPLACE
-- preserves grants, but re-stating keeps the posture explicit.
revoke execute on function public.increment_article_view(text)
  from public, anon, authenticated;
grant execute on function public.increment_article_view(text)
  to service_role;
