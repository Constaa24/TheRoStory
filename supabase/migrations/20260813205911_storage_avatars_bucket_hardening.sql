-- ================================================================
-- Avatars bucket: MIME allowlist + authenticated-only INSERT
-- ================================================================
-- The companion to 20260813164832, which did the same for `articles`.
-- The avatars bucket was left alone at the time because it is much
-- lower risk (50 MB cap rather than 500 MB), but it had the same two
-- gaps, and one of them had already let something through: the bucket
-- holds an object stored as `application/octet-stream`, i.e. a file
-- uploaded with no usable content type. An allowlist would have
-- refused it.
--
-- Deliberately NOT copied from the articles migration: the
-- writer/admin gate. Every account, reader included, legitimately
-- uploads its own avatar — the folder scoping is the whole access
-- rule here and that part was already correct.
--
-- The MIME list mirrors IMAGE_EXTENSIONS in src/lib/supabase.ts, which
-- is what uploadUserFile enforces client-side for kind: 'image'.
-- Existing objects are unaffected; an allowlist only applies to new
-- uploads.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. MIME allowlist
-- ----------------------------------------------------------------

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]
where id = 'avatars';


-- ----------------------------------------------------------------
-- 2. Scope the INSERT policy to `authenticated`
-- ----------------------------------------------------------------
-- The policy was granted to `public`, which includes anon. That was
-- never actually exploitable — for an anonymous request auth.uid() is
-- NULL, so the folder comparison evaluates to NULL rather than true
-- and the insert is refused — but it meant the policy list read as
-- though anonymous uploads were contemplated. Naming `authenticated`
-- explicitly matches every other policy on this bucket.
--
-- auth.uid() also moves into a scalar subquery so it is evaluated once
-- per statement instead of once per row, consistent with the initplan
-- treatment applied across the schema in 20260429030000.

drop policy if exists "Users can upload their own avatar" on storage.objects;

create policy "Users can upload their own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
