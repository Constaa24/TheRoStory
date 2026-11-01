/**
 * One line per category, written for it.
 *
 * The Categories page used to give all eight the same template sentence —
 * "Stories filed under X — long reads, photo essays, and films" — which told
 * a reader nothing about where each route through the archive leads.
 *
 * Keyed by slug, like CATEGORY_IMAGES below. A category
 * added from the dashboard has no entry until someone writes one, and falls
 * back to a neutral line rather than to nothing.
 */
const CATEGORY_DESCRIPTIONS: Record<string, { en: string; ro: string }> = {
  history: {
    en: 'The turning points — unions, revolutions and the days a country changed its mind.',
    ro: 'Momentele de cotitură — uniri, revoluții și zilele în care o țară s-a răzgândit.',
  },
  science: {
    en: 'Discoveries, and the Romanian minds behind them — from the laboratory to inventions the world still uses.',
    ro: 'Descoperiri și mințile românești din spatele lor — din laborator până la invenții pe care lumea încă le folosește.',
  },
  landmarks: {
    en: 'Castles, cathedrals, palaces and monuments — the places that keep the country’s memory in stone.',
    ro: 'Castele, catedrale, palate și monumente — locurile care păstrează în piatră memoria țării.',
  },
  'historical-figures': {
    en: 'Rulers, inventors, artists and pioneers — the people behind the names on Romanian streets.',
    ro: 'Domnitori, inventatori, artiști și pionieri — oamenii din spatele numelor de pe străzile României.',
  },
  traditions: {
    en: 'Customs still kept — the threads, songs and seasons that mark a Romanian year.',
    ro: 'Obiceiuri încă păstrate — firele, cântecele și anotimpurile care marchează anul românesc.',
  },
  myths: {
    en: 'Legends of the Carpathians — spirits of the forest, riders of the storm and the tales still told at the start of spring.',
    ro: 'Legendele Carpaților — duhuri ale pădurii, călăreți ai furtunii și poveștile spuse încă la început de primăvară.',
  },
  nature: {
    en: 'Mountains, forests and the Danube Delta — the wild Romania few visitors ever see.',
    ro: 'Munți, păduri și Delta Dunării — România sălbatică pe care puțini vizitatori o văd.',
  },
  art: {
    en: 'Poets, painters and the works that gave Romanian culture its voice.',
    ro: 'Poeți, pictori și operele care au dat glas culturii românești.',
  },
};

export const categoryDescription = (
  slug: string | undefined,
  name: string,
  language: 'en' | 'ro'
): string => {
  const entry = slug ? CATEGORY_DESCRIPTIONS[slug] : undefined;
  if (entry) return entry[language];
  return language === 'en'
    ? `Stories filed under ${name.toLowerCase()} — essays, visual essays and films.`
    : `Povești din categoria ${name.toLowerCase()} — eseuri, eseuri vizuale și filme.`;
};

// Extension-less base paths — each has a .avif, .webp and .jpg sibling, served
// through <picture> below. They shipped as ~800 KB files named .png that were
// actually JPEGs inside; the same AVIF/WebP treatment the hero images already
// get takes the eight of them from 6.3 MB to about 450 KB.
const CATEGORY_IMAGES: Record<string, string> = {
  "history": "/categories/cat_history_new",
  "science": "/categories/cat_science_new",
  "landmarks": "/categories/cat_landmarks_new",
  "historical-figures": "/categories/cat_historical_figures_new",
  "traditions": "/categories/cat_2",
  "myths": "/categories/cat_1",
  "nature": "/categories/cat_nature_new",
  "art": "/categories/cat_art_new"
};

const FALLBACK_IMAGES = Object.values(CATEGORY_IMAGES);

/**
 * Stable image for a category without its own mapping.
 *
 * Keyed on the slug rather than the list index: categories are ordered by
 * name, so an index-based pick reshuffled the artwork of every unmapped
 * category whenever one was added or renamed. It also drew from only
 * cat_1/cat_2 — the artwork already assigned to "myths" and "traditions" —
 * so a new category was guaranteed to look like a duplicate of an existing
 * one. Hashing across the full set makes collisions possible but no longer
 * certain, and keeps each category's image fixed over time.
 */
export const getCategoryImage = (slug: string) => {
  const mapped = CATEGORY_IMAGES[slug];
  if (mapped) return mapped;
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = ((h << 5) - h) + slug.charCodeAt(i);
  return FALLBACK_IMAGES[Math.abs(h) % FALLBACK_IMAGES.length];
};
