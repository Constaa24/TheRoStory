-- ================================================================
-- Fixes from the audit of 2026-11-17
-- ================================================================
--   1. One publication date, however a story is published. A scheduled
--      story took its scheduled time as its date (it led the home page);
--      one published by hand, from the editor or the desk, kept the date
--      its draft was first saved, so a story drafted three weeks ago and
--      published today opened three weeks down the archive. Now the first
--      publication dates the story, every way: created_at becomes the
--      moment it first went public (the scheduled time, for a scheduled
--      story). first_published_at records that it has happened, so taking
--      a story down and putting it back up never re-dates it.
--   2. Writers keep their hands off created_at and id. Both were writable
--      through the "update own story" policy: a writer could date a story
--      in 2099 and pin it to the top of the home page, or rename its id
--      and break every link to it. Admins (and maintenance sessions) are
--      unchanged.
--   3. The desk's shelf order is saved in one statement (set_shelf_order),
--      not one request per shelf: a failure part-way used to leave the
--      shelves half reordered.
--   4. search_articles also returns each story's place and date, which
--      the search results show; the client fetched them in a second
--      request after every search.
--   5. pg_cron keeps a row per run forever (288 a day for the publishing
--      job). A nightly job keeps the last week.
-- ================================================================

-- ---------------------------------------------------------------- 1. publication date

alter table public.articles add column if not exists first_published_at timestamptz;

comment on column public.articles.first_published_at is
  'When the story first went public. Set by stamp_article_publication; the story''s date (created_at) is set to the same moment then, and never again.';

-- Everything published so far has been dated already.
update public.articles
   set first_published_at = created_at
 where is_published
   and first_published_at is null;

