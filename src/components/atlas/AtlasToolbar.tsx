import React from 'react';
import { FORMATS, formatYear, isFullRange, kindName, type AtlasFilters, type AtlasKind, type Lang, type TimeScale } from '@/lib/atlas/model';
import { fill, type AtlasCopy } from './copy';
import type { AtlasLayers } from './AtlasMap';
import { usePopover } from './hooks';
import { CaretIcon, CrossIcon } from './glyphs';

export type FilterKind = 'theme' | 'format' | 'range' | 'timeless' | 'all';

type Props = {
  themes: { id: string; name: string; count: number }[];
  formatCounts: Partial<Record<AtlasKind, number>>;
  total: number;
  filters: AtlasFilters;
  scale: TimeScale;
  layers: AtlasLayers;
  view: 'map' | 'list';
  onTheme: (id: string | null) => void;
  onFormat: (kind: AtlasKind | null) => void;
  onLayer: (layer: keyof AtlasLayers) => void;
  onView: (view: 'map' | 'list') => void;
  onClear: (kind: FilterKind) => void;
  copy: AtlasCopy;
  lang: Lang;
};

const LAYERS: [keyof AtlasLayers, 'layerRivers' | 'layerRegions' | 'layerUnwritten'][] = [
  ['rivers', 'layerRivers'],
  ['regions', 'layerRegions'],
  ['unwritten', 'layerUnwritten'],
];

const AtlasToolbar: React.FC<Props> = ({
  themes, formatCounts, total, filters, scale, layers, view, onTheme, onFormat, onLayer, onView, onClear, copy, lang,
}) => {
  const themePop = usePopover();
  const formatPop = usePopover();
  const layerPop = usePopover();

  const theme = themes.find((t) => t.id === filters.theme);
  const chips: [FilterKind, string][] = [];
  if (theme) chips.push(['theme', theme.name]);
  if (filters.format) chips.push(['format', kindName(filters.format, lang)]);
  if (!isFullRange(filters, scale)) {
    const [a, b] = filters.range;
    chips.push(['range', `${formatYear(a, lang)}–${b >= scale.end ? copy.today : formatYear(b, lang)}`]);
  }
  if (!filters.showTimeless) chips.push(['timeless', copy.afTimeless]);

  // A removed chip takes keyboard focus with it; hand focus to the first
  // dropdown so it doesn't fall back to the top of the page.
  const clear = (kind: FilterKind) => {
    onClear(kind);
    requestAnimationFrame(() => themePop.btnRef.current?.focus({ preventScroll: true }));
  };

  return (
    <div className="at-toolbar">
      <div className="at-dd" onKeyDown={themePop.onKeyDown}>
        <button type="button" ref={themePop.btnRef} className="at-dd-btn" aria-expanded={themePop.open} aria-controls="at-pop-theme" id="at-btn-theme" onClick={themePop.toggle}>
          <span>{copy.lblTheme}</span><span className="at-dd-v">{theme ? theme.name : copy.all}</span><CaretIcon />
        </button>
        <div className="at-pop" id="at-pop-theme" ref={themePop.popRef} hidden={!themePop.open}>
          <div className="at-pop-list" role="group" aria-labelledby="at-btn-theme">
            {[{ id: '', name: copy.all, count: total }, ...themes].map((t) => (
              <button
                key={t.id || 'all'}
                type="button"
                className="at-opt"
                aria-pressed={(t.id || null) === filters.theme}
                onClick={() => { onTheme(t.id || null); themePop.close(true); }}
              >
                <span>{t.name}</span><span className="at-opt-n">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="at-dd" onKeyDown={formatPop.onKeyDown}>
        <button type="button" ref={formatPop.btnRef} className="at-dd-btn" aria-expanded={formatPop.open} aria-controls="at-pop-format" id="at-btn-format" onClick={formatPop.toggle}>
          <span>{copy.lblFormat}</span><span className="at-dd-v">{filters.format ? kindName(filters.format, lang) : copy.all}</span><CaretIcon />
        </button>
        <div className="at-pop" id="at-pop-format" ref={formatPop.popRef} hidden={!formatPop.open}>
          <div className="at-pop-list" role="group" aria-labelledby="at-btn-format">
            <button type="button" className="at-opt" aria-pressed={filters.format === null} onClick={() => { onFormat(null); formatPop.close(true); }}>
              <span>{copy.all}</span><span className="at-opt-n">{total}</span>
            </button>
            {FORMATS.map((k) => (
              <button key={k} type="button" className="at-opt" data-format={k} aria-pressed={filters.format === k} onClick={() => { onFormat(k); formatPop.close(true); }}>
                <span>{kindName(k, lang)}</span><span className="at-opt-n">{formatCounts[k] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="at-dd" onKeyDown={layerPop.onKeyDown}>
        <button type="button" ref={layerPop.btnRef} className="at-dd-btn" aria-expanded={layerPop.open} aria-controls="at-pop-layers" id="at-btn-layers" onClick={layerPop.toggle}>
          <span>{copy.lblLayers}</span><span className="at-dd-v">{fill(copy.layersOn, { n: Object.values(layers).filter(Boolean).length })}</span><CaretIcon />
        </button>
        <div className="at-pop" id="at-pop-layers" ref={layerPop.popRef} hidden={!layerPop.open}>
          <div className="at-pop-list" role="group" aria-labelledby="at-btn-layers">
            {LAYERS.map(([id, label]) => (
              <button key={id} type="button" className="at-opt" data-layer={id} aria-pressed={layers[id]} onClick={() => onLayer(id)}>
                <span>{copy[label]}</span><span className="at-tick" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="at-af">
          {chips.map(([kind, label]) => (
            <button key={kind} type="button" className="at-af-chip" data-clear={kind} aria-label={fill(copy.removeFilter, { f: label })} onClick={() => clear(kind)}>
              {label}<CrossIcon />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" className="at-link" data-clear="all" onClick={() => clear('all')}>{copy.clear}</button>
          )}
        </div>
      )}

      <span className="sr-only" id="at-lbl-view">{copy.lblView}</span>
      <div className="at-seg" role="group" aria-labelledby="at-lbl-view">
        <button type="button" className="at-seg-btn" data-view="map" aria-pressed={view === 'map'} onClick={() => onView('map')}>{copy.viewMap}</button>
        <button type="button" className="at-seg-btn" data-view="list" aria-pressed={view === 'list'} onClick={() => onView('list')}>{copy.viewList}</button>
      </div>
    </div>
  );
};

export default AtlasToolbar;
