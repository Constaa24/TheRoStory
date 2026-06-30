-- ================================================================
-- Trigram indexes for article search
-- ================================================================
-- searchArticles() (src/lib/supabase.ts) runs a leading-wildcard ILIKE
-- ('%term%') across title_en/ro, content_en/ro and location. A leading
-- wildcard can't use a normal b-tree index, so every search was a
-- sequential scan over the articles table. pg_trgm GIN indexes make these
-- ILIKE "contains" lookups index-assisted, which keeps search fast as the
-- archive grows.
--
-- pg_trgm lives in the `extensions` schema on Supabase, so we reference the
-- operator class schema-qualified and don't depend on search_path.
--
-- Trade-off: GIN trigram indexes on the (potentially large) content columns
-- add write/storage cost. The articles table is read-heavy and written rarely
-- by a handful of writers/admins, so this is a clear win.
-- ================================================================

create extension if not exists pg_trgm with schema extensions;

create index if not exists articles_title_en_trgm
  on public.articles using gin (title_en extensions.gin_trgm_ops);

create index if not exists articles_title_ro_trgm
  on public.articles using gin (title_ro extensions.gin_trgm_ops);

create index if not exists articles_content_en_trgm
  on public.articles using gin (content_en extensions.gin_trgm_ops);

create index if not exists articles_content_ro_trgm
  on public.articles using gin (content_ro extensions.gin_trgm_ops);

create index if not exists articles_location_trgm
  on public.articles using gin (location extensions.gin_trgm_ops);
