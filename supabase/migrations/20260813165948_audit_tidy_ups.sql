-- ================================================================
-- Audit tidy-ups
-- ================================================================
-- Five small findings from the storage/schema audit. None of them is
-- exploitable on its own; each is a place where the schema says
-- something it doesn't mean, which is how the exploitable ones start.
--
--   1. rls_auto_enable() was wired to two event triggers (`ensure_rls`
--      and `rls_auto_enable_trigger`), so it ran twice on every DDL
--      command.
--   2. profiles granted SELECT to anon with no anon policy to match.
--   3. article_views granted authenticated INSERT/UPDATE/DELETE that
--      RLS has always blocked.
--   4. profiles.updated_at never moved — no touch trigger, unlike
--      articles.
--   5. media_captions was an unvalidated jsonb column.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Drop the duplicate rls_auto_enable event trigger
-- ----------------------------------------------------------------
-- `rls_auto_enable_trigger` is the one migration 20260409140000
-- created and the one the migration history accounts for.
-- `ensure_rls` fires the same function on the same event and predates
-- the migrations — it was never in a migration file, so a fresh
-- `db reset` produces a database with one trigger while production ran
-- with two. Dropping it makes the two match and stops the function
-- running twice per DDL statement.

drop event trigger if exists ensure_rls;


-- ----------------------------------------------------------------
-- 2. Revoke the unmatched anon SELECT on profiles
-- ----------------------------------------------------------------
-- The only SELECT policy on profiles is "viewable by self and admins",
-- which is `to authenticated` — so an anonymous select already returned
-- zero rows. The grant was a promise RLS never kept, and the kind of
-- discrepancy that turns into a real leak the day someone adds a
-- permissive policy without re-checking the grants.
--
-- Nothing in the app reads profiles anonymously: use-auth only queries
-- it once a session exists, and the Profile page is behind auth.
-- Comments carry a denormalized user_display_name precisely so the
-- public views never need this table.

revoke select on public.profiles from anon;


-- ----------------------------------------------------------------
-- 3. Revoke write grants on article_views
-- ----------------------------------------------------------------
-- article_views has exactly one policy — "Anyone can read article view
-- counts" — so INSERT/UPDATE/DELETE were dead grants: RLS rejected
-- every write regardless. Counts are only ever incremented through
-- increment_article_view(), which is SECURITY DEFINER and runs as its
-- owner, so it is unaffected by this. The client only ever SELECTs.

revoke insert, update, delete on public.article_views from authenticated;


-- ----------------------------------------------------------------
-- 4. profiles.updated_at touch trigger
-- ----------------------------------------------------------------
-- The column existed with a default of now(), which means it recorded
-- when the row was created and then never moved again — a display_name
-- or avatar change left it stale, so it couldn't be trusted for cache
-- invalidation or "last edited". Same shape as the articles trigger
-- from migration 20260511000000.

create or replace function public.touch_profiles_updated_at()
  returns trigger
  language plpgsql
  set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_profiles_updated_at();

-- Trigger functions in the public schema are exposed by PostgREST as
-- /rest/v1/rpc/<name> (Supabase linter 0028/0029). Triggers fire
-- regardless of EXECUTE grants, so revoking only removes the
-- direct-RPC surface — same treatment as 20260511020000.

revoke execute on function public.touch_profiles_updated_at() from anon;
revoke execute on function public.touch_profiles_updated_at() from authenticated;
revoke execute on function public.touch_profiles_updated_at() from public;


-- ----------------------------------------------------------------
-- 5. media_captions shape validation
-- ----------------------------------------------------------------
-- The column's comment documents the contract — "Array of {en, ro}
-- objects, parallel to media_urls" — but nothing enforced it, so a
-- writer client with a bug could store a bare string, an object, or
-- 500 captions for 3 images and the carousel renderer would be the
-- one to find out.
--
-- CHECK constraints can't contain subqueries, so the predicate lives in
-- an IMMUTABLE helper — the same pattern media_urls already uses with
-- private.text_array_within_length.
--
-- Enforced: a JSON array; no more entries than there are media_urls;
-- every entry an object whose keys are only `en`/`ro`, each holding a
-- string of at most 2000 characters. Existing rows all pass (longest
-- caption in the archive is 489 characters).

create or replace function private.media_captions_valid(p_captions jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select p_captions is null
    or (
      jsonb_typeof(p_captions) = 'array'
      and not exists (
        select 1
        from jsonb_array_elements(p_captions) as t(entry)
        where jsonb_typeof(t.entry) <> 'object'
          or exists (
            select 1
            from jsonb_object_keys(t.entry) as k(name)
            where k.name not in ('en', 'ro')
          )
          or (t.entry ? 'en' and jsonb_typeof(t.entry -> 'en') <> 'string')
          or (t.entry ? 'ro' and jsonb_typeof(t.entry -> 'ro') <> 'string')
          or length(coalesce(t.entry ->> 'en', '')) > 2000
          or length(coalesce(t.entry ->> 'ro', '')) > 2000
      )
    );
$function$;

comment on function private.media_captions_valid(jsonb) is
  'CHECK helper for articles.media_captions: array of {en, ro} string objects, captions at most 2000 chars.';

-- A CHECK constraint's function IS privilege-checked against the role
-- running the INSERT/UPDATE, so `authenticated` needs EXECUTE or every
-- article write fails. Same grant set as private.text_array_within_length,
-- which the media_urls constraint already depends on; anon is excluded
-- because anon never writes articles.

revoke all on function private.media_captions_valid(jsonb) from public;
revoke all on function private.media_captions_valid(jsonb) from anon;
grant execute on function private.media_captions_valid(jsonb) to authenticated, service_role;

alter table public.articles drop constraint if exists articles_media_captions_shape;
alter table public.articles
  add constraint articles_media_captions_shape check (
    private.media_captions_valid(media_captions)
    and (
      media_captions is null
      or jsonb_array_length(media_captions) <= coalesce(array_length(media_urls, 1), 0)
    )
  );
