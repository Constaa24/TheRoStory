-- ================================================================
-- The editorial desk (the redesign's AdminApp and StoryEditor)
-- ================================================================
-- Everything the desk's new sections need, in one place:
--
--   1. Daily reads. article_views keeps one lifetime total per story; the
--      overview's "Reads per day" chart and "Most read this month" need a
--      count per day. increment_article_view (the only writer, called by
--      the increment-view edge function) now also bumps today's row. Days
--      are Bucharest days. There is no history before this runs.
--   2. Scheduled publishing. articles.publish_at: a draft with a time set
--      is published by a pg_cron job every five minutes, and its date
--      becomes that time so it opens the home page. Only admins may set it
--      (the publish-rights trigger now guards it like is_published).
--   3. Shelves. categories gain a description per language (shown on the
--      shelf page) and sort_order, the order the site lists them in;
--      initialised alphabetically, which is the order used until now.
--   4. Readers' notes. Notes still appear as soon as they are posted (the
--      owner's decision, 2026-11-10). Signed-in readers can flag a note
--      (comment_flags, once per reader); admins can hide one (hidden_at)
--      or delete it. A hidden note is seen only by its writer and admins.
--      A trigger keeps hidden_at out of everyone else's hands, so a writer
--      cannot un-hide their own note through the "update own" policy.
--   5. Dispatches. newsletter_dispatches records each letter sent from the
--      desk. Rows are written by the newsletter-dispatch edge function
--      (service role); admins can read them.
--   6. desk_stats(): the overview's counts that RLS keeps from the client
--      (readers live in auth.users, subscribers behind a no-access policy).
--      Admins only; it returns counts, never rows.
--
-- Additive: new nullable columns and new tables. The two replaced policies
-- (read and change comments) keep their old meaning for everyone but
-- admins, and only narrow what anyone can read by the new hidden_at.
--
-- Grants follow 20260813165948_audit_tidy_ups: each new table grants only
-- what a policy can honour, and trigger functions lose EXECUTE. Comments
-- gain one column grant (hidden_at), because 20260702000000 limits
-- authenticated UPDATEs to the columns the app writes.
-- ================================================================

-- ---------------------------------------------------------------- 1. daily reads

create table if not exists public.article_reads_daily (
  article_id text not null references public.articles(id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  primary key (article_id, day)
);
create index if not exists article_reads_daily_day_idx on public.article_reads_daily (day);

alter table public.article_reads_daily enable row level security;

drop policy if exists "Daily reads are visible to writers and admins" on public.article_reads_daily;
create policy "Daily reads are visible to writers and admins"
  on public.article_reads_daily for select to authenticated
  using ((select private.is_writer_or_admin()));

-- Read only: the one writer is increment_article_view (security definer).
revoke all on table public.article_reads_daily from anon, authenticated;
grant select on table public.article_reads_daily to authenticated;

create or replace function public.increment_article_view(p_article_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- No-op for drafts and unknown ids: drafts shouldn't accrue public
  -- view counts, and unknown ids previously surfaced as FK-violation
  -- errors in the increment-view edge function logs.
  if not exists (
    select 1 from public.articles
    where id = p_article_id and is_published = true
  ) then
    return;
  end if;

  insert into public.article_views (id, article_id, view_count, updated_at)
  values (
    'view_' || p_article_id,
    p_article_id,
    1,
    now()
  )
  on conflict (article_id) do update
    set view_count = public.article_views.view_count + 1,
        updated_at = now();

  -- The same read, counted against today (a Bucharest day) for the desk.
  insert into public.article_reads_daily (article_id, day, views)
  values (p_article_id, (now() at time zone 'Europe/Bucharest')::date, 1)
  on conflict (article_id, day) do update
    set views = public.article_reads_daily.views + 1;
end;
$function$;

-- ---------------------------------------------------------------- 2. scheduled publishing

alter table public.articles add column if not exists publish_at timestamptz;

-- The publish-rights trigger, unchanged except that publish_at is guarded
-- the same way as is_published: a writer cannot schedule their own story
-- (the job would publish it for them).
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
  -- control over the publish flag and the schedule.
  if jwt_role = 'service_role' or (select private.is_admin()) then
    return new;
  end if;

  -- Everyone else: new articles are always unscheduled drafts, and updates
  -- cannot change the publish state or the schedule. Forcing (rather than
  -- raising) matches the editors' existing behavior and avoids breaking
  -- writer saves.
  if tg_op = 'INSERT' then
    new.is_published := false;
    new.publish_at := null;
  else
    new.is_published := old.is_published;
    new.publish_at := old.publish_at;
  end if;
  return new;
end;
$function$;

-- Publishes every draft whose time has come. Its date becomes the time it
-- was scheduled for, so it leads the home page like a story published by
-- hand. Returns how many it published.
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
         created_at = publish_at,
         publish_at = null
   where is_published = false
     and publish_at is not null
     and publish_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function private.publish_scheduled_stories() from public, anon, authenticated;

create index if not exists articles_publish_at_idx on public.articles (publish_at) where publish_at is not null;

-- Every five minutes. cron.schedule() replaces a job of the same name, so
-- running this file twice leaves one job.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('publish-scheduled-stories', '*/5 * * * *', $$select private.publish_scheduled_stories()$$);

-- ---------------------------------------------------------------- 3. shelves

alter table public.categories
  add column if not exists description_en text,
  add column if not exists description_ro text,
  add column if not exists sort_order smallint not null default 0;

alter table public.categories drop constraint if exists categories_description_length;
alter table public.categories
  add constraint categories_description_length
  check (char_length(coalesce(description_en, '')) <= 600 and char_length(coalesce(description_ro, '')) <= 600);

-- Alphabetical by English name: the order the site has always used.
update public.categories c
   set sort_order = s.rn
  from (select id, row_number() over (order by name_en) as rn from public.categories) s
 where c.id = s.id
   and c.sort_order = 0;

-- ---------------------------------------------------------------- 4. readers' notes

alter table public.comments add column if not exists hidden_at timestamptz;

-- Read: everyone sees the notes that aren't hidden; a hidden one stays
-- visible to its writer (marked as hidden) and to admins.
drop policy if exists "Anyone can read comments" on public.comments;
drop policy if exists "Visible comments are readable by anyone" on public.comments;
create policy "Visible comments are readable by anyone"
  on public.comments for select to public
  using (hidden_at is null or user_id = (select auth.uid()) or (select private.is_admin()));

-- Change and remove: the writer, as before, and now admins.
drop policy if exists "Users can update own comments" on public.comments;
drop policy if exists "Comments can be updated by owner or admin" on public.comments;
create policy "Comments can be updated by owner or admin"
  on public.comments for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Users can delete own comments" on public.comments;
drop policy if exists "Comments can be deleted by owner or admin" on public.comments;
create policy "Comments can be deleted by owner or admin"
  on public.comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Only admins (and maintenance sessions) set or clear hidden_at; for
-- everyone else it is forced: null on a new note, unchanged on an edit.
create or replace function private.guard_comment_hidden()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  jwt_role text;
begin
  begin
    jwt_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  exception when others then
    jwt_role := null;
  end;
  if jwt_role is null then
    jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
  end if;
  if jwt_role is null or jwt_role = 'service_role' or (select private.is_admin()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.hidden_at := null;
  else
    new.hidden_at := old.hidden_at;
  end if;
  return new;
end;
$function$;

-- Trigger functions fire regardless of EXECUTE grants; nothing should call it.
revoke execute on function private.guard_comment_hidden() from public, anon, authenticated;

drop trigger if exists comments_guard_hidden on public.comments;
create trigger comments_guard_hidden
  before insert or update on public.comments
  for each row execute function private.guard_comment_hidden();

-- The desk hides a note by setting hidden_at through the API. Since
-- 20260702000000 authenticated may UPDATE only (content), so grant this one
-- column more; the trigger above keeps it in admins' hands, as the
-- display-name trigger does for user_display_name.
grant update (hidden_at) on table public.comments to authenticated;

create table if not exists public.comment_flags (
  comment_id text not null references public.comments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_flags_user_id_idx on public.comment_flags (user_id);

alter table public.comment_flags enable row level security;

drop policy if exists "Readers can flag a note once" on public.comment_flags;
create policy "Readers can flag a note once"
  on public.comment_flags for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Flags are visible to their reader and admins" on public.comment_flags;
create policy "Flags are visible to their reader and admins"
  on public.comment_flags for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Flags can be withdrawn or cleared" on public.comment_flags;
create policy "Flags can be withdrawn or cleared"
  on public.comment_flags for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

revoke all on table public.comment_flags from anon, authenticated;
grant select, insert, delete on table public.comment_flags to authenticated;

-- ---------------------------------------------------------------- 5. dispatches

create table if not exists public.newsletter_dispatches (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) <= 20000),
  story_ids text[] not null default '{}',
  recipients integer not null default 0 check (recipients >= 0),
  resend_broadcast_id text,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now()
);
create index if not exists newsletter_dispatches_sent_by_idx on public.newsletter_dispatches (sent_by);

alter table public.newsletter_dispatches enable row level security;

drop policy if exists "Dispatches are visible to admins" on public.newsletter_dispatches;
create policy "Dispatches are visible to admins"
  on public.newsletter_dispatches for select to authenticated
  using ((select private.is_admin()));

-- Read only: rows are written by newsletter-dispatch with the service role.
revoke all on table public.newsletter_dispatches from anon, authenticated;
grant select on table public.newsletter_dispatches to authenticated;

-- ---------------------------------------------------------------- 6. desk_stats()

create or replace function public.desk_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not (select private.is_admin()) then
    raise exception 'desk_stats is for admins' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'readers', (select count(*) from auth.users),
    'readers_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'subscribers', (select count(*) from public.newsletter_subscribers where status = 'confirmed'),
    'subscribers_30d', (select count(*) from public.newsletter_subscribers where status = 'confirmed' and confirmed_at > now() - interval '30 days'),
    'flagged', (
      select count(distinct f.comment_id)
        from public.comment_flags f
        join public.comments c on c.id = f.comment_id
       where c.hidden_at is null
    )
  );
end;
$function$;

revoke all on function public.desk_stats() from public, anon;
grant execute on function public.desk_stats() to authenticated;
