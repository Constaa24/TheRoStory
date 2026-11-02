-- A comment's public name never comes from the commenter's email address.
--
-- set_comment_display_name resolves the name shown beside a comment: the
-- profile's display name, then the auth metadata, and, as a last resort, the
-- part of the email address before the "@". That last step published part of
-- a reader's email address beside their comment without them ever choosing
-- it as a name: for a typical address, their own name. Nobody is affected
-- today (every profile has a display name, and no comment carries an email
-- fragment, checked 2026-11-02), but an account created without a name, or a
-- profile whose name was cleared, would have been.
--
-- The fallback is now "Anonymous", which was already the final default. The
-- rest of the function is unchanged. CREATE OR REPLACE keeps the existing
-- grants (EXECUTE was revoked from client roles in 20260511010000) and the
-- trigger that calls it.

create or replace function public.set_comment_display_name()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  resolved_name text;
  meta_full_name text;
  meta_display_name text;
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
      raw_user_meta_data->>'display_name'
    into meta_full_name, meta_display_name
    from auth.users
    where id = new.user_id;

    resolved_name := coalesce(
      nullif(trim(meta_display_name), ''),
      nullif(trim(meta_full_name), '')
    );
  end if;

  -- 3. Otherwise 'Anonymous'. Never the email address, or any part of it.
  new.user_display_name := coalesce(resolved_name, 'Anonymous');
  return new;
end;
$function$;
