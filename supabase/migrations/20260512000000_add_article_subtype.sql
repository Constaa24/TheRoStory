-- ================================================================
-- Article subtype (text variants: essay / poetry / short story)
-- ================================================================
-- Adds an optional `subtype` column on articles. Only text-type
-- articles read it; other types ignore it.
--
-- NULL is treated as 'essay' by the app, so existing rows keep
-- their current rendering with no backfill.
--
-- A soft CHECK restricts allowed values to avoid typos. Adding a
-- new subtype later only requires loosening the CHECK in a future
-- migration.
-- ================================================================

alter table "public"."articles"
  add column if not exists "subtype" text;

alter table "public"."articles"
  drop constraint if exists "articles_subtype_check";

alter table "public"."articles"
  add constraint "articles_subtype_check"
  check (subtype is null or subtype in ('essay', 'poetry', 'short_story'));

comment on column "public"."articles"."subtype" is
  'Optional rendering variant for text articles. NULL is treated as essay. Allowed: essay, poetry, short_story.';
