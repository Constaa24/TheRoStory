import React from 'react';
import { FORMATS, formatYear, isFullRange, kindName, pick, type AtlasFilters, type AtlasKind, type Lang, type TimeScale } from '@/lib/atlas/model';
import { fill, type AtlasCopy } from './copy';
import { usePopover } from './hooks';
import { CaretIcon, CrossIcon } from './glyphs';

export type FilterKind = 'theme' | 'format' | 'range' | 'timeless' | 'all';

type Props = {
  themes: { id: string; name: string; count: number }[];
  formatCounts: Partial<Record<AtlasKind, number>>;
  total: number;
  filters: AtlasFilters;
  scale: TimeScale;
  onTheme: (id: string | null) => void;
  onFormat: (kind: AtlasKind | null) => void;
  /** An era chip: its years, or the whole axis for "Any time". */
  onRange: (range: [number, number]) => void;
  onClear: (kind: FilterKind) => void;
  copy: AtlasCopy;
  lang: Lang;
};

/**
 * The filter bar, as the design draws it: the shelves on one line, the eras
 * and the format on the next, and the filters in force underneath as chips
 * that remove themselves. Map display (layers, key) lives on the map.
 */
const AtlasToolbar: React.FC<Props> = ({
  themes, formatCounts, total, filters, scale, onTheme, onFormat, onRange, onClear, copy, lang,
}) => {
  const allShelvesRef = React.useRef<HTMLButtonElement>(null);
  const formatPop = usePopover();

  const theme = themes.find((t) => t.id === filters.theme);
  const full = isFullRange(filters, scale);
  const [a, b] = filters.range;
  const eraOn = (from: number, to: number) => a === from && b === to;

  const chips: [FilterKind, string][] = [];
  if (theme) chips.push(['theme', theme.name]);
  if (filters.format) chips.push(['format', kindName(filters.format, lang)]);
  if (!full) chips.push(['range', `${formatYear(a, lang)}–${b >= scale.end ? copy.today : formatYear(b, lang)}`]);
  if (!filters.showTimeless) chips.push(['timeless', copy.afTimeless]);

  // A removed chip takes keyboard focus with it; hand focus to the first
  // shelf ("All") so it doesn't fall back to the top of the page.
  const clear = (kind: FilterKind) => {
    onClear(kind);
    requestAnimationFrame(() => allShelvesRef.current?.focus({ preventScroll: true }));
  };

  return (
    <div className="at-toolbar">
      {/* The shelves: one row that wraps, or scrolls sideways on a phone. */}
      <div className="at-frow">
        <span className="at-filter-lbl" id="at-lbl-theme">{copy.lblTheme}</span>
        <div className="at-chips" role="group" aria-labelledby="at-lbl-theme">
          {[{ id: '', name: copy.all, count: total }, ...themes].map((t) => (
            <button
              key={t.id || 'all'}
              ref={t.id ? undefined : allShelvesRef}
              type="button"
              className="rs-chip at-shelf-chip"
              data-theme={t.id || 'all'}
              aria-pressed={(t.id || null) === filters.theme}
              onClick={() => onTheme(t.id || null)}
            >
              {t.name}<span className="rs-chip-n">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* The eras: the timeline's bands as chips. A range dragged on the
          timeline presses none of them and shows as a chip below. */}
      <div className="at-frow">
        <span className="at-filter-lbl" id="at-lbl-when">{copy.lblWhen}</span>
        <div className="at-chips" role="group" aria-labelledby="at-lbl-when">
          <button type="button" className="rs-chip at-era-chip" data-era="all" aria-pressed={full} onClick={() => onRange([scale.start, scale.end])}>
            {copy.anyTime}
          </button>
          {scale.eras.map((e) => {
            const on = eraOn(e.from, e.to);
            return (
              <button
                key={e.id}
                type="button"
                className="rs-chip at-era-chip"
                data-era={e.id}
                aria-pressed={on}
                title={`${formatYear(e.from, lang)}–${e.to >= scale.end ? copy.today : formatYear(e.to, lang)}`}
                onClick={() => onRange(on ? [scale.start, scale.end] : [e.from, e.to])}
              >
                {pick(e.long, lang)}
              </button>
            );
          })}
        </div>

        <div className="at-dd at-dd-format" onKeyDown={formatPop.onKeyDown}>
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
      </div>

      {chips.length > 0 && (
        <div className="at-af">
          <span className="at-filter-lbl">{copy.inForce}</span>
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
    </div>
  );
};

export default AtlasToolbar;
