/**
 * One line per category, written for it.
 *
 * The Categories page used to give all eight the same template sentence —
 * "Stories filed under X — long reads, photo essays, and films" — which told
 * a reader nothing about where each route through the archive leads.
 *
 * Keyed by slug, like CATEGORY_IMAGES in pages/Categories.tsx. A category
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
