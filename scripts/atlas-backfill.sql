-- ================================================================
-- Atlas backfill: places, dates and journeys for the 25 stories
-- published before the Atlas existed.
-- ================================================================
-- Content, not schema, so this is not a migration: run it once in the
-- Supabase SQL editor AFTER migration 20261031120000 has been applied.
-- It is safe to run again; every statement overwrites rather than adds.
--
-- The values are the ones shown in the Atlas prototype. A few are
-- judgement calls worth a second look:
--   * The Florist's Daughter: Cărămidarii de Jos is approximate.
--   * The Ielele and Riders of the Storm have no single spot, so they
--     keep only their county (a dashed ring on the map).
--   * Baba Dochia's pin is Babele, on the Bucegi plateau.
--   * Salina Turda spans 1867–1932, labelled "Austro-Hungarian era – 1932".
-- Edit any value here, or later from the story's editor.
--
-- The updated_at trigger is paused for the duration: this is a metadata
-- backfill, and letting it run would stamp all 25 stories as modified
-- today in the sitemap's <lastmod> and every article:modified_time.
-- ================================================================

begin;

alter table public.articles disable trigger touch_articles_updated_at;

update public.articles set
  lat = 44.645, lng = 22.28,
  place_name_en = 'Decebalus Rex, Iron Gates', place_name_ro = 'Chipul lui Decebal, Porțile de Fier',
  year_start = 1994, year_end = 2004,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_1772044889772';

update public.articles set
  lat = 44.4239, lng = 26.0996,
  place_name_en = 'Metropolitan Hill, Bucharest', place_name_ro = 'Dealul Mitropoliei, București',
  year_start = 1859, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_car_1772045747085';

update public.articles set
  lat = 45.6409, lng = 25.5878,
  place_name_en = 'Black Church, Brașov', place_name_ro = 'Biserica Neagră, Brașov',
  year_start = 1383, year_end = 1689,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_1772053792891';

update public.articles set
  lat = 44.6211, lng = 23.9467,
  place_name_en = 'Bălcești, Vâlcea', place_name_ro = 'Bălcești, Vâlcea',
  year_start = 1827, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_car_1772204282927';

update public.articles set
  lat = null, lng = null,
  place_name_en = 'Told across the country', place_name_ro = 'Spusă în toată țara',
  year_start = null, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = true
where id = 'art_car_1772400917120';

update public.articles set
  lat = 44.4275, lng = 26.0875,
  place_name_en = 'Palace of the Parliament, Bucharest', place_name_ro = 'Palatul Parlamentului, București',
  year_start = 1977, year_end = 1989,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_1772406978838';

update public.articles set
  lat = 44.179, lng = 28.645,
  place_name_en = 'Constanța Casino', place_name_ro = 'Cazinoul din Constanța',
  year_start = 1910, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_1773529789630';

update public.articles set
  lat = 46.2197, lng = 24.7932,
  place_name_en = 'Sighișoara citadel', place_name_ro = 'Cetatea Sighișoara',
  year_start = 1431, year_end = 1476,
  era_label_en = '15th century', era_label_ro = 'secolul al XV-lea',
  timeless = false
where id = 'art_vid_1773694065793';

update public.articles set
  lat = 45.3599, lng = 25.5426,
  place_name_en = 'Peleș Castle, Sinaia', place_name_ro = 'Castelul Peleș, Sinaia',
  year_start = 1873, year_end = 1914,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_1774038221823';

update public.articles set
  lat = 44.4352, lng = 26.0715,
  place_name_en = 'Victor Babeș Institute, Bucharest', place_name_ro = 'Institutul Victor Babeș, București',
  year_start = 1887, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_car_1774131800331';

update public.articles set
  lat = 45.4, lng = 25.455,
  place_name_en = 'Babele, Bucegi Mountains', place_name_ro = 'Babele, Munții Bucegi',
  year_start = null, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = true
where id = 'art_vid_1774215760524';

update public.articles set
  lat = 47.5175, lng = 25.8642,
  place_name_en = 'Voroneț Monastery', place_name_ro = 'Mănăstirea Voroneț',
  year_start = 1488, year_end = 1547,
  era_label_en = '15th–16th century', era_label_ro = 'secolele XV–XVI',
  timeless = false
where id = 'art_1775335996267';

update public.articles set
  lat = 45.1667, lng = 29.3833,
  place_name_en = 'Danube Delta', place_name_ro = 'Delta Dunării',
  year_start = null, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = true
