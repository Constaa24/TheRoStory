import React, { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import geo from '@/lib/atlas/atlas-geo.json';
import { invert, PLATE_H as H, PLATE_W as W } from '@/lib/atlas/projection';
import { COUNTY_GEO, countyBBox, kindName, pick, whenOf, type AtlasStory, type Lang } from '@/lib/atlas/model';
import { countLabel } from '@/lib/article-utils';
import { fill, type AtlasCopy } from './copy';
import { usePopover } from './hooks';
import { STAR_PATH } from './glyphs';

/**
 * Past about 14x the county data's ~2-unit seams would show, so zoom stops
 * there; stories still too close to tell apart at that scale fan out
 * instead (see the spider in `layout` below).
 */
const MAX_K = 14;
/**
 * How far choosing a story zooms in. Closer than this and the reader loses
 * the country around it; neighbours still too near merge into a numbered
 * cluster beside the chosen pin, which never merges.
 */
const FOCUS_K = 2.6;

export type AtlasLayers = { rivers: boolean; regions: boolean; unwritten: boolean };

export type AtlasMapHandle = {
  flyTo: (x: number, y: number, k: number) => void;
  fitPoints: (pts: [number, number][], maxK?: number, padPx?: number) => void;
  /** Fly to a story, close enough that its nearest visible neighbour sits apart. */
  focusStory: (s: AtlasStory) => void;
  fitCounty: (name: string) => void;
  reset: () => void;
  focus: () => void;
};

type Props = {
  ref?: React.Ref<AtlasMapHandle>;
  stories: readonly AtlasStory[];
  /** Ids that pass the filters (and the play cursor). */
  shown: ReadonlySet<string>;
  /** The active journey's stops in order, or null. */
  stops: readonly string[] | null;
  journeyKey: string | null;
  selected: string | null;
  selectedCounty: string | null;
  hover: string | null;
  onHover: (id: string | null) => void;
  onSelectStory: (id: string) => void;
  onSelectCounty: (name: string) => void;
  countiesWithStories: ReadonlySet<string>;
  layers: AtlasLayers;
  onLayer: (layer: keyof AtlasLayers) => void;
  copy: AtlasCopy;
  lang: Lang;
  playing: boolean;
  readout: { year: string; caption: string } | null;
  reduceMotion: boolean;
  hidden: boolean;
};

type View = { k: number; tx: number; ty: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const clampView = (v: View): View => {
  const k = clamp(v.k, 1, MAX_K);
  return { k, tx: clamp(v.tx, W - W * k, 0), ty: clamp(v.ty, H - H * k, 0) };
};

// Geometry that never changes, joined once.
const BORDERS_D = geo.borders.join('');
const REGION_BORDERS_D = geo.regionBorderIdx.map((i) => geo.borders[i]).join('');
const countyD = new Map(COUNTY_GEO.map((c) => [c.name, c.d]));

type StaticProps = { tintD: string; hatchD: string; showHatch: boolean; showRegions: boolean; showRivers: boolean; written: ReadonlySet<string> };

/**
 * Everything under the pins. It depends on nothing that changes while the
 * reader pans, so it renders once per filter change, not once per frame.
 */
const StaticLayers = memo(({ tintD, hatchD, showHatch, showRegions, showRivers, written }: StaticProps) => (
  <>
    <g className="at-l-under"><path d={geo.nation} /></g>
    <g className="at-l-tint"><path d={tintD} /></g>
    {showHatch && <g className="at-l-hatch"><path d={hatchD} /></g>}
    {/* Transparent county shapes over the shading: the click targets. */}
    <g className="at-l-land">
      {COUNTY_GEO.map((c) => (
        <path key={c.name} d={c.d} data-county={c.name} className={written.has(c.name) ? 'at-has' : 'at-unw'} />
      ))}
    </g>
    <g className="at-l-lines"><path d={BORDERS_D} /></g>
    {showRegions && <g className="at-l-regions"><path d={REGION_BORDERS_D} /></g>}
    <g className="at-l-outline"><path d={geo.nation} /></g>
    {showRivers && (
      <g className="at-l-rivers">
        {geo.rivers.map((d, i) => <path key={i} d={d} />)}
      </g>
    )}
  </>
));
StaticLayers.displayName = 'StaticLayers';

const LAYERS: [keyof AtlasLayers, 'layerRivers' | 'layerRegions' | 'layerUnwritten'][] = [
  ['rivers', 'layerRivers'],
  ['regions', 'layerRegions'],
  ['unwritten', 'layerUnwritten'],
];

type Placed = AtlasStory & { sx: number; sy: number; dim: boolean };
type Cluster = { key: string; x: number; y: number; m: Placed[] };

const AtlasMap: React.FC<Props> = ({
  ref, stories, shown, stops, journeyKey, selected, selectedCounty, hover, onHover, onSelectStory, onSelectCounty,
  countiesWithStories, layers, onLayer, copy, lang, playing, readout, reduceMotion, hidden,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef(new Map<string, SVGGElement>());
  const [view, setViewState] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const setView = useCallback((v: View) => { viewRef.current = v; setViewState(v); }, []);
  // Plate units per CSS pixel: what keeps pins and labels the same size on
  // screen at every zoom.
  const [us, setUs] = useState(1);
  const usRef = useRef(us);
  const [spider, setSpider] = useState<string | null>(null);
  const [wheelHint, setWheelHint] = useState(false);
  const flight = useRef<number | null>(null);
  const key = usePopover();
  const layerPop = usePopover();

  // Latest props for the imperative handle and gesture handlers.
  const live = useRef({ stories, shown, reduceMotion });
  live.current = { stories, shown, reduceMotion };

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const w = svg.getBoundingClientRect().width;
      if (w > 0) { usRef.current = W / w; setUs(W / w); }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => { if (flight.current) cancelAnimationFrame(flight.current); }, []);

  // ---------------------------------------------------------------- camera
  const flyTo = useCallback((cx: number, cy: number, nk: number) => {
    const end = clampView({ k: clamp(nk, 1, MAX_K), tx: W / 2 - cx * nk, ty: H / 2 - cy * nk });
    if (flight.current) cancelAnimationFrame(flight.current);
    if (live.current.reduceMotion) { setView(end); return; }
    const start = viewRef.current;
    const c0 = [(W / 2 - start.tx) / start.k, (H / 2 - start.ty) / start.k];
    const c1 = [(W / 2 - end.tx) / end.k, (H / 2 - end.ty) / end.k];
    const t0 = performance.now();
    const D = 650;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      const e = ease(t);
      const k = start.k * Math.pow(end.k / start.k, e);
      const x = c0[0] + (c1[0] - c0[0]) * e;
      const y = c0[1] + (c1[1] - c0[1]) * e;
      setView(clampView({ k, tx: W / 2 - x * k, ty: H / 2 - y * k }));
      flight.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    flight.current = requestAnimationFrame(step);
  }, [setView]);

  const fitPoints = useCallback((pts: [number, number][], maxK = MAX_K, padPx = 70) => {
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = padPx * usRef.current;
    const k = Math.min((W - 2 * pad) / Math.max(x1 - x0, 0.5), (H - 2 * pad) / Math.max(y1 - y0, 0.5));
    flyTo((x0 + x1) / 2, (y0 + y1) / 2, clamp(k, 1, maxK));
  }, [flyTo]);

  const zoomToSeparate = useCallback((s: AtlasStory) => {
    let min = Infinity;
    for (const o of live.current.stories) {
      if (o === s || o.x == null || !live.current.shown.has(o.id)) continue;
      min = Math.min(min, Math.hypot(o.x - s.x!, o.y! - s.y!));
    }
    const need = min === Infinity ? 3 : (28 * usRef.current) / min;
    return clamp(Math.max(viewRef.current.k, Math.min(Math.max(3, need), FOCUS_K)), 1, MAX_K);
  }, []);

  const zoomAt = useCallback((px: number, py: number, f: number) => {
    const v = viewRef.current;
    const k = clamp(v.k * f, 1, MAX_K);
    setView(clampView({ k, tx: px - ((px - v.tx) * k) / v.k, ty: py - ((py - v.ty) * k) / v.k }));
  }, [setView]);

  useImperativeHandle(ref, () => ({
    flyTo,
    fitPoints,
    focusStory: (s) => { if (s.x != null) flyTo(s.x, s.y!, zoomToSeparate(s)); },
    fitCounty: (name) => {
      const b = countyBBox(name);
      if (b) fitPoints([[b[0], b[1]], [b[2], b[3]]], 6, 60);
    },
    reset: () => { setSpider(null); flyTo(W / 2, H / 2, 1); },
    focus: () => frameRef.current?.focus({ preventScroll: true }),
  }), [flyTo, fitPoints, zoomToSeparate]);

  const toScreen = (x: number, y: number): [number, number] => [x * view.k + view.tx, y * view.k + view.ty];

  // ---------------------------------------------------------------- pins
  const layout = useMemo(() => {
    const stopSet = stops ? new Set(stops) : null;
    const visible: Placed[] = [];
    for (const s of stories) {
      if (s.x == null) continue;
      const isStop = !!stopSet?.has(s.id);
      if (!isStop && !shown.has(s.id)) continue;
      visible.push({ ...s, sx: s.x * view.k + view.tx, sy: s.y! * view.k + view.ty, dim: !!stopSet && !isStop });
    }
    // Pins that would overlap on screen merge into a numbered cluster —
    // never the selected story or a journey stop, so whatever the reader is
    // following stays in view (unless it belongs to a fanned-out group).
    const spiderSet = spider ? new Set(spider.split('|')) : null;
    const R = 22 * us;
    const groups: { x: number; y: number; m: Placed[] }[] = [];
    const single: Placed[] = [];
    for (const s of visible) {
      const alone = s.dim || !!stopSet?.has(s.id) || (s.id === selected && !spiderSet?.has(s.id));
      if (alone) { single.push(s); continue; }
      const g = groups.find((c) => Math.hypot(c.x - s.sx, c.y - s.sy) < R);
      if (g) {
        g.m.push(s);
        g.x = g.m.reduce((a, o) => a + o.sx, 0) / g.m.length;
        g.y = g.m.reduce((a, o) => a + o.sy, 0) / g.m.length;
      } else groups.push({ x: s.sx, y: s.sy, m: [s] });
    }
    const placed = new Map<string, Placed>(single.map((s) => [s.id, s]));
    const legs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const clusters: Cluster[] = [];
    for (const g of groups) {
      if (g.m.length === 1) { placed.set(g.m[0].id, g.m[0]); continue; }
      // Stories that share a spot never separate by zooming, so their group
      // fans out round its centre, each with a leg back to its true place.
      if (spiderSet && g.m.some((s) => spiderSet.has(s.id))) {
        const n = g.m.length;
        const r = (n <= 2 ? 24 : n <= 4 ? 30 : 40) * us;
        g.m.forEach((s, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / n + (n === 2 ? Math.PI / 2 : 0);
          const fanned = { ...s, sx: g.x + r * Math.cos(a), sy: g.y + r * Math.sin(a) };
          legs.push({ x1: s.sx, y1: s.sy, x2: fanned.sx, y2: fanned.sy });
          placed.set(s.id, fanned);
        });
      } else {
        clusters.push({ key: g.m.map((s) => s.id).sort().join('|'), x: g.x, y: g.y, m: g.m });
      }
    }
    return { placed, legs, clusters };
  }, [stories, shown, stops, selected, spider, view, us]);

  const openCluster = (c: Cluster, wasFocused: boolean) => {
    const ms = c.m;
    let minD = Infinity;
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) minD = Math.min(minD, Math.hypot(ms[i].x! - ms[j].x!, ms[i].y! - ms[j].y!));
    }
    const kSep = ((22 * us) / Math.max(minD, 1e-6)) * 1.08;
    if (kSep <= MAX_K && view.k < kSep * 0.98) fitPoints(ms.map((s) => [s.x!, s.y!]), MAX_K, 90);
    else {
      // Too close to separate: zoom in only as far as the group still reads
      // as one, then fan it out.
      setSpider(c.key);
      const cx = ms.reduce((a, s) => a + s.x!, 0) / ms.length;
      const cy = ms.reduce((a, s) => a + s.y!, 0) / ms.length;
      const spread = Math.max(0.01, ...ms.map((s) => Math.hypot(s.x! - cx, s.y! - cy)));
      flyTo(cx, cy, clamp((0.85 * 22 * us) / spread, view.k, 8));
    }
    if (wasFocused) requestAnimationFrame(() => pinRefs.current.get(ms[0].id)?.focus({ preventScroll: true }));
  };

  // ---------------------------------------------------------------- gestures
  const gesture = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    drag: { start: { x: number; y: number }; tx: number; ty: number } | null;
    pinch: { d: number; k: number; tx: number; ty: number; m: [number, number] } | null;
    moved: boolean;
    downTarget: Element | null;
  }>({ pointers: new Map(), drag: null, pinch: null, moved: false, downTarget: null });
  const [dragging, setDragging] = useState(false);

  const toPlate = useCallback((e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * usRef.current, y: (e.clientY - r.top) * usRef.current };
  }, []);
  const isControl = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('.at-pin, .at-cluster, .at-zoom, .at-tools');

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isControl(e.target)) return;
    const g = gesture.current;
    g.downTarget = e.target as Element;
    g.pointers.set(e.pointerId, toPlate(e));
    try { frameRef.current?.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    g.moved = false;
    const v = viewRef.current;
    if (g.pointers.size === 1) g.drag = { start: toPlate(e), tx: v.tx, ty: v.ty };
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: v.k, tx: v.tx, ty: v.ty, m: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
      g.drag = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, toPlate(e));
    if (g.pinch && g.pointers.size >= 2) {
      const [a, b] = [...g.pointers.values()];
      const k = clamp(g.pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) / g.pinch.d), 1, MAX_K);
      const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const mapPt = [(g.pinch.m[0] - g.pinch.tx) / g.pinch.k, (g.pinch.m[1] - g.pinch.ty) / g.pinch.k];
      g.moved = true;
      setView(clampView({ k, tx: mid[0] - mapPt[0] * k, ty: mid[1] - mapPt[1] * k }));
    } else if (g.drag) {
      const p = toPlate(e);
      const dx = p.x - g.drag.start.x;
      const dy = p.y - g.drag.start.y;
      if (!g.moved && Math.hypot(dx, dy) < 4 * usRef.current) return;
      if (!g.moved) setDragging(true);
      g.moved = true;
      setView(clampView({ ...viewRef.current, tx: g.drag.tx + dx, ty: g.drag.ty + dy }));
    }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size < 2) g.pinch = null;
    if (g.pointers.size > 0) return;
    setDragging(false);
    if (!g.moved && e.type === 'pointerup' && g.downTarget) {
      if (spider) setSpider(null);
      const county = g.downTarget.closest?.('path[data-county]') as SVGPathElement | null;
      const name = county?.dataset.county;
      if (name && !countiesWithStories.has(name)) onSelectCounty(name);
      else if (name) {
        const pts = stories.filter((s) => s.county === name && s.x != null && shown.has(s.id)).map((s) => [s.x!, s.y!] as [number, number]);
        if (pts.length) fitPoints(pts, pts.length > 1 ? MAX_K : 4, 90);
      }
    }
    g.drag = null;
    g.downTarget = null;
  };

  // Wheel zoom needs a non-passive listener, which React can't attach.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let timer: number | undefined;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        // Plain scrolling keeps scrolling the page; say how to zoom instead
        // of hijacking it.
        setWheelHint(true);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setWheelHint(false), 1100);
        return;
      }
      e.preventDefault();
      const p = toPlate(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0025));
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => { frame.removeEventListener('wheel', onWheel); window.clearTimeout(timer); };
  }, [zoomAt, toPlate]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== frameRef.current) return;
    const step = 70 * us;
    const v = viewRef.current;
    switch (e.key) {
      case '+': case '=': zoomAt(W / 2, H / 2, 1.6); break;
      case '-': case '_': zoomAt(W / 2, H / 2, 1 / 1.6); break;
      case 'ArrowLeft': setView(clampView({ ...v, tx: v.tx + step })); break;
      case 'ArrowRight': setView(clampView({ ...v, tx: v.tx - step })); break;
      case 'ArrowUp': setView(clampView({ ...v, ty: v.ty + step })); break;
      case 'ArrowDown': setView(clampView({ ...v, ty: v.ty - step })); break;
      case '0': case 'Home': flyTo(W / 2, H / 2, 1); break;
      default: return;
    }
    e.preventDefault();
  };

  const ensureOnScreen = (s: AtlasStory) => {
    if (s.x == null) return;
    const [x, y] = toScreen(s.x, s.y!);
    if (x < 20 || x > W - 20 || y < 20 || y > H - 20) flyTo(s.x, s.y!, view.k);
  };

  // ---------------------------------------------------------------- derived
  const tintD = useMemo(() => COUNTY_GEO.filter((c) => countiesWithStories.has(c.name)).map((c) => c.d).join(''), [countiesWithStories]);
  const hatchD = useMemo(() => COUNTY_GEO.filter((c) => !countiesWithStories.has(c.name)).map((c) => c.d).join(''), [countiesWithStories]);

  const scale = (() => {
    const pxPer100 = (geo.km100 * view.k) / us;
    const opts = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    let km = opts.find((d) => (pxPer100 * d) / 100 <= 130) || 1;
    if ((pxPer100 * km) / 100 < 40) km = opts[Math.max(0, opts.indexOf(km) - 1)];
    return { km, px: Math.round((pxPer100 * km) / 100) };
  })();

  const centre = invert((W / 2 - view.tx) / view.k, (H / 2 - view.ty) / view.k);

  const hoverPlaced = hover ? layout.placed.get(hover) : undefined;
  const tipStory = hoverPlaced && hoverPlaced.sx >= 0 && hoverPlaced.sx <= W && hoverPlaced.sy >= 0 && hoverPlaced.sy <= H ? hoverPlaced : null;
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const frame = frameRef.current;
    if (!tip || !frame || !tipStory) return;
    const px = tipStory.sx / us;
    const py = tipStory.sy / us;
    const half = Math.min(125, tip.offsetWidth / 2);
    tip.style.left = `${clamp(px, half + 8, frame.clientWidth - half - 8)}px`;
    tip.style.top = `${py}px`;
    tip.classList.toggle('at-below', py < tip.offsetHeight + 40);
  });

  const stopIndex = (id: string) => (stops ? stops.indexOf(id) : -1);
  const journeyPts = stops
    ? stops.map((id) => stories.find((s) => s.id === id)).filter((s): s is AtlasStory => !!s && s.x != null).map((s) => toScreen(s.x!, s.y!))
    : [];

  const label = (x: number, y: number) => `translate(${x} ${y}) scale(${us})`;

  return (
    <div
      ref={frameRef}
      className={`at-frame${dragging ? ' at-dragging' : ''}`}
      hidden={hidden}
      tabIndex={0}
      role="region"
      aria-label={copy.mapLabel}
      aria-describedby="at-map-help"
      style={{ touchAction: view.k > 1.02 ? 'none' : 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={(e) => { if (isControl(e.target)) return; const p = toPlate(e); zoomAt(p.x, p.y, 2); }}
      onKeyDown={onKeyDown}
    >
      <svg ref={svgRef} className={`at-svg${playing ? ' at-playing' : ''}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="group">
        <defs>
          {/* Counter-scaled so the stripes keep their spacing at any zoom. */}
          <pattern id="at-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform={`rotate(45) scale(${1 / view.k})`}>
            <line x1="0" y1="0" x2="0" y2="7" className="at-hatch-line" />
          </pattern>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          <StaticLayers
            tintD={tintD}
            hatchD={hatchD}
            showHatch={layers.unwritten && view.k <= 6}
            showRegions={layers.regions}
            showRivers={layers.rivers}
            written={countiesWithStories}
          />
          {selectedCounty && <g className="at-l-sel"><path d={countyD.get(selectedCounty) || ''} /></g>}
        </g>

        <g aria-hidden="true">
          {layers.regions && geo.regions.map((r) => {
            const [x, y] = toScreen(r.x, r.y);
            return <text key={r.id} className="at-lbl at-lbl-region" transform={label(x, y)} textAnchor="middle">{lang === 'ro' ? r.ro : r.en}</text>;
          })}
          {layers.rivers && geo.riverLabels.map((r) => {
            // At country scale only the Danube is named; the rest appear on zoom.
            if (view.k < 1.5 && r.key !== 'danube') return null;
            const [x, y] = toScreen(r.x, r.y);
            return <text key={r.key} className="at-lbl at-lbl-river" transform={label(x, y)} textAnchor="middle">{lang === 'ro' ? r.ro : r.en}</text>;
          })}
          {/* The mountain name rides along the Southern Carpathians at
              country scale and steps aside once the reader zooms in. */}
          {view.k <= 2.4 && (
            <>
              <path id="at-carp-path" d={'M' + geo.carpathians.map(([x, y]) => toScreen(x, y).join(',')).join('L')} fill="none" />
              <text className="at-lbl at-lbl-feature" fontSize={11 * us} letterSpacing={6 * us}>
                <textPath href="#at-carp-path" startOffset="50%" textAnchor="middle">{copy.carpathians}</textPath>
              </text>
            </>
          )}
          {(() => {
            const [sx, y] = toScreen(geo.blackSea[0], geo.blackSea[1]);
            // Held clear of the frame's right edge: on a phone the label is
            // wider than the sea it names, and "BLACK" lost its first letter.
            const x = Math.min(sx, W - 40 * us);
            return (
              <text className="at-lbl at-lbl-feature" transform={label(x, y)} fontSize={12} letterSpacing={4} textAnchor="middle">
                {copy.blackSea.map((w, i) => <tspan key={w} x={0} dy={i ? 16 : 0}>{w}</tspan>)}
              </text>
            );
          })()}
          {layout.legs.map((l, i) => (
            <g key={i}>
              <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="at-spider-leg" strokeWidth={1.2 * us} />
              <circle cx={l.x1} cy={l.y1} r={2.2 * us} className="at-spider-hub" />
            </g>
          ))}
          {journeyPts.length > 1 && (
            <path
              key={journeyKey ?? ''}
              className={`at-journey-line${reduceMotion ? '' : ' at-draw'}`}
              pathLength={1}
              d={'M' + journeyPts.map((p) => p.join(',')).join('L')}
              strokeWidth={1.8 * us}
            />
          )}
        </g>

        {/* One element per placed story, in time order so Tab walks through
            history. Hidden pins stay mounted so focus and animation state
            survive filtering. */}
        <g>
          {stories.map((s) => {
            if (s.x == null) return null;
            const p = layout.placed.get(s.id);
            const idx = stopIndex(s.id);
            const cls = ['at-pin', s.id === selected && 'at-sel', s.id === hover && 'at-hot', p?.dim && 'at-dim'].filter(Boolean).join(' ');
            return (
              <g
                key={s.id}
                ref={(el) => { if (el) pinRefs.current.set(s.id, el); else pinRefs.current.delete(s.id); }}
                className={cls}
                data-id={s.id}
                role="button"
                tabIndex={p ? 0 : -1}
                aria-hidden={p ? undefined : true}
                aria-label={`${pick(s.title, lang)} — ${pick(s.place, lang)}, ${whenOf(s, lang)}`}
                aria-pressed={s.id === selected}
                style={p ? undefined : { display: 'none' }}
                transform={p ? label(p.sx, p.sy) : undefined}
                onClick={(e) => { e.stopPropagation(); onSelectStory(s.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectStory(s.id); } }}
                onPointerEnter={() => onHover(s.id)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => { onHover(s.id); ensureOnScreen(s); }}
                onBlur={() => onHover(null)}
              >
                <circle r={22} className="at-pin-hit" />
                <circle r={15} className="at-pin-ring" />
                {s.timeless ? (
                  <path d={STAR_PATH} className="at-pin-star" />
                ) : !s.exact ? (
                  <><circle r={11} className="at-pin-approx" /><circle r={3.2} className="at-pin-core" /></>
                ) : (
                  <><circle r={8} className="at-pin-halo" /><circle r={2.9} className="at-pin-core" /></>
                )}
                {s.timeless && !s.exact && <circle r={14} className="at-pin-approx" />}
                {idx >= 0 && (
                  <g className="at-pin-num" transform="translate(13 -13)">
                    <circle r={8.5} />
                    <text>{idx + 1}</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
        <g>
          {layout.clusters.map((c) => (
            <g
              key={c.key}
              className="at-cluster"
              data-key={c.key}
              role="button"
              tabIndex={0}
              aria-label={fill(copy.clusterLabel, { s: countLabel(c.m.length, 'story', lang) })}
              transform={label(c.x, c.y)}
              onClick={(e) => { e.stopPropagation(); openCluster(c, document.activeElement === e.currentTarget); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCluster(c, true); } }}
            >
              <circle r={22} className="at-pin-hit" />
              <circle r={17} className="at-cl-ring-2" />
              <circle r={13} className="at-cl-ring" />
              <text className="at-cl-num">{c.m.length}</text>
            </g>
          ))}
        </g>
      </svg>

      <div className="at-ui">
        <p id="at-map-help" className="sr-only">{copy.mapHelp}</p>
        <div className="at-zoom">
          <button type="button" className="at-zoom-btn" aria-label={copy.zoomIn} title={copy.zoomIn} onClick={() => zoomAt(W / 2, H / 2, 1.8)}>
            <svg className="at-zoom-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
          </button>
          <button type="button" className="at-zoom-btn" aria-label={copy.zoomOut} title={copy.zoomOut} onClick={() => zoomAt(W / 2, H / 2, 1 / 1.8)}>
            <svg className="at-zoom-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 8h10" /></svg>
          </button>
          <button type="button" className="at-zoom-btn" aria-label={copy.zoomReset} title={copy.zoomReset} onClick={() => { setSpider(null); flyTo(W / 2, H / 2, 1); }}>
            <svg className="at-zoom-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" /><path d="M2.5 2.5v3h3" /></svg>
          </button>
        </div>
        {readout && (
          <div className="at-readout">
            <span className="at-readout-yr">{readout.year}</span>
            <span className="at-readout-cap">{readout.caption}</span>
          </div>
        )}
        {/* Scale and the map's centre, together in the corner. */}
        <div className="at-scale" aria-hidden="true">
          <i style={{ width: scale.px }} /><span>{scale.km} km</span>
          <span className="at-coords">
            {Math.abs(centre[1]).toFixed(1)}°{centre[1] >= 0 ? 'N' : 'S'} · {Math.abs(centre[0]).toFixed(1)}°{centre[0] >= 0 ? 'E' : 'W'}
          </span>
        </div>
        {tipStory && (
          <div className="at-tip" ref={tipRef}>
            <span className="at-tip-m">{kindName(tipStory.kind, lang)} · {whenOf(tipStory, lang)}</span>
            <span className="at-tip-t">{pick(tipStory.title, lang)}</span>
            <span className="at-tip-p">{pick(tipStory.place, lang)}</span>
          </div>
        )}
        {wheelHint && <div className="at-wheel">{copy.wheel}</div>}
        {/* The map's own tools: what is drawn (layers) and what it means (key). */}
        <div className="at-tools">
          <div className="at-tool" onKeyDown={layerPop.onKeyDown}>
            <button
              type="button"
              ref={layerPop.btnRef}
              className="at-tool-btn"
              aria-expanded={layerPop.open}
              aria-controls="at-pop-layers"
              id="at-btn-layers"
              onClick={layerPop.toggle}
            >
              <svg className="at-ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5 11 4 6 6.5 1 4z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /><path d="M1 6.2 6 8.7l5-2.5M1 8.4l5 2.5 5-2.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg>
              {copy.lblLayers}
            </button>
            <div className="at-pop" id="at-pop-layers" ref={layerPop.popRef} hidden={!layerPop.open}>
              <div className="at-pop-list" role="group" aria-labelledby="at-btn-layers">
                {LAYERS.map(([id, labelKey]) => (
                  <button key={id} type="button" className="at-opt" data-layer={id} aria-pressed={layers[id]} onClick={() => onLayer(id)}>
                    <span>{copy[labelKey]}</span><span className="at-tick" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="at-tool" onKeyDown={key.onKeyDown}>
            <button
              type="button"
              ref={key.btnRef}
              className="at-tool-btn"
              aria-expanded={key.open}
              aria-controls="at-pop-key"
              onClick={key.toggle}
            >
              <svg className="at-ico" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.2" /><circle cx="6" cy="6" r="1.6" fill="currentColor" /></svg>
              {copy.key}
            </button>
            <div className="at-pop" id="at-pop-key" ref={key.popRef} hidden={!key.open}>
              <Legend copy={copy} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Legend: React.FC<{ copy: AtlasCopy }> = ({ copy }) => (
  <ul className="at-legend">
    <li>
      <svg className="at-legend-ico" viewBox="-12 -12 24 24" aria-hidden="true"><circle r="7" fill="var(--ink-2)" stroke="var(--gold)" strokeWidth="1.6" /><circle r="2.6" fill="var(--gold)" /></svg>
      {copy.legExact}
    </li>
    <li>
      <svg className="at-legend-ico" viewBox="-12 -12 24 24" aria-hidden="true"><circle r="9.5" fill="none" stroke="var(--gold)" strokeWidth="1.3" strokeDasharray="3 3" /><circle r="2.8" fill="var(--gold)" /></svg>
      {copy.legApprox}
    </li>
    <li>
      <svg className="at-legend-ico" viewBox="-12 -12 24 24" aria-hidden="true"><path d={STAR_PATH} fill="var(--gold)" /></svg>
      {copy.legTimeless}
    </li>
    <li>
      <svg className="at-legend-ico" viewBox="-12 -12 24 24" aria-hidden="true">
        <circle r="10" fill="var(--ink-2)" stroke="var(--gold)" strokeWidth="1.5" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill="var(--gold)" fontFamily="var(--ui)">6</text>
      </svg>
      {copy.legCluster}
    </li>
    <li>
      <svg className="at-legend-ico" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <pattern id="at-legend-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line y2="5" stroke="var(--at-hatch)" strokeWidth="1.6" />
          </pattern>
        </defs>
        <rect x="2" y="5" width="20" height="14" fill="url(#at-legend-hatch)" stroke="var(--at-county-line)" />
      </svg>
      {copy.legUnwritten}
    </li>
    <li className="at-hint">{copy.legHint}</li>
  </ul>
);

export default AtlasMap;
