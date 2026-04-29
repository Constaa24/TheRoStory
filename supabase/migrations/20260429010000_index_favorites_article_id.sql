-- ================================================================
-- Performance: index favorites.article_id for the FK cascade path
-- ================================================================
-- The `favorites` table has a unique constraint on
-- (user_id, article_id), which Postgres uses as a composite index.
-- Composite indexes only support left-prefix lookups, so a query
-- like `WHERE article_id = X` can't use it — Postgres falls back
-- to a sequential scan.
--
-- The most common path that hits this is the FK cascade: when an
-- article is deleted, Postgres scans `favorites` looking for rows
-- to remove. Cheap today (table is small), expensive once
-- favorites grow into the thousands.
--
-- Single-column index on `article_id` covers that lookup and adds
-- negligible write overhead.
-- ================================================================

create index if not exists favorites_article_id_idx
  on public.favorites (article_id);