where id = 'art_1775343839493';

update public.articles set
  lat = 46.5878, lng = 23.7869,
  place_name_en = 'Salina Turda', place_name_ro = 'Salina Turda',
  year_start = 1867, year_end = 1932,
  era_label_en = 'Austro-Hungarian era – 1932', era_label_ro = 'epoca austro-ungară – 1932',
  timeless = false
where id = 'art_1777146059901';

update public.articles set
  lat = 47.815, lng = 26.63,
  place_name_en = 'Ipotești, Botoșani', place_name_ro = 'Ipotești, Botoșani',
  year_start = 1880, year_end = 1889,
  era_label_en = '1880s', era_label_ro = 'anii 1880',
  timeless = false
where id = 'art_01e969b4-349c-4c5e-8b5b-ea833848348d';

update public.articles set
  lat = null, lng = null,
  place_name_en = 'Somewhere in Dâmbovița', place_name_ro = 'Undeva în Dâmbovița',
  year_start = null, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = true
where id = 'art_9c951a28-1730-484c-b4f3-2ab3034ddd5f';

update public.articles set
  lat = 47.1574, lng = 27.5869,
  place_name_en = 'Palace of Culture, Iași', place_name_ro = 'Palatul Culturii, Iași',
  year_start = 1906, year_end = 1925,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_e58559d1-dae0-48f0-a71f-ef8b9de6034b';

update public.articles set
  lat = 46.567, lng = 26.9146,
  place_name_en = 'Bacău', place_name_ro = 'Bacău',
  year_start = 1916, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_26090cfc-d7f8-47e1-b23f-2964d9d55a81';

update public.articles set
  lat = 47.7486, lng = 26.3681,
  place_name_en = 'Hănțești, Suceava', place_name_ro = 'Hănțești, Suceava',
  year_start = 1931, year_end = 1932,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_d733711e-c93e-436b-afaf-a2d7c29f6193';

update public.articles set
  lat = 46.2189, lng = 24.7924,
  place_name_en = 'Clock Tower, Sighișoara', place_name_ro = 'Turnul cu Ceas, Sighișoara',
  year_start = 1350, year_end = 1676,
  era_label_en = '14th century – 1676', era_label_ro = 'secolul al XIV-lea – 1676',
  timeless = false
where id = 'art_f46f559e-e174-42db-b9a6-7cf637d000db';

update public.articles set
  lat = 44.4671, lng = 26.0782,
  place_name_en = 'Arcul de Triumf, Bucharest', place_name_ro = 'Arcul de Triumf, București',
  year_start = 1878, year_end = 1936,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_ee60d4bc-146f-4773-b891-91bdf287f9cb';

update public.articles set
  lat = 45.2678, lng = 25.0464,
  place_name_en = 'Câmpulung, Argeș', place_name_ro = 'Câmpulung, Argeș',
  year_start = 1924, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = false
where id = 'art_84395f52-a1dd-4744-b803-88fae159d7dd';

update public.articles set
  lat = 44.398, lng = 26.115,
  place_name_en = 'Cărămidarii de Jos, Bucharest', place_name_ro = 'Cărămidarii de Jos, București',
  year_start = 1934, year_end = 1939,
  era_label_en = '1930s', era_label_ro = 'anii 1930',
  timeless = false
where id = 'art_4cc36153-3c9e-46a8-8aeb-2a146c7fd7aa';

update public.articles set
  lat = null, lng = null,
  place_name_en = 'Somewhere in Sibiu’s mountains', place_name_ro = 'Undeva în munții Sibiului',
  year_start = null, year_end = null,
  era_label_en = null, era_label_ro = null,
  timeless = true
where id = 'art_c2d6a6bf-9009-4829-a34d-18c906cf55d9';

update public.articles set
  lat = 44.4355, lng = 26.1018,
  place_name_en = 'University Square, Bucharest', place_name_ro = 'Piața Universității, București',
  year_start = 1989, year_end = null,
  era_label_en = '21–22 December 1989', era_label_ro = '21–22 decembrie 1989',
  timeless = false
where id = 'art_5c75bd88-1fb6-4a3b-bf09-f6b70e2b2ed3';

alter table public.articles enable trigger touch_articles_updated_at;

