-- ================================================================
-- Articles bucket: MIME allowlist + writer/admin upload gate
-- ================================================================
-- The `articles` bucket is the widest surface in the project: public
-- read, 500 MB objects, and until now two gaps on the write side.
--
--   1. No MIME allowlist. `uploadUserFile` (src/lib/supabase.ts) checks
--      extension, MIME prefix and magic bytes, but all three run in the
--      browser and the browser is untrusted. Anyone holding a valid JWT
--      could POST straight at the Storage API and park a 500 MB blob of
--      any content type in a publicly-readable bucket.
--
--   2. The INSERT/UPDATE policies only asked "is this path inside the
--      caller's own folder?" — so *any* authenticated account could
--      upload, including a reader who signed up a minute ago and will
--      never write an article. Only writers and admins ever create
--      articles, so only they need write access to this bucket.
--
-- SELECT is deliberately untouched (the site serves these files to
-- anonymous visitors) and so is DELETE: a writer demoted back to reader
-- must still be able to clean up files they uploaded while they had the
-- role, and admins can already delete anything.
--
-- The MIME list mirrors IMAGE_EXTENSIONS / VIDEO_EXTENSIONS in
-- src/lib/supabase.ts. Keep the two in sync — a type the client accepts
-- but Storage rejects surfaces as a mid-upload failure after the user
-- has already waited through the transfer.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. MIME allowlist
-- ----------------------------------------------------------------
-- video/x-m4v is included alongside video/mp4 because browsers report
-- that type for .m4v files, which the client extension allowlist takes.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v'
]
where id = 'articles';


-- ----------------------------------------------------------------
-- 2. Restrict writes to writers and admins
-- ----------------------------------------------------------------
-- Same folder scoping as before (own-uid folder, or the carousels/
-- stories prefixes that uploadUserFile writes under), now AND-ed with
-- the role check. private.is_writer_or_admin() is STABLE SECURITY
-- DEFINER and already granted to `authenticated`; wrapping it and
-- auth.uid() in a scalar subquery keeps them out of the per-row loop.

drop policy if exists "Users can upload to own folder in articles bucket"
  on storage.objects;

create policy "Users can upload to own folder in articles bucket"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'articles'
    and (select private.is_writer_or_admin())
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'articles'  and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'stories'   and (storage.foldername(name))[3] = (select auth.uid())::text)
    )
  );

-- UPDATE matters because uploadUserFile calls .upload(..., { upsert: true }),
-- which becomes a PUT — an overwrite of an existing object is checked
-- against this policy, not the INSERT one.

drop policy if exists "Users can update own files in articles bucket"
  on storage.objects;

create policy "Users can update own files in articles bucket"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'articles'
    and (
      (select private.is_admin())
      or (
        (select private.is_writer_or_admin())
        and (
          (storage.foldername(name))[1] = (select auth.uid())::text
          or ((storage.foldername(name))[1] = 'articles'  and (storage.foldername(name))[2] = (select auth.uid())::text)
          or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
          or ((storage.foldername(name))[1] = 'stories'   and (storage.foldername(name))[3] = (select auth.uid())::text)
        )
      )
    )
  )
  with check (
    bucket_id = 'articles'
    and (
      (select private.is_admin())
      or (
        (select private.is_writer_or_admin())
        and (
          (storage.foldername(name))[1] = (select auth.uid())::text
          or ((storage.foldername(name))[1] = 'articles'  and (storage.foldername(name))[2] = (select auth.uid())::text)
          or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
          or ((storage.foldername(name))[1] = 'stories'   and (storage.foldername(name))[3] = (select auth.uid())::text)
        )
      )
    )
  );
