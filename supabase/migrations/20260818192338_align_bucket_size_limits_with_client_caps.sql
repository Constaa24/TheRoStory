-- Bucket ceilings were far above the caps the app actually enforces:
-- articles allowed 500 MB against a 150 MB client cap, avatars allowed 50 MB
-- against 5 MB. The client number is the one a person meets; the bucket is the
-- one actually enforced, so the policy was advisory rather than real. Only
-- writers and admins can upload at all, so the gap was reachable only by
-- someone trusted bypassing the editor — but a limit that isn't enforced isn't
-- a limit.
--
-- articles takes 150 MB because it holds both images (10 MB cap) and video
-- (150 MB cap) and must allow the larger. avatars takes 5 MB, matching
-- Profile.tsx, its only writer.
--
-- Applies to new uploads only; existing objects are untouched. Verified before
-- applying: largest article object 88 MB, largest avatar ~2 MB, zero objects
-- over either new limit.
--
-- Keep in sync with MAX_VIDEO_BYTES / MAX_IMAGE_BYTES in src/lib/supabase.ts
-- and the maxBytes override in Profile.tsx.

update storage.buckets set file_size_limit = 150 * 1024 * 1024 where id = 'articles';
update storage.buckets set file_size_limit = 5 * 1024 * 1024 where id = 'avatars';
