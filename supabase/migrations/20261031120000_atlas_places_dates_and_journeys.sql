-- ================================================================
-- Atlas: exact places, dates, and curated journeys
-- ================================================================
-- /map is becoming an atlas that puts each story at a point on the map
-- and a span on a timeline, and walks readers through curated journeys.
-- Until now an article carried only `location` (a county name), so the
-- map could do no better than one pin per county and had no notion of
-- when a story happens.
--
-- Everything here is additive. Every new article column is nullable or
-- defaulted, no existing column changes, and no existing query selects
-- the new ones, so the site behaves identically before and after this
-- runs. The atlas falls back to the county for a story with no point,
-- and keeps an undated story off the timeline rather than guessing.
--
--   lat / lng          WGS84 point. Both or neither, and inside a box
--                      around Romania: the atlas only draws Romania, and
--                      the box catches swapped coordinates (26, 44).
--   place_name_en/ro   What the pin is called ("Decebalus Rex, Iron
--                      Gates"). Optional; the county name is the fallback.
--   year_start/end     The span the story is about, in years (negative =
--                      BCE). A single year is start only.
--   era_label_en/ro    Optional display override for the span ("15th
--                      century", "1930s") when the bare years overstate
--                      precision.
--   timeless           Myths and landscapes with no date. Exclusive with
--                      the years, so a story is dated or timeless, never
--                      both.
--
-- journeys / journey_stops: an ordered walk through stories. Public
-- reads see published journeys only, and only the stops whose story is
-- itself published. Writes are admin-only, mirroring categories.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Article place and date columns
-- ----------------------------------------------------------------

alter table public.articles
  add column if not exists lat           double precision,
  add column if not exists lng           double precision,
  add column if not exists place_name_en text,
  add column if not exists place_name_ro text,
  add column if not exists year_start    smallint,
  add column if not exists year_end      smallint,
  add column if not exists era_label_en  text,
  add column if not exists era_label_ro  text,
  add column if not exists timeless      boolean not null default false;

-- Every row is NULL / false in the new columns, so these validate
-- instantly; no NOT VALID / VALIDATE dance needed.
alter table public.articles
  add constraint articles_point_pair
  check ((lat is null) = (lng is null));

alter table public.articles
  add constraint articles_point_in_romania
  check (lat is null or (lat between 43.5 and 48.5 and lng between 20.0 and 30.5));

alter table public.articles
  add constraint articles_place_name_length
  check (
    (place_name_en is null or char_length(place_name_en) <= 120)
    and (place_name_ro is null or char_length(place_name_ro) <= 120)
  );

alter table public.articles
  add constraint articles_year_span
  check (
    (year_start is null or year_start between -3000 and 2100)
    and (year_end is null or (year_start is not null and year_end between year_start and 2100))
  );

alter table public.articles
  add constraint articles_era_label_length
  check (
    (era_label_en is null or char_length(era_label_en) <= 80)
    and (era_label_ro is null or char_length(era_label_ro) <= 80)
  );

alter table public.articles
  add constraint articles_timeless_is_undated
  check (not (timeless and (year_start is not null or year_end is not null)));

comment on column public.articles.lat is 'Atlas pin latitude (WGS84). Set together with lng; NULL places the story at its county.';
comment on column public.articles.lng is 'Atlas pin longitude (WGS84). Set together with lat.';
comment on column public.articles.year_start is 'First year the story is about (negative = BCE). NULL = undated.';
comment on column public.articles.year_end is 'Last year the story is about. NULL = the single year in year_start.';
comment on column public.articles.timeless is 'Myth or landscape with no date. Exclusive with year_start/year_end.';


-- ----------------------------------------------------------------
-- 2. Journeys
-- ----------------------------------------------------------------

create table public.journeys (
  -- The id doubles as the URL slug (/map?journey=power), so it is
  -- restricted to lowercase words joined by hyphens.
  id           text primary key
                 check (char_length(id) <= 60 and id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en     text not null check (char_length(title_en) between 1 and 120),
  title_ro     text not null check (char_length(title_ro) between 1 and 120),
  intro_en     text not null default '' check (char_length(intro_en) <= 600),
  intro_ro     text not null default '' check (char_length(intro_ro) <= 600),
  sort_order   smallint not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.journey_stops (
  -- ON UPDATE CASCADE so renaming a journey's slug carries its stops.
  journey_id text not null references public.journeys (id) on update cascade on delete cascade,
  article_id text not null references public.articles (id) on delete cascade,
  position   smallint not null check (position between 1 and 50),
  primary key (journey_id, position),
  unique (journey_id, article_id)
);

-- The article FK cascades on delete; without this index every article
-- delete would scan journey_stops. Same reasoning as
-- 20260429010000_index_favorites_article_id.
create index journey_stops_article_id_idx on public.journey_stops (article_id);

create or replace function public.touch_journeys_updated_at()
  returns trigger
  language plpgsql
  set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Trigger functions fire regardless of EXECUTE grants; nothing should
-- be able to call this one as an RPC. Same as touch_profiles_updated_at.
revoke execute on function public.touch_journeys_updated_at() from public, anon, authenticated;

create trigger touch_journeys_updated_at
  before update on public.journeys
  for each row
  execute function public.touch_journeys_updated_at();


-- ----------------------------------------------------------------
-- 3. Row level security
-- ----------------------------------------------------------------

alter table public.journeys enable row level security;
alter table public.journey_stops enable row level security;

create policy "Published journeys are viewable by everyone"
  on public.journeys
  as permissive
  for select
  to public
  using (is_published = true or (select private.is_admin()));

create policy "Journeys can be inserted by admins"
  on public.journeys
  as permissive
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "Journeys can be updated by admins"
  on public.journeys
  as permissive
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Journeys can be deleted by admins"
  on public.journeys
  as permissive
  for delete
  to authenticated
  using ((select private.is_admin()));

-- A stop is public when its journey is published and its story is
-- published. Without the second half a published journey would leak
-- the ids of draft stories it points at.
create policy "Stops of published journeys are viewable by everyone"
  on public.journey_stops
  as permissive
  for select
  to public
  using (
    (select private.is_admin())
    or (
      exists (
        select 1 from public.journeys j
        where j.id = journey_stops.journey_id and j.is_published = true
      )
      and exists (
        select 1 from public.articles a
        where a.id = journey_stops.article_id and a.is_published = true
      )
    )
  );

create policy "Journey stops can be inserted by admins"
  on public.journey_stops
  as permissive
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "Journey stops can be updated by admins"
  on public.journey_stops
  as permissive
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Journey stops can be deleted by admins"
  on public.journey_stops
  as permissive
  for delete
  to authenticated
  using ((select private.is_admin()));

-- Grant only what a policy can honour (see 20260813165948_audit_tidy_ups:
-- a grant RLS never permits is a trap for a future permissive policy).
-- anon reads; authenticated reads and, as admin, writes.
revoke all on table public.journeys, public.journey_stops from anon, authenticated;
grant select on table public.journeys, public.journey_stops to anon, authenticated;
grant insert, update, delete on table public.journeys, public.journey_stops to authenticated;


-- ----------------------------------------------------------------
-- 4. Replace a journey's stops atomically
-- ----------------------------------------------------------------
-- Reordering through plain UPDATEs collides with the (journey_id,
-- position) key mid-way, and delete-then-insert from the client is two
-- round-trips that can leave a journey empty if the second fails. One
-- call, one transaction.
--
-- SECURITY INVOKER: the admin-only policies above still apply. The
-- explicit check only turns a silent zero-row delete into a clear error.

create or replace function public.set_journey_stops(p_journey_id text, p_article_ids text[])
  returns void
  language plpgsql
  security invoker
  set search_path to ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Only admins can edit journeys' using errcode = '42501';
  end if;

  delete from public.journey_stops where journey_id = p_journey_id;

  insert into public.journey_stops (journey_id, article_id, position)
  select p_journey_id, s.article_id, s.ord::smallint
  from unnest(coalesce(p_article_ids, '{}'::text[])) with ordinality as s (article_id, ord);
end;
$$;

revoke execute on function public.set_journey_stops(text, text[]) from public, anon;
grant execute on function public.set_journey_stops(text, text[]) to authenticated;
