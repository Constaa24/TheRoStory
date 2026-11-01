/**
 * Builds the Atlas's map geometry from the county shapes and river lines.
 *
 *     node scripts/generate-atlas-geo.mjs
 *
 * WHAT IT EMITS
 *
 *   src/lib/atlas/atlas-geo.json — every shape the /map page draws, already
 *   projected into a 1000 x 700 plate: county outlines, the borders between
 *   them, the national border as one closed ring, rivers, label anchors, and
 *   the projection's constants so the page can place a latitude/longitude
 *   without shipping d3 to the browser.
 *
 *   src/lib/atlas/plate.json — just the projection and county centres, for
 *   the story pages' small "where" map.
 *
 *   public/atlas/romania.svg — the national outline, for that small map.
 *
 * WHY THE BORDERS ARE RECOVERED, NOT MESHED
 *
 * src/lib/counties_topo.js is not a true topology. Every county is its own
 * closed arc and neighbouring counties were digitised separately, about two
 * map units apart. So topojson.mesh(a !== b) finds no shared edges and
 * topojson.merge cannot dissolve a national outline: drawn naively, every
 * county border shows twice and the seams between counties open into dark
 * slivers once the reader zooms in. A patch of the Bucegi plateau (around
 * Babele) also belongs to no county at all.
 *
 * So the borders are rebuilt here, once. Each county vertex is classified by
 * the nearest *other* county within T units: runs of vertices with a
 * neighbour are a shared border (kept once, from the alphabetically first
 * side); runs with none are the national border. Those national runs are
 * then stitched end to end into one ring, which the page fills as the land.
 * The Bucegi patch's own outline is the one run whose ends meet nothing, and
 * is dropped.
 *
 * SOURCES
 *
 *   src/lib/counties_topo.js                   the site's county shapes
 *   scripts/atlas-sources/natural-earth-rivers.json
 *       Natural Earth 10m "rivers + lake centerlines" and "rivers Europe"
 *       (public domain, naturalearthdata.com), cut to a box around Romania
 *       and rounded to 4 decimals. Re-extract from the full downloads only if
 *       Natural Earth publishes a correction worth having.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/lib/atlas/atlas-geo.json');

const topo = (await import(pathToFileURL(path.join(ROOT, 'src/lib/counties_topo.js')).href)).default;
const riversSource = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/atlas-sources/natural-earth-rivers.json'), 'utf8'));

const W = 1000;
const H = 700;
const object = topo.objects['romania.counties'];
const fc = topojson.feature(topo, object);
const outline = topojson.merge(topo, object.geometries);
const projection = d3.geoMercator().fitExtent([[28, 26], [W - 28, H - 26]], outline);
const pathGen = d3.geoPath(projection).digits(1);

// The page re-implements this projection in a few lines (src/lib/atlas/
// projection.ts) rather than loading d3-geo. With no rotation and centre
// [0, 0], d3's Mercator is exactly x = k·λ + tx, y = ty − k·ln tan(π/4 + φ/2).
const k = projection.scale();
const [tx, ty] = projection.translate();
const rad = Math.PI / 180;
for (const p of [[22.28, 44.645], [26.1, 44.43], [29.38, 45.17], [24.79, 46.22], [26.63, 47.815]]) {
  const [x, y] = projection(p);
  const fx = k * p[0] * rad + tx;
  const fy = ty - k * Math.log(Math.tan(Math.PI / 4 + (p[1] * rad) / 2));
  if (Math.abs(fx - x) > 1e-6 || Math.abs(fy - y) > 1e-6) throw new Error(`projection formula drifted at ${p}`);
}

const fixName = (n) => (n === 'SatuMare' ? 'Satu Mare' : n);

// Historical regions, approximated along county lines.
const REGIONS = [
  { id: 'transilvania', en: 'Transylvania', ro: 'Transilvania', counties: ['Alba', 'Bistrița-Năsăud', 'Brașov', 'Cluj', 'Covasna', 'Harghita', 'Hunedoara', 'Mureș', 'Sălaj', 'Sibiu'] },
  { id: 'banat', en: 'Banat', ro: 'Banat', counties: ['Timiș', 'Caraș-Severin'] },
  { id: 'crisana', en: 'Crișana', ro: 'Crișana', counties: ['Arad', 'Bihor', 'Satu Mare'] },
  { id: 'maramures', en: 'Maramureș', ro: 'Maramureș', counties: ['Maramureș'] },
  { id: 'bucovina', en: 'Bukovina', ro: 'Bucovina', counties: ['Suceava'] },
  { id: 'moldova', en: 'Moldavia', ro: 'Moldova', counties: ['Bacău', 'Botoșani', 'Galați', 'Iași', 'Neamț', 'Vaslui', 'Vrancea'] },
  { id: 'muntenia', en: 'Muntenia', ro: 'Muntenia', counties: ['Argeș', 'Brăila', 'București', 'Buzău', 'Călărași', 'Dâmbovița', 'Giurgiu', 'Ialomița', 'Ilfov', 'Prahova', 'Teleorman'] },
  { id: 'oltenia', en: 'Oltenia', ro: 'Oltenia', counties: ['Dolj', 'Gorj', 'Mehedinți', 'Olt', 'Vâlcea'] },
  { id: 'dobrogea', en: 'Dobruja', ro: 'Dobrogea', counties: ['Constanța', 'Tulcea'] },
];
// Hand-placed offsets (map units) that keep region names clear of the
// densest pins and of each other at country scale.
const REGION_NUDGE = { transilvania: [10, -42], crisana: [-6, 0], maramures: [0, -10], bucovina: [-10, -22], moldova: [32, -16], muntenia: [-70, -46], oltenia: [-43, 33], banat: [0, 0], dobrogea: [24, -40] };

const regionOf = new Map(REGIONS.flatMap((r) => r.counties.map((c) => [c, r.id])));
const names = fc.features.map((f) => fixName(f.properties.name));
for (const n of names) if (!regionOf.has(n)) throw new Error(`county ${n} has no region`);
for (const n of regionOf.keys()) if (!names.includes(n)) throw new Error(`region lists unknown county ${n}`);

const r1 = (v) => Math.round(v * 10) / 10;
const counties = fc.features.map((f, i) => {
  const [cx, cy] = pathGen.centroid(f);
  return { name: names[i], d: pathGen(f), cx: r1(cx), cy: r1(cy), region: regionOf.get(names[i]) };
});

const regions = REGIONS.map((r) => {
  const merged = topojson.merge(topo, object.geometries.filter((g) => r.counties.includes(fixName(g.properties.name))));
  const [lx, ly] = pathGen.centroid(merged);
  const [nx, ny] = REGION_NUDGE[r.id] || [0, 0];
  return { id: r.id, en: r.en, ro: r.ro, x: r1(lx + nx), y: r1(ly + ny) };
});

// ---- Borders, recovered (see the header).
const T = 5;
const CELL = 8;
const rings = [];
fc.features.forEach((f, ci) => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) rings.push({ ci, pts: ring.map((p) => projection(p)) });
});
const grid = new Map();
for (const r of rings) {
  for (let i = 0; i < r.pts.length - 1; i++) {
    const [x1, y1] = r.pts[i];
    const [x2, y2] = r.pts[i + 1];
    const xa = Math.floor((Math.min(x1, x2) - T) / CELL), xb = Math.floor((Math.max(x1, x2) + T) / CELL);
    const ya = Math.floor((Math.min(y1, y2) - T) / CELL), yb = Math.floor((Math.max(y1, y2) + T) / CELL);
    for (let gx = xa; gx <= xb; gx++) {
      for (let gy = ya; gy <= yb; gy++) {
        const key = `${gx},${gy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push([r.ci, x1, y1, x2, y2]);
      }
    }
  }
}
const nearestOther = (ci, [x, y]) => {
  let best = T;
  let who = -1;
  for (const [cj, x1, y1, x2, y2] of grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) || []) {
    if (cj === ci) continue;
    const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len));
    const d = Math.hypot(x1 + t * dx - x, y1 + t * dy - y);
    if (d < best) { best = d; who = cj; }
  }
  return who;
};
const fmt = (pts) => 'M' + pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join('L');
const borders = [];
const regionBorderIdx = [];
const outlineRuns = [];
for (const r of rings) {
  const pts = r.pts.slice(0, -1);
  const lab = pts.map((p) => nearestOther(r.ci, p));
  let start = lab.findIndex((l, i) => l !== lab[(i - 1 + lab.length) % lab.length]);
  if (start === -1) start = 0;
  const order = pts.map((_, i) => (start + i) % pts.length);
  let run = [order[0]];
  const flush = () => {
    const l = lab[run[0]];
    const line = run.map((i) => pts[i]);
    if (line.length < 2) return;
    if (l === -1) outlineRuns.push(line);
    else if (names[r.ci] < names[l]) {
      if (regionOf.get(names[r.ci]) !== regionOf.get(names[l])) regionBorderIdx.push(borders.length);
      borders.push(fmt(line));
    }
  };
  for (let n = 1; n <= order.length; n++) {
    const i = order[n % order.length];
    if (n < order.length && lab[i] === lab[run[0]]) { run.push(i); continue; }
    run.push(i); // overlap one vertex so consecutive runs meet
    flush();
    run = [i];
  }
}

// ---- The national ring: stitch the outline runs end to end.
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearAnyEnd = (p, self) => outlineRuns.some((o) => o !== self && (dist(p, o[0]) < 30 || dist(p, o[o.length - 1]) < 30));
const borderRuns = outlineRuns.filter((r) => nearAnyEnd(r[0], r) && nearAnyEnd(r[r.length - 1], r));
const pool = borderRuns.map((r) => r.slice()).sort((a, b) => b.length - a.length);
const nationPts = pool.shift();
let widestBridge = 0;
while (pool.length) {
  const head = nationPts[0];
  const tail = nationPts[nationPts.length - 1];
  let best = -1, bestD = Infinity, mode = '';
  pool.forEach((r, i) => {
    const a = r[0], b = r[r.length - 1];
    for (const [d, m] of [[dist(tail, a), 'tail'], [dist(tail, b), 'tail-rev'], [dist(head, b), 'head'], [dist(head, a), 'head-rev']]) {
      if (d < bestD) { bestD = d; best = i; mode = m; }
    }
  });
  widestBridge = Math.max(widestBridge, bestD);
  const r = pool.splice(best, 1)[0];
  if (mode === 'tail') nationPts.push(...r);
  else if (mode === 'tail-rev') nationPts.push(...r.reverse());
  else if (mode === 'head') nationPts.unshift(...r);
  else nationPts.unshift(...r.reverse());
}
widestBridge = Math.max(widestBridge, dist(nationPts[nationPts.length - 1], nationPts[0]));
// A wide bridge means two runs that do not belong together were joined, and
// the land fill would cut a visible chord across the country.
if (widestBridge > 25) throw new Error(`national ring has a ${widestBridge.toFixed(1)}-unit gap; check the run filter`);
const nation = fmt(nationPts) + 'Z';

// ---- Rivers: keep points inside Romania or within ~4 units of its border
// (the Danube runs along it), split into runs, project.
const segments = [];
for (const poly of outline.coordinates) {
  for (const ring of poly) {
    const pts = ring.map((p) => projection(p));
    for (let i = 0; i < pts.length - 1; i++) segments.push([pts[i], pts[i + 1]]);
  }
}
const distToBorder = ([x, y]) => {
  let best = Infinity;
  for (const [[x1, y1], [x2, y2]] of segments) {
    const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len));
    const ex = x1 + t * dx - x, ey = y1 + t * dy - y;
    best = Math.min(best, ex * ex + ey * ey);
  }
  return Math.sqrt(best);
};
const BOX = [20.0, 43.5, 30.0, 48.4];
const inBox = ([x, y]) => x >= BOX[0] && x <= BOX[2] && y >= BOX[1] && y <= BOX[3];
const keepPoint = (p) => inBox(p) && (d3.geoContains(outline, p) || distToBorder(projection(p)) < 4);
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const pieces = [];
for (const f of riversSource.features) {
  const name = f.properties.name_en || f.properties.name || '';
  for (const line of f.geometry.coordinates) {
    let run = [];
    const flush = () => {
      if (run.length >= 3) pieces.push({ name, source: f.properties.source, pts: run.map((p) => projection(p)) });
      run = [];
    };
    for (const p of line) { if (keepPoint(p)) run.push(p); else flush(); }
    flush();
  }
}
// One copy per river: the two Natural Earth layers overlap, so prefer the
// main layer's line, and drop Bulgarian tributaries that only touch the
// border.
const mainNames = new Set(pieces.filter((r) => r.source === 'rivers_lake_centerlines' && r.name).map((r) => norm(r.name)));
const rivers = pieces.filter((r) => {
  if (['iskar', 'ogosta'].includes(norm(r.name))) return false;
  if (r.source === 'rivers_europe' && (!r.name || mainNames.has(norm(r.name)))) return false;
  return true;
});
// Label anchors: the middle vertex of each named river's longest piece,
// nudged off the line.
const RIVER_LABELS = {
  danube: { en: 'Danube', ro: 'Dunărea', nudge: [-40, 26] },
  olt: { en: 'Olt', ro: 'Olt', nudge: [12, 6] },
  mures: { en: 'Mureș', ro: 'Mureș', nudge: [0, -10] },
  siret: { en: 'Siret', ro: 'Siret', nudge: [12, 6] },
  prut: { en: 'Prut', ro: 'Prut', nudge: [10, 0] },
  jiu: { en: 'Jiu', ro: 'Jiu', nudge: [-14, 0] },
};
const riverLabels = Object.entries(RIVER_LABELS).map(([key, label]) => {
  const named = rivers.filter((r) => norm(r.name) === key);
  if (!named.length) throw new Error(`no river line for label ${key}`);
  const longest = named.reduce((a, b) => (b.pts.length > a.pts.length ? b : a));
  const [x, y] = longest.pts[Math.floor(longest.pts.length / 2)];
  return { key, en: label.en, ro: label.ro, x: r1(x + label.nudge[0]), y: r1(y + label.nudge[1]) };
});

// Cartographic labels and the scale bar.
const carpathians = [[22.7, 45.12], [23.6, 45.2], [24.5, 45.3], [25.3, 45.3]].map((p) => projection(p).map(r1));
const blackSea = projection([29.45, 44.05]).map(r1);
// Map units per 100 km along 45.5°N, where 1° of longitude is ~78.03 km.
const km100 = Math.round((projection([26.2816, 45.5])[0] - projection([25, 45.5])[0]) * 1000) / 1000;

const data = {
  w: W,
  h: H,
  projection: { k, tx, ty },
  nation,
  borders,
  regionBorderIdx,
  counties,
  regions,
  rivers: rivers.map((r) => fmt(r.pts)),
  riverLabels,
  carpathians,
  blackSea,
  km100,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data) + '\n');

// The story pages place a pin on a small outline of Romania. They need the
// projection and the county centres, not 330 KB of county shapes, so those
// go into their own tiny file, and the outline into a static SVG the page
// uses as a CSS mask (which is what lets it take either theme's gold).
const plate = {
  w: W,
  h: H,
  k,
  tx,
  ty,
  counties: Object.fromEntries(counties.map((c) => [c.name, [c.cx, c.cy]])),
};
fs.writeFileSync(path.join(path.dirname(OUT), 'plate.json'), JSON.stringify(plate) + '\n');
const outlineSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  `<path d="${nation}" fill="#000" fill-opacity="0.14" stroke="#000" stroke-width="3" stroke-linejoin="round"/></svg>\n`;
fs.mkdirSync(path.join(ROOT, 'public/atlas'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public/atlas/romania.svg'), outlineSvg);
console.log(
  `atlas-geo.json: ${counties.length} counties, ${borders.length} shared borders ` +
  `(${regionBorderIdx.length} between regions), ${borderRuns.length} national runs ` +
  `(widest join ${widestBridge.toFixed(1)}), ${rivers.length} river lines, ` +
  `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`
);
