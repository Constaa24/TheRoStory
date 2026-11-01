import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  formatYear, layoutLanes, pick, ticksFor, whenOf, xOf, yearOf,
  type AtlasStory, type Lang, type TimeScale,
} from '@/lib/atlas/model';
import type { AtlasCopy } from './copy';
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
  const { lanes, count: laneCount } = useMemo(() => layoutLanes(dated, width || 1, scale), [dated, width, scale]);

  const yearText = (y: number) => (y >= scale.end ? copy.today : formatYear(y, lang));
  const [a, b] = range;

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

  // An era's label: the long name if it fits its band, else the short one,
  // else nothing. The name read out stays whole either way.
  const fits = (text: string, px: number) => text.length * 7.6 + 12 <= px;
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

  return (
    <section className="at-tl" aria-labelledby="at-tl-title">
      <div className="at-tl-head">
        <h2 id="at-tl-title">{copy.tlTitle}</h2>
        {dated.length > 0 && (
          <button type="button" className="at-btn-gold" aria-pressed={playing} onClick={onPlay}>
            <PlayIcon playing={playing} />
            {playLabel}
          </button>
        )}
        <span className="at-tl-range">{formatYear(a, lang)} – {yearText(b)}</span>
      </div>
      <div className="at-tl-body">
        <div className="at-tl-track" ref={trackRef}>
          <div className="at-tl-eras">
            {scale.eras.map((era) => {
              const long = pick(era.long, lang);
              const short = pick(era.short, lang);
              const px = ((xOf(scale, era.to) - xOf(scale, era.from)) / 100) * width;
              const title = `${long} · ${formatYear(era.from, lang)}–${era.to >= scale.end ? copy.today : formatYear(era.to, lang)}`;
              const pressed = a === era.from && b === era.to;
              return (
                <button
                  key={era.id}
                  type="button"
                  className="at-tl-era"
                  data-era={era.id}
                  style={{ left: `${xOf(scale, era.from)}%`, width: `${xOf(scale, era.to) - xOf(scale, era.from)}%` }}
                  title={title}
                  aria-label={title}
                  aria-pressed={pressed}
                  onClick={() => onRange(pressed ? [scale.start, scale.end] : [era.from, era.to])}
                >
                  {fits(long, px) ? long : fits(short, px) ? short : ''}
                </button>
              );
            })}
          </div>
          {/* Every mark is also a row in the story list, so the marks
              themselves stay out of the tab order and the reading order. */}
          <div className="at-tl-marks" aria-hidden="true" style={{ height: 10 + laneCount * 14 }}>
            {dated.map((s) => (
              <div
                key={s.id}
                className={`at-tl-mark ${markState(s)}`}
                style={{
                  left: `${xOf(scale, s.y0!)}%`,
                  width: `${Math.max(0, xOf(scale, s.y1!) - xOf(scale, s.y0!))}%`,
                  top: 6 + (lanes.get(s.id) ?? 0) * 14,
                }}
                onPointerEnter={() => onHover(s.id)}
                onPointerLeave={() => onHover(null)}
                onClick={() => onSelect(s.id)}
              >
                <span className="at-tl-bar" />
                <span className="at-tl-dot" />
                <span className="at-tl-lbl">{pick(s.title, lang)} · {whenOf(s, lang)}</span>
              </div>
            ))}
          </div>
          <div className="at-tl-axis">
            {ticksFor(scale, width || 600).map((y) => (
              <div key={y} className="at-tl-tick" style={{ left: `${xOf(scale, y)}%` }}><span>{formatYear(y, lang)}</span></div>
            ))}
          </div>
          <div className="at-tl-shade" style={{ left: 0, width: `${xOf(scale, a)}%` }} />
          <div className="at-tl-shade" style={{ left: `${xOf(scale, b)}%`, width: `${100 - xOf(scale, b)}%` }} />
          {cursorPct != null && <div className="at-tl-cursor" style={{ left: `${cursorPct}%` }} />}
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
        {timeless.length > 0 && (
          <div className="at-tl-tcol">
            {/* The Timeless band doubles as the switch that shows or hides them. */}
            <button type="button" className="at-tl-timeless" aria-pressed={showTimeless} aria-label={copy.showTimeless} onClick={onToggleTimeless}>
              <StarIcon />
              <span className="at-tl-timeless-txt">{copy.timelessBand}</span>
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
                  <span className="at-tl-lbl at-tl-lbl-r">{pick(s.title, lang)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="sr-only" id="at-tl-hint">{copy.tlHint}</p>
    </section>
  );
};

export default AtlasTimeline;
