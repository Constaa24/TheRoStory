-- ================================================================
-- ON DELETE CASCADE on user-owned tables + articles.updated_at
-- ================================================================
-- Two independent fixes from the second-pass audit:
--
--   1. articles.user_id and comments.user_id FKs to auth.users had
--      no ON DELETE clause (defaulted to NO ACTION/RESTRICT). When
--      admin-api deletes a user via auth.admin.deleteUser(), the
--      cascade reached profiles/user_roles/favorites (those FKs
--      already had ON DELETE CASCADE) but BLOCKED on articles or
--      comments owned by that user. Result: admin user-delete and
--      self-service deleteOwnAccount both fail silently for any user
--      who has ever written content.
--
--      Fix: switch both FKs to ON DELETE CASCADE. Removing an account
--      now removes that user's articles (and via existing cascades,
--      their comments and favorites under those articles) — the
--      correct behavior for a GDPR-compliant account deletion.
--
--   2. articles has created_at but no updated_at. The sitemap falls
--      back to created_at for lastmod, the admin dashboard can't
--      show "last edited", and there is no way to detect stale cache
--      entries by timestamp. Add the column with a default of now()
--      and a BEFORE UPDATE trigger that touches it on every row
--      change.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. ON DELETE CASCADE on articles.user_id and comments.user_id
-- ----------------------------------------------------------------

alter table public.articles drop constraint if exists articles_user_id_fkey;
alter table public.articles
  add constraint articles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.comments drop constraint if exists comments_user_id_fkey;
alter table public.comments
  add constraint comments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;


-- ----------------------------------------------------------------
-- 2. articles.updated_at
-- ----------------------------------------------------------------
-- Default of now() so existing rows backfill to the migration time
-- (they have no real edit history to recover). New rows get now() on
-- insert, then the trigger keeps it fresh on every UPDATE.

alter table public.articles
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_articles_updated_at()
  returns trigger
  language plpgsql
  set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_articles_updated_at on public.articles;
create trigger touch_articles_updated_at
  before update on public.articles
  for each row
  execute function public.touch_articles_updated_at();