-- Journeys, in the order the Atlas lists them.
insert into public.journeys (id, title_en, title_ro, intro_en, intro_ro, sort_order, is_published)
values ('romanian-pioneers', 'Romanian pioneers', 'Pionieri români',
  'A fountain pen, a war on microbes and a record parachute jump: three Romanians who got somewhere first.',
  'Un stilou, un război cu microbii și un salt record cu parașuta: trei români care au ajuns primii undeva.',
  1, true)
on conflict (id) do update set
  title_en = excluded.title_en, title_ro = excluded.title_ro,
  intro_en = excluded.intro_en, intro_ro = excluded.intro_ro,
  sort_order = excluded.sort_order, is_published = excluded.is_published;
delete from public.journey_stops where journey_id = 'romanian-pioneers';
insert into public.journey_stops (journey_id, article_id, position) values
  ('romanian-pioneers', 'art_car_1772204282927', 1),
  ('romanian-pioneers', 'art_car_1774131800331', 2),
  ('romanian-pioneers', 'art_d733711e-c93e-436b-afaf-a2d7c29f6193', 3);

insert into public.journeys (id, title_en, title_ro, intro_en, intro_ro, sort_order, is_published)
values ('three-poets', 'Three poets', 'Trei poeți',
  'Eminescu’s longing, Bacovia’s leaden rain and Barbu’s riddles: Romanian verse in three voices.',
  'Dorul lui Eminescu, ploaia de plumb a lui Bacovia și enigmele lui Barbu: poezia românească în trei voci.',
  2, true)
on conflict (id) do update set
  title_en = excluded.title_en, title_ro = excluded.title_ro,
  intro_en = excluded.intro_en, intro_ro = excluded.intro_ro,
  sort_order = excluded.sort_order, is_published = excluded.is_published;
delete from public.journey_stops where journey_id = 'three-poets';
insert into public.journey_stops (journey_id, article_id, position) values
  ('three-poets', 'art_01e969b4-349c-4c5e-8b5b-ea833848348d', 1),
  ('three-poets', 'art_26090cfc-d7f8-47e1-b23f-2964d9d55a81', 2),
  ('three-poets', 'art_84395f52-a1dd-4744-b803-88fae159d7dd', 3);

insert into public.journeys (id, title_en, title_ro, intro_en, intro_ro, sort_order, is_published)
values ('myths-of-the-carpathians', 'Myths of the Carpathians', 'Miturile Carpaților',
  'An old woman turned to stone, spirits of the clearings, riders who command the storm, and the thread that brings back spring.',
  'O bătrână prefăcută în piatră, duhuri ale poienilor, călăreți care poruncesc furtunii și firul care aduce primăvara.',
  3, true)
on conflict (id) do update set
  title_en = excluded.title_en, title_ro = excluded.title_ro,
  intro_en = excluded.intro_en, intro_ro = excluded.intro_ro,
  sort_order = excluded.sort_order, is_published = excluded.is_published;
delete from public.journey_stops where journey_id = 'myths-of-the-carpathians';
insert into public.journey_stops (journey_id, article_id, position) values
  ('myths-of-the-carpathians', 'art_vid_1774215760524', 1),
  ('myths-of-the-carpathians', 'art_9c951a28-1730-484c-b4f3-2ab3034ddd5f', 2),
  ('myths-of-the-carpathians', 'art_c2d6a6bf-9009-4829-a34d-18c906cf55d9', 3),
  ('myths-of-the-carpathians', 'art_car_1772400917120', 4);

insert into public.journeys (id, title_en, title_ro, intro_en, intro_ro, sort_order, is_published)
values ('power-and-stone', 'Power and stone, 1977–1989', 'Putere și piatră, 1977–1989',
  'A palace raised on a demolished neighborhood, a square that stopped being afraid, and an arch that got its medallions back.',
  'Un palat ridicat pe un cartier demolat, o piață care a încetat să se teamă și un arc care și-a recăpătat medalioanele.',
  4, true)
on conflict (id) do update set
  title_en = excluded.title_en, title_ro = excluded.title_ro,
  intro_en = excluded.intro_en, intro_ro = excluded.intro_ro,
  sort_order = excluded.sort_order, is_published = excluded.is_published;
delete from public.journey_stops where journey_id = 'power-and-stone';
insert into public.journey_stops (journey_id, article_id, position) values
  ('power-and-stone', 'art_1772406978838', 1),
  ('power-and-stone', 'art_5c75bd88-1fb6-4a3b-bf09-f6b70e2b2ed3', 2),
  ('power-and-stone', 'art_ee60d4bc-146f-4773-b891-91bdf287f9cb', 3);

commit;
