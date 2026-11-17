import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  eraTicks, formatYear, pick, stackDots, whenOf, xOf, yearOf,
  type AtlasStory, type Lang, type TimeScale,
} from '@/lib/atlas/model';
import { fill, type AtlasCopy } from './copy';
import { StarIcon } from './glyphs';

type Props = {
  stories: readonly AtlasStory[];
  scale: TimeScale;
  range: readonly [number, number];
  showTimeless: boolean;
  onRange: (range: [number, number]) => void;
  onToggleTimeless: () => void;
  /** Ids that pass the filters; the rest fade. */
  matched: ReadonlySet<string>;
  stops: ReadonlySet<string> | null;
  selected: string | null;
  hover: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  playing: boolean;
  /** Play cursor position in percent, or null when not playing. */
  cursorPct: number | null;
  playLabel: string;
  onPlay: () => void;
  copy: AtlasCopy;
  lang: Lang;
};

const PlayIcon: React.FC<{ playing: boolean }> = ({ playing }) => (
  <svg className="at-ico" viewBox="0 0 12 12" aria-hidden="true">
    {playing ? <path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" /> : <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />}
  </svg>
);

/** Room for the era names along the top of the strip. */
const LABEL_H = 26;
/** Space under the lowest row of dots. */
const BASE = 8;
/** One row of dots. */
const ROW = 13;
/** A dot's size (CSS draws it; the layout needs to know it). */
const DOT = 10;
/** Roughly how wide an era name prints, in px, at the label's size. */
const labelWidth = (text: string) => text.length * 7.4 + 14;

/**
 * The Atlas's timeline, laid out to be read at a glance:
 *
 *   - the eras as labelled bands, so the uneven axis explains itself (the
 *     19th and 20th centuries, where most stories are, get most of the
 *     width); a band's name is also the quickest way to pick that era;
 *   - each dated story as one dot at the year it begins, dots that would
 *     touch piled upward, so the tall stacks show where the stories are;
 *     a story's span is drawn only for the one being hovered or chosen;
 *   - one rail under the bands with the two handles that choose the years,
 *     and the boundary years under that;
 *   - the stories with no date in a row of their own, after the switch that
 *     shows or hides them.
 *
 * Every mark is also a row in the story list (the map's accessible
 * equivalent), so the marks stay out of the tab order and reading order.
 * The handles, the era names, Play and the Timeless switch do not.
 */
const AtlasTimeline: React.FC<Props> = ({
  stories, scale, range, showTimeless, onRange, onToggleTimeless, matched, stops, selected, hover, onHover, onSelect,
  playing, cursorPct, playLabel, onPlay, copy, lang,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setWidth(track.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, []);

  const dated = useMemo(() => stories.filter((s) => s.y0 != null), [stories]);
  const timeless = useMemo(() => stories.filter((s) => s.timeless), [stories]);
  const { rows, count: rowCount } = useMemo(() => stackDots(dated, width || 1, scale), [dated, width, scale]);

  const yearText = (y: number) => (y >= scale.end ? copy.today : formatYear(y, lang));
  const [a, b] = range;
  const full = a <= scale.start && b >= scale.end;

  const setHandle = (i: 0 | 1, year: number) => {
    const next: [number, number] = [a, b];
    next[i] = i === 0 ? Math.max(scale.start, Math.min(year, b - 5)) : Math.min(scale.end, Math.max(year, a + 5));
    if (next[0] !== a || next[1] !== b) onRange(next);
  };
  const dragTo = (i: 0 | 1, clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    setHandle(i, Math.round(yearOf(scale, pct) / 5) * 5);
  };
  const onHandleDown = (i: 0 | 1) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    const move = (ev: PointerEvent) => dragTo(i, ev.clientX);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const onHandleKey = (i: 0 | 1) => (e: React.KeyboardEvent) => {
    const big = e.shiftKey ? 50 : 10;
    let v = range[i];
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= big;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += big;
    else if (e.key === 'PageDown') v -= 100;
    else if (e.key === 'PageUp') v += 100;
    else if (e.key === 'Home') v = scale.start;
    else if (e.key === 'End') v = scale.end;
    else return;
    e.preventDefault();
    setHandle(i, v);
  };

  const markState = (s: AtlasStory) => [
    !matched.has(s.id) && !stops?.has(s.id) && 'at-out',
    selected === s.id && 'at-sel',
    hover === s.id && 'at-hot',
    stops?.has(s.id) && 'at-stop',
  ].filter(Boolean).join(' ');

  if (!dated.length && !timeless.length) {
    return (
      <section className="at-tl" aria-labelledby="at-tl-title">
        <div className="at-tl-head"><h2 id="at-tl-title">{copy.tlTitle}</h2></div>
        <p className="at-tl-empty">{copy.noDates}</p>
      </section>
    );
  }

  // The story in hand, whose span is drawn: the one under the pointer (here,
  // on the map or in the list), else the one chosen.
  const focusId = hover ?? selected;
  const focus = focusId ? dated.find((s) => s.id === focusId) : undefined;
  const rowBottom = (row: number) => BASE + row * ROW;
  const stripH = LABEL_H + rowBottom(Math.max(rowCount, 1)) + 4;
  const xa = xOf(scale, a);
  const xb = xOf(scale, b);

  return (
    <section className="at-tl" aria-labelledby="at-tl-title">
      <div className="at-tl-head">
        <h2 id="at-tl-title">{copy.tlTitle}</h2>
        {dated.length > 0 && (
          <button type="button" className="at-play" aria-pressed={playing} onClick={onPlay}>
            <PlayIcon playing={playing} />
            {playLabel}
          </button>
        )}
        {dated.length > 0 && (
          <span className={`at-tl-range${full ? '' : ' is-narrowed'}`}>{formatYear(a, lang)} – {yearText(b)}</span>
        )}
      </div>

      {dated.length > 0 ? (
        <div className="at-tl-track" ref={trackRef}>
          <div className="at-tl-strip" style={{ height: stripH }}>
            {/* The eras, as bands across the strip. */}
            {scale.eras.map((e, i) => {
              const left = xOf(scale, e.from);
              const w = xOf(scale, e.to) - left;
              const px = (w / 100) * width;
              const long = pick(e.long, lang);
              const short = pick(e.short, lang);
              const text = labelWidth(long) <= px ? long : labelWidth(short) <= px ? short : '';
              const on = a === e.from && b === e.to;
              return (
                <div key={e.id} className={`at-tl-band${i % 2 ? ' is-alt' : ''}${on ? ' is-on' : ''}`} style={{ left: `${left}%`, width: `${w}%` }}>
                  {text && (
                    <button
                      type="button"
                      className="at-tl-era"
                      aria-pressed={on}
                      title={long}
                      onClick={() => onRange(on ? [scale.start, scale.end] : [e.from, e.to])}
                    >
                      {/* The spoken name starts with the printed one (which
                          may be the short form), so "click Med." works by
                          voice, then says what pressing it does. */}
                      {text}
                      <span className="sr-only">{`: ${fill(copy.eraPick, { era: long, from: formatYear(e.from, lang), to: yearText(e.to) })}`}</span>
                    </button>
                  )}
                </div>
              );
            })}

            {/* The years outside the chosen range, dimmed. */}
            <div className="at-tl-shade" style={{ left: 0, width: `${xa}%` }} />
            <div className="at-tl-shade" style={{ left: `${xb}%`, width: `${100 - xb}%` }} />

            {/* The span of the story in hand. */}
            {focus && focus.y1! > focus.y0! && (
              <div
                className="at-tl-span"
                aria-hidden="true"
                style={{
                  left: `${xOf(scale, focus.y0!)}%`,
                  width: `${xOf(scale, focus.y1!) - xOf(scale, focus.y0!)}%`,
                  bottom: rowBottom(rows.get(focus.id) ?? 0) + DOT / 2 - 2,
                }}
              />
            )}

            <div className="at-tl-dots" aria-hidden="true">
              {dated.map((s) => {
                const x = xOf(scale, s.y0!);
                const edge = x > 72 ? ' at-tl-lbl-end' : x < 18 ? ' at-tl-lbl-start' : '';
                return (
                  <div
                    key={s.id}
                    className={`at-tl-mark ${markState(s)}`}
                    style={{ left: `${x}%`, bottom: rowBottom(rows.get(s.id) ?? 0) }}
                    onPointerEnter={() => onHover(s.id)}
                    onPointerLeave={() => onHover(null)}
                    onClick={() => onSelect(s.id)}
                  >
                    <span className="at-tl-dot" />
                    <span className={`at-tl-lbl${edge}`}>{pick(s.title, lang)} · {whenOf(s, lang)}</span>
                  </div>
                );
              })}
            </div>

            {cursorPct != null && <div className="at-tl-cursor" style={{ left: `${cursorPct}%` }} />}
          </div>

          {/* The rail: the chosen years in gold, a handle at each end. */}
          <div className="at-tl-rail">
            <div className="at-tl-rail-on" style={{ left: `${xa}%`, width: `${xb - xa}%` }} />
            {([0, 1] as const).map((i) => (
              <div
                key={i}
                className="at-tl-handle"
                role="slider"
                tabIndex={0}
                aria-label={i ? copy.toYear : copy.fromYear}
                aria-valuemin={scale.start}
                aria-valuemax={scale.end}
                aria-valuenow={range[i]}
                aria-valuetext={yearText(range[i])}
                aria-describedby="at-tl-hint"
                style={{ left: `${xOf(scale, range[i])}%` }}
                onPointerDown={onHandleDown(i)}
                onKeyDown={onHandleKey(i)}
              />
            ))}
          </div>

          <div className="at-tl-years" aria-hidden="true">
            {eraTicks(scale, width || 600).map((y, i, all) => (
              <span
                key={y}
                className={i === 0 ? 'is-start' : i === all.length - 1 ? 'is-end' : undefined}
                style={{ left: `${xOf(scale, y)}%` }}
              >
                {yearText(y)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="at-tl-empty">{copy.noDates}</p>
      )}

      {timeless.length > 0 && (
        <div className="at-tl-foot">
          {/* The switch that shows or hides the stories with no date, and
              how many there are. */}
          <button
            type="button"
            className="at-tl-timeless"
            aria-pressed={showTimeless}
            onClick={onToggleTimeless}
          >
            {/* Named by what it shows ("Timeless 5"), then what it does. */}
            <StarIcon />
            <span>{copy.timelessBand}</span>
            <span className="at-tl-count">{timeless.length}</span>
            <span className="sr-only">{`: ${copy.showTimeless}`}</span>
          </button>
          <div className="at-tl-stars" aria-hidden="true">
            {timeless.map((s) => (
              <button
                key={s.id}
                type="button"
                tabIndex={-1}
                className={`at-tl-star ${markState(s)}`}
                onPointerEnter={() => onHover(s.id)}
                onPointerLeave={() => onHover(null)}
                onClick={() => onSelect(s.id)}
              >
                <StarIcon />
                <span className="at-tl-lbl at-tl-lbl-start at-tl-lbl-star">{pick(s.title, lang)}</span>
              </button>
            ))}
          </div>
          <span className="at-tl-note">{copy.timelessNote}</span>
        </div>
      )}
      <p className="sr-only" id="at-tl-hint">{copy.tlHint}</p>
    </section>
  );
};

export default AtlasTimeline;
