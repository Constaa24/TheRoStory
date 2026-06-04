-- ================================================================
-- Fix the service_role detection in set_comment_display_name
-- ================================================================
-- The trigger skipped its display-name override for service_role callers
-- (so data imports / admin tooling could keep an explicitly-supplied name)
-- by reading `current_setting('request.jwt.claim.role', true)`.
--
-- That per-claim GUC is the legacy GoTrue/PostgREST form. Newer PostgREST
-- exposes all claims as a single JSON blob in `request.jwt.claims` and no
-- longer populates the per-claim `request.jwt.claim.*` GUCs. On such a
-- deployment the old check always read NULL, so the service_role skip never
-- fired and an imported comment's name was overwritten from profiles.
--
-- Fix: resolve the role from the JSON `request.jwt.claims` first, falling
-- back to the legacy GUC. Everything else about the trigger is unchanged.
-- ================================================================

create or replace function public.set_comment_display_name()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $$
declare
  resolved_name text;
  meta_full_name text;
  meta_display_name text;
  user_email text;
  jwt_role text;
begin
  -- Resolve the caller's role. Prefer the JSON claims blob (current
  -- PostgREST); fall back to the legacy per-claim GUC. Guard the ::jsonb
  -- cast so a malformed/absent setting can't raise.
  begin
    jwt_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  exception when others then
    jwt_role := null;
  end;
  if jwt_role is null then
    jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
  end if;

  -- Skip the override when the caller is service_role. Lets data imports
  -- keep an explicitly-supplied name.
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- 1. Try the profiles row.
  select display_name into resolved_name
  from public.profiles
  where id = new.user_id;

  resolved_name := nullif(trim(resolved_name), '');

  -- 2. Fall back to auth.users metadata if profiles is missing or empty.
  if resolved_name is null then
    select
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'display_name',
      email
    into meta_full_name, meta_display_name, user_email
    from auth.users
    where id = new.user_id;

    resolved_name := coalesce(
      nullif(trim(meta_display_name), ''),
      nullif(trim(meta_full_name), ''),
      -- 3. Last resort: username part of the email address.
      nullif(split_part(user_email, '@', 1), '')
    );
  end if;

  -- 4. If everything failed, use 'Anonymous'.
  new.user_display_name := coalesce(resolved_name, 'Anonymous');
  return new;
end;
$$;

-- Re-assert the lockdown from 20260511010000. CREATE OR REPLACE preserves
-- existing grants, but re-stating them keeps the linter happy and makes the
-- posture explicit: the function is only ever invoked as a BEFORE INSERT
-- trigger, never as a direct RPC.
revoke execute on function public.set_comment_display_name() from public;
revoke execute on function public.set_comment_display_name() from anon;
revoke execute on function public.set_comment_display_name() from authenticated;
