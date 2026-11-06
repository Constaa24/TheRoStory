import plate from './plate.json';

/**
 * The Atlas plate's projection: d3's Mercator fitted to Romania by
 * scripts/generate-atlas-geo.mjs, which also checks that this closed form
 * matches d3 to within a millionth of a unit. Keeping the two formulas here
 * spares the map, the editors' pin picker and the story pages a d3-geo
 * download. The constants come from plate.json (a few hundred bytes) rather
 * than atlas-geo.json, so a story page can place a pin without loading the
 * map's geometry.
 */
const { k, tx, ty } = plate;
const RAD = Math.PI / 180;

export const PLATE_W = plate.w;
export const PLATE_H = plate.h;

/** Longitude/latitude (degrees) to plate units. */
export const project = (lng: number, lat: number): [number, number] => [
  k * lng * RAD + tx,
  ty - k * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)),
];

/** Plate units back to longitude/latitude (degrees). */
export const invert = (x: number, y: number): [number, number] => [
  (x - tx) / k / RAD,
  (2 * Math.atan(Math.exp((ty - y) / k)) - Math.PI / 2) / RAD,
];

/** A county's centre in plate units, for stories pinned to the county only. */
export const countyCentre = (name: string): [number, number] | null =>
  (plate.counties as Record<string, number[]>)[name] as [number, number] | undefined ?? null;

/** The 42 counties (Bucharest included), by name, from the plate's own list. */
export const COUNTY_NAMES: string[] = Object.keys(plate.counties as Record<string, unknown>);
