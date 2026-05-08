-- ================================================================
-- Follow-up audit fixes
-- ================================================================
-- Closes the issues found in the second audit pass:
--
--   1. Storage UPDATE/DELETE policies for avatars and articles buckets
--      now have an admin override. Previously, when an admin deleted
--      another user's article via supabase.from('articles').delete(),
--      the article row went away but the storage objects under
--      <other_uid>/... could not be removed by the admin. They orphaned
--      forever. Same problem when admin-api deletes a user.
--
--   2. set_comment_display_name now falls back to auth.users metadata
--      (full_name, email-local-part) before resorting to "Anonymous".
--      Closes the post-signup race where the profiles row hasn't fully
--      committed when a comment INSERT fires.
--
--   3. set_comment_display_name now skips its overwrite when the
--      caller is service_role — lets data imports / restores keep the
--      explicitly-supplied name.
--
--   4. Revoke unused EXECUTE grants on private helpers from anon.
--      Cosmetic; the policies referencing them are 'to authenticated'.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Storage avatars bucket — admin override on UPDATE / DELETE
-- ----------------------------------------------------------------

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects
  as permissive
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects
  as permissive
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );


-- ----------------------------------------------------------------
-- 2. Storage articles bucket — admin override on UPDATE / DELETE
-- ----------------------------------------------------------------

drop policy if exists "Users can update own files in articles bucket" on storage.objects;
create policy "Users can update own files in articles bucket"
  on storage.objects
  as permissive
  for update
  to authenticated
  using (
    bucket_id = 'articles'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'articles' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'stories' and (storage.foldername(name))[3] = (select auth.uid())::text)
      or (select private.is_admin())
    )
  )
  with check (
    bucket_id = 'articles'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'articles' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'stories' and (storage.foldername(name))[3] = (select auth.uid())::text)
      or (select private.is_admin())
    )
  );

drop policy if exists "Users can delete own files in articles bucket" on storage.objects;
create policy "Users can delete own files in articles bucket"
  on storage.objects
  as permissive
  for delete
  to authenticated
  using (
    bucket_id = 'articles'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'articles' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'stories' and (storage.foldername(name))[3] = (select auth.uid())::text)
      or (select private.is_admin())
    )
  );


-- ----------------------------------------------------------------
-- 3. set_comment_display_name — better fallback chain
-- ----------------------------------------------------------------
-- Order of preference:
--   1. profiles.display_name (the canonical source post-signup)
--   2. auth.users.raw_user_meta_data->>'full_name' or 'display_name'
--      (covers the OAuth signup race where profiles hasn't committed)
--   3. The username portion of the email
--   4. 'Anonymous' as a final fallback
--
-- Service-role inserts (data imports, admin-api edge functions) are
-- skipped entirely — the supplied user_display_name is preserved.

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
begin
  -- Skip the override when the caller is service_role. Lets data
  -- imports keep an explicitly-supplied name. Note: current_setting
  -- with missing_ok=true returns null when the setting isn't present,
  -- which is the case for normal authenticated requests.
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
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


-- ----------------------------------------------------------------
-- 4. Revoke unused anon EXECUTE grants
-- ----------------------------------------------------------------
-- Both functions are referenced only by RLS policies scoped
-- 'to authenticated', so the planner never needs anon to evaluate
-- them. The grant was defensive but unused. Keep is_admin() granted
-- to anon (still needed for the public articles SELECT policy).

revoke execute on function private.is_writer_or_admin() from anon;
revoke execute on function private.text_array_within_length(text[], integer) from anon;
