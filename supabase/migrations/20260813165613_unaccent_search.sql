-- ================================================================
-- Accent-insensitive article search
-- ================================================================
-- Migration 20260630000000 added trigram GIN indexes so the search
-- box's ILIKE '%term%' stayed index-assisted. What it didn't fix is
-- that on a Romanian-language site the diacritics are the search:
-- "Marasesti" does not match "Mărășești", "Brancusi" misses
-- "Brâncuși", "Stefan" misses "Ștefan". Readers type the unaccented
-- form constantly — phone keyboards, foreign layouts, habit — and got
-- an empty result set for stories that are in the archive.
--
-- The fix is unaccent() on both sides of the comparison: fold the
-- stored text and the search term to their base letters before
-- matching. That has to happen inside the database (PostgREST can't
-- call a function in a filter), so search moves from a .or() filter
-- chain to the search_articles() RPC below.
--
-- Three pieces:
--
--   1. immutable_unaccent(). unaccent() itself is only STABLE — it
--      reads a dictionary that could in principle be redefined — and
--      Postgres refuses to index a non-IMMUTABLE expression. Pinning
--      the dictionary by name makes the wrapper genuinely immutable,
--      which is the standard recipe for this.
--
--   2. The five trigram indexes, rebuilt over immutable_unaccent(col).
--      The plain ones are dropped rather than kept: search is the only
--      ILIKE consumer in the app, so after this migration nothing can
--      use them and they'd cost writes on the content columns for
--      nothing.
--
--   3. search_articles(), returning exactly the card columns the
--      search overlay renders. SECURITY INVOKER, so the articles RLS
--      policy still decides what the caller may see — the
--      is_published filter is the same guard the client sent before,
--      not a replacement for row security.
-- ================================================================

create extension if not exists unaccent with schema extensions;


-- ----------------------------------------------------------------
-- 1. IMMUTABLE unaccent wrapper
-- ----------------------------------------------------------------
-- The regdictionary cast resolves the dictionary once, by name, which
-- is what lets us promise IMMUTABLE. STRICT so a NULL column (location)
-- stays NULL and simply fails the match instead of erroring.

create or replace function public.immutable_unaccent(p_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $function$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_text)
$function$;

comment on function public.immutable_unaccent(text) is
  'IMMUTABLE unaccent() wrapper, indexable. Folds Romanian diacritics (ă â î ș ț) to base letters for accent-insensitive search.';

revoke all on function public.immutable_unaccent(text) from public;
grant execute on function public.immutable_unaccent(text) to anon, authenticated, service_role;


-- ----------------------------------------------------------------
-- 2. Trigram indexes over the folded text
-- ----------------------------------------------------------------
-- The index expression has to match the query expression character for
-- character, which is why search_articles() below calls
-- public.immutable_unaccent(col) and nothing else. Case is handled by
-- ILIKE: pg_trgm lowercases when it extracts trigrams, so gin_trgm_ops
-- serves ILIKE from the same index.

drop index if exists public.articles_title_en_trgm;
drop index if exists public.articles_title_ro_trgm;
drop index if exists public.articles_content_en_trgm;
drop index if exists public.articles_content_ro_trgm;
drop index if exists public.articles_location_trgm;

create index if not exists articles_title_en_unaccent_trgm
  on public.articles using gin (public.immutable_unaccent(title_en) extensions.gin_trgm_ops);

create index if not exists articles_title_ro_unaccent_trgm
  on public.articles using gin (public.immutable_unaccent(title_ro) extensions.gin_trgm_ops);

create index if not exists articles_content_en_unaccent_trgm
  on public.articles using gin (public.immutable_unaccent(content_en) extensions.gin_trgm_ops);

create index if not exists articles_content_ro_unaccent_trgm
  on public.articles using gin (public.immutable_unaccent(content_ro) extensions.gin_trgm_ops);

create index if not exists articles_location_unaccent_trgm
  on public.articles using gin (public.immutable_unaccent(location) extensions.gin_trgm_ops);


-- ----------------------------------------------------------------
-- 3. search_articles RPC
-- ----------------------------------------------------------------
-- Returns the ARTICLE_CARD_COLUMNS set from src/lib/supabase.ts — the
-- overlay renders title, category and thumbnail, so the content columns
-- it searches are never shipped back.
--
-- The 3-character floor is the same one SEARCH_MIN_LENGTH enforces in
-- the client, repeated here because a trigram index can't serve a
-- pattern with fewer than three characters between the wildcards: a
-- 2-character term would seq-scan both full content columns of every
-- article, and the search box fires on a 300ms debounce.
--
-- Ordering is title matches first, then newest — deterministic, and it
-- puts the story someone searched for by name at the top instead of
-- whichever row the scan reached first.

create or replace function public.search_articles(
  p_query text,
  p_limit integer default 6
)
returns table (
  id          text,
  title_en    text,
  title_ro    text,
  type        text,
  subtype     text,
  media_url   text,
  poster_url  text,
  media_urls  text[],
  location    text,
  category_id text,
  user_id     uuid,
  is_published boolean,
  created_at  timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
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

  -- Escape the LIKE metacharacters, backslash first so the next two
  -- replacements don't double-escape it. Without this, a search for '%'
  -- would match every article and '_' would act as a single-character
  -- wildcard.
  v_pattern := '%' || replace(replace(replace(
                 public.immutable_unaccent(v_term),
                 '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select a.id, a.title_en, a.title_ro, a.type, a.subtype,
         a.media_url, a.poster_url, a.media_urls, a.location,
         a.category_id, a.user_id, a.is_published, a.created_at
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
  'Accent-insensitive search over published articles (title/content EN+RO, location). Returns the card column set. SECURITY INVOKER — articles RLS still applies.';

revoke all on function public.search_articles(text, integer) from public;
grant execute on function public.search_articles(text, integer) to anon, authenticated, service_role;