create or replace function private.stamp_article_publication()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    -- Published on creation (an admin's "publish now", or an import):
    -- its creation time is its publication time.
    if new.is_published then
      new.first_published_at := coalesce(new.first_published_at, new.created_at, now());
    end if;
    return new;
  end if;

  -- The first time it goes public: dated now, or at its scheduled time
  -- when the publishing job is a few minutes late for it. A schedule
  -- still in the future (an admin publishing early) counts as now.
  if new.is_published and not old.is_published and old.first_published_at is null then
    new.created_at := least(now(), coalesce(old.publish_at, now()));
    new.first_published_at := new.created_at;
  end if;
  return new;
end;
$function$;

-- Trigger functions fire regardless of EXECUTE grants; nothing should call it.
revoke all on function private.stamp_article_publication() from public, anon, authenticated;

-- BEFORE triggers run in name order: after enforce_article_publish_rights
-- (so a writer's attempt to publish is already undone), before
-- touch_articles_updated_at.
drop trigger if exists stamp_article_publication on public.articles;
create trigger stamp_article_publication
  before insert or update on public.articles
  for each row execute function private.stamp_article_publication();

-- The publishing job now only publishes: the trigger above dates the story
-- with its scheduled time, the same rule as publishing by hand.
create or replace function private.publish_scheduled_stories()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  n integer;
begin
  update public.articles
     set is_published = true,
         publish_at = null
   where is_published = false
     and publish_at is not null
     and publish_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function private.publish_scheduled_stories() from public, anon, authenticated;

-- ---------------------------------------------------------------- 2. publish rights

-- As in 20261110120000, plus: for everyone but admins and maintenance
-- sessions, a new story is dated now and an edit leaves the date, the id
-- and the publication stamp as they were.
create or replace function public.enforce_article_publish_rights()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
  -- (SQL editor, psql, migrations, the scheduled-publishing job). PostgREST
  -- always sets a role claim (anon / authenticated / service_role), so this
  -- branch can't be reached through the API. Maintenance sessions keep full
  -- control.
  if jwt_role is null then
    return new;
  end if;

  -- service_role (data imports, admin tooling) and admins keep full
  -- control over the publish flag, the schedule and the date.
  if jwt_role = 'service_role' or (select private.is_admin()) then
    return new;
  end if;

  -- Everyone else: new articles are always unscheduled drafts dated now,
  -- and updates cannot change the publish state, the schedule, the date or
  -- the id. Forcing (rather than raising) matches the editors' existing
  -- behavior and avoids breaking writer saves.
  if tg_op = 'INSERT' then
    new.is_published := false;
    new.publish_at := null;
    new.created_at := now();
    new.first_published_at := null;
  else
    new.is_published := old.is_published;
    new.publish_at := old.publish_at;
    new.created_at := old.created_at;
    new.first_published_at := old.first_published_at;
    new.id := old.id;
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_article_publish_rights() from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. shelf order

-- SECURITY INVOKER: the categories policies still decide who may write;
-- the check up front only turns a silent no-op into a clear refusal.
create or replace function public.set_shelf_order(p_ids text[])
returns void
language plpgsql
set search_path to ''
as $function$
begin
  if not (select private.is_admin()) then
    raise exception 'Only admins can reorder the shelves' using errcode = '42501';
  end if;
  update public.categories c
     set sort_order = o.ord::smallint
    from unnest(p_ids) with ordinality as o(id, ord)
   where c.id = o.id;
end;
$function$;

comment on function public.set_shelf_order(text[]) is
  'Saves the shelves'' order in one statement: each id''s position in p_ids becomes its sort_order (1-based). Admins only.';

revoke all on function public.set_shelf_order(text[]) from public, anon;
grant execute on function public.set_shelf_order(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------- 4. search with place and date

-- The return type changes, so the function is dropped and made again
-- (CREATE OR REPLACE cannot change it); its grants are restored below.
-- Unchanged otherwise: same matching, same order, SECURITY INVOKER.
drop function if exists public.search_articles(text, integer);

create function public.search_articles(p_query text, p_limit integer default 6)
returns table(
  id text, title_en text, title_ro text, type text, subtype text,
  media_url text, poster_url text, media_urls text[], location text,
  category_id text, user_id uuid, is_published boolean, created_at timestamptz,
  lat double precision, lng double precision, place_name_en text, place_name_ro text,
  year_start smallint, year_end smallint, era_label_en text, era_label_ro text, timeless boolean
)
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_term    text;
  v_pattern text;
  v_limit   integer := least(greatest(coalesce(p_limit, 6), 1), 50);
begin
  v_term := btrim(coalesce(p_query, ''));
  if length(v_term) < 3 then
    return;
  end if;

  v_pattern := '%' || replace(replace(replace(
                 public.immutable_unaccent(v_term),
                 '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select a.id, a.title_en, a.title_ro, a.type, a.subtype,
         a.media_url, a.poster_url, a.media_urls, a.location,
         a.category_id, a.user_id, a.is_published, a.created_at,
         a.lat, a.lng, a.place_name_en, a.place_name_ro,
         a.year_start, a.year_end, a.era_label_en, a.era_label_ro, a.timeless
  from public.articles a
  where a.is_published
    and (
      public.immutable_unaccent(a.title_en)   ilike v_pattern
      or public.immutable_unaccent(a.title_ro)   ilike v_pattern
      or public.immutable_unaccent(a.content_en) ilike v_pattern
      or public.immutable_unaccent(a.content_ro) ilike v_pattern
      or public.immutable_unaccent(a.location)   ilike v_pattern
    )
  order by
    case
      when public.immutable_unaccent(a.title_en) ilike v_pattern
        or public.immutable_unaccent(a.title_ro) ilike v_pattern
      then 0 else 1
    end,
    a.created_at desc,
    a.id desc
  limit v_limit;
end;
$function$;

comment on function public.search_articles(text, integer) is
  'Accent-insensitive search over published stories (title, content, county). Returns the card columns with place and date. SECURITY INVOKER.';

revoke all on function public.search_articles(text, integer) from public;
grant execute on function public.search_articles(text, integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- 5. cron history

-- cron.schedule() replaces a job of the same name, so running this file
-- twice leaves one job.
select cron.schedule(
  'purge-cron-history',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
