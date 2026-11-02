-- Nobody can list the storage buckets except the files' owners and admins.
--
-- "Public Access" let every visitor, signed in or not, SELECT every row of
-- storage.objects in both buckets. Reading a file by its public URL doesn't
-- need that: both buckets are public, and /object/public/ and
-- /render/image/public/ serve them without consulting RLS. What the policy
-- did grant was the storage *list* endpoint. Checked on 2026-11-02 with the
-- publishable key and no session, both buckets returned their contents:
--
--   - avatars: one folder per account, named by the account's user ID, so a
--     list was a list of every member's internal ID;
--   - articles: the media of every story, including drafts not yet
--     published, by file name.
--
-- The site never lists storage from the browser (admin cleanup goes through
-- the admin-api function with the service role, which bypasses RLS). But two
-- client calls do need SELECT on the caller's own files: an upload with
-- `upsert: true` (replacing an avatar or a cover) and `remove()`, both of
-- which read the row they change. So the replacement grants SELECT for
-- exactly the files each person can already upload or delete (the same
-- folder rules as the INSERT/DELETE policies), plus everything for admins,
-- and nothing to anonymous visitors.

drop policy if exists "Public Access" on storage.objects;

create policy "Owners and admins can see their files"
on storage.objects
for select
to authenticated
using (
  (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  )
  or (
    bucket_id = 'articles'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'articles' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'carousels' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'stories' and (storage.foldername(name))[3] = (select auth.uid())::text)
      or (select private.is_admin())
    )
  )
);
