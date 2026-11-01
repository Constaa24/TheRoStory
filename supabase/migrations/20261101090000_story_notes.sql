-- ================================================================
-- Story notes: an optional "About this story" per language
-- ================================================================
-- A few lines of context the author writes beside a story — where a poet
-- was when they wrote it, what a legend answers to. The story pages show it
-- in a side card when it exists; nothing changes for a story without one.
--
-- Additive and nullable: no existing query selects these columns, and the
-- editors only send them once the author has written something (or the
-- story was read with the columns present), so the site works the same
-- before and after this runs.
-- ================================================================

alter table public.articles
  add column if not exists note_en text,
  add column if not exists note_ro text;

alter table public.articles
  add constraint articles_note_length
  check (
    (note_en is null or char_length(note_en) <= 800)
    and (note_ro is null or char_length(note_ro) <= 800)
  );

comment on column public.articles.note_en is 'Optional "About this story" note shown beside the story (English). At most 800 characters.';
comment on column public.articles.note_ro is 'Optional "About this story" note shown beside the story (Romanian). At most 800 characters.';
