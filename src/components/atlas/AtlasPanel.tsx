import React from 'react';
import { Link } from 'react-router-dom';
import { countLabel } from '@/lib/article-utils';
import type { Journey } from '@/lib/supabase';
import {
  eraName, eraOf, formatYear, kindName, pick, whenOf, ACROSS_ROMANIA,
  type AtlasStory, type Lang, type TimeScale,
} from '@/lib/atlas/model';
import { fill, type AtlasCopy } from './copy';
import { BackIcon } from './glyphs';

export type AtlasTab = 'stories' | 'journeys' | 'unwritten';
export const CARD_TITLE_ID = 'at-card-title';

const Thumb: React.FC<{ src: string | null }> = ({ src }) =>
  src ? <img className="at-thumb" src={src} alt="" loading="lazy" /> : <span className="at-thumb ph" data-tone="warm" />;

// ---------------------------------------------------------------- cards

type StoryCardProps = {
  story: AtlasStory;
  categoryName: string;
  /** undefined while loading, '' when there is nothing to show. */
  excerpt: string | undefined;
  partOf: { journey: Journey; at: number }[];
  onJourney: (id: string, at: number) => void;
  /** In the side panel a card is left by its back link; only the phone sheet needs Close. */
  onClose?: () => void;
  from: string;
  copy: AtlasCopy;
  lang: Lang;
};

export const StoryCard: React.FC<StoryCardProps> = ({ story: s, categoryName, excerpt, partOf, onJourney, onClose, from, copy, lang }) => (
  <article className="at-card">
    <div className="at-card-cover">
      {s.cover ? <img src={s.cover} alt="" loading="lazy" /> : <span className="ph absolute inset-0" data-tone="warm" />}
      <span className="at-card-kind">{kindName(s.kind, lang)}</span>
    </div>
    <p className="eyebrow m-0">{categoryName ? `${categoryName} · ` : ''}{whenOf(s, lang)}</p>
    <h3 className="at-card-title" id={CARD_TITLE_ID} tabIndex={-1}>{pick(s.title, lang)}</h3>
    <p className="at-card-place">{pick(s.place, lang)}</p>
    {excerpt === undefined ? <p className="at-card-ex at-card-ex-wait" aria-hidden="true" /> : excerpt && <p className="at-card-ex">{excerpt}</p>}
    <div className="at-card-actions">
      <Link className="at-btn-gold" to={`/article/${s.id}`} state={{ from }}>
        {copy.read}
        <svg className="at-ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      </Link>
      {onClose && <button type="button" className="at-btn-ghost" onClick={onClose}>{copy.close}</button>}
    </div>
    {partOf.length > 0 && (
      <p className="at-card-parts">
        {copy.partOf}{' '}
        {partOf.map(({ journey, at }) => (
          <button key={journey.id} type="button" className="at-chip" onClick={() => onJourney(journey.id, at)}>
            {pick([journey.titleEn, journey.titleRo], lang)}
          </button>
        ))}
      </p>
    )}
  </article>
);

type CountyCardProps = { name: string; onClose?: () => void; copy: AtlasCopy };

/** A county with no story yet: what is missing, and where to pitch one. */
export const CountyCard: React.FC<CountyCardProps> = ({ name, onClose, copy }) => (
  <article className="at-card">
    <p className="eyebrow m-0">{copy.unwEyebrow}</p>
    <h3 className="at-card-title" id={CARD_TITLE_ID} tabIndex={-1}>{name}</h3>
    <p className="at-card-ex">{fill(copy.unwBody, { c: name })}</p>
    <div className="at-card-actions">
      <Link className="at-btn-gold" to="/contact-us">{copy.pitch}</Link>
      {onClose && <button type="button" className="at-btn-ghost" onClick={onClose}>{copy.close}</button>}
    </div>
  </article>
);

// ---------------------------------------------------------------- panel

type Props = {
  tab: AtlasTab;
  onTab: (tab: AtlasTab) => void;
  wide: boolean;
  /** The filtered stories, in time order. */
  list: readonly AtlasStory[];
  byId: ReadonlyMap<string, AtlasStory>;
  scale: TimeScale;
  matchLine: string;
  filtersOn: boolean;
  onClearFilters: () => void;
  selected: string | null;
  selectedCounty: string | null;
  hover: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onSelectCounty: (name: string) => void;
  onBack: () => void;
  unwritten: readonly string[];
  journeys: readonly Journey[];
  journey: Journey | null;
  stop: number;
  onStartJourney: (id: string, at: number) => void;
  onStop: (i: number) => void;
  onLeaveJourney: () => void;
  renderStoryCard: (s: AtlasStory, inPanel: boolean) => React.ReactNode;
  copy: AtlasCopy;
  lang: Lang;
};

const AtlasPanel: React.FC<Props> = ({
  tab, onTab, wide, list, byId, scale, matchLine, filtersOn, onClearFilters, selected, selectedCounty, hover, onHover,
  onSelect, onSelectCounty, onBack, unwritten, journeys, journey, stop, onStartJourney, onStop, onLeaveJourney,
  renderStoryCard, copy, lang,
}) => {
  const tabs: { id: AtlasTab; label: string; n?: number }[] = [
    { id: 'stories', label: copy.tabStories },
    ...(journeys.length ? [{ id: 'journeys' as const, label: copy.tabJourneys }] : []),
    ...(unwritten.length ? [{ id: 'unwritten' as const, label: copy.tabUnwritten, n: unwritten.length }] : []),
  ];
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === tab) + (e.key === 'ArrowRight' ? 1 : -1);
    const next = tabs[(i + tabs.length) % tabs.length].id;
    onTab(next);
    requestAnimationFrame(() => document.getElementById(`at-tab-${next}`)?.focus());
  };

  const where = (s: AtlasStory) => (s.x == null ? copy.notOnMap : pick(s.place, lang));
  const stopsOf = (j: Journey) => j.stops.map((id) => byId.get(id)).filter((s): s is AtlasStory => !!s);

  // ---- Stories: a chosen story replaces the list rather than stacking on it.
  const storiesPane = () => {
    if (wide && !journey && selected && byId.has(selected)) {
      return (
        <>
          <button type="button" className="at-back" onClick={onBack}><BackIcon />{copy.back}</button>
          {renderStoryCard(byId.get(selected)!, true)}
        </>
      );
    }
    const groups: [string, AtlasStory[]][] = [];
    for (const s of list) {
      const era = eraOf(s, scale);
      const last = groups[groups.length - 1];
      if (last && last[0] === era) last[1].push(s);
      else groups.push([era, [s]]);
    }
    return (
      <>
        <div className="at-pane-head">
          <p className="at-count">{matchLine}</p>
          {filtersOn && <button type="button" className="at-link" onClick={onClearFilters}>{copy.clear}</button>}
        </div>
        {!list.length ? (
          <p className="at-empty">{copy.noMatch}</p>
        ) : (
          <ul className="at-story-list">
            {groups.map(([era, items]) => (
              <React.Fragment key={era}>
                <li className="at-era-h">{eraName(era, scale, lang)}</li>
                {items.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`at-row${selected === s.id ? ' at-sel' : ''}${hover === s.id ? ' at-hot' : ''}`}
                      aria-pressed={selected === s.id}
                      onClick={() => onSelect(s.id)}
                      onPointerEnter={() => onHover(s.id)}
                      onPointerLeave={() => onHover(null)}
                    >
                      <Thumb src={s.thumb} />
                      <span>
                        <span className="at-row-meta">{whenOf(s, lang)} · {s.county || pick(ACROSS_ROMANIA, lang)}</span>
                        <span className="at-row-title">{pick(s.title, lang)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </React.Fragment>
            ))}
          </ul>
        )}
      </>
    );
  };

  // ---- Journeys
  const journeysPane = () => {
    if (!journey) {
      return (
        <>
          <p className="at-card-ex">{copy.journeysIntro}</p>
          {journeys.map((j) => {
            const ss = stopsOf(j);
            const years = ss.filter((s) => s.y0 != null).map((s) => s.y0!);
            const span = years.length
              ? `${formatYear(Math.min(...years), lang)} → ${formatYear(Math.max(...years), lang)}`
              : copy.timelessBand;
            return (
              <section key={j.id} className="at-journey">
                <p className="at-jmeta">{countLabel(ss.length, 'stop', lang)} · {span}</p>
                <h3 className="at-journey-title">{pick([j.titleEn, j.titleRo], lang)}</h3>
                {pick([j.introEn, j.introRo], lang) && <p>{pick([j.introEn, j.introRo], lang)}</p>}
                <ol className="at-stops">
                  {ss.map((s, i) => (
                    <li key={s.id}>
                      <span className="at-stop-no">{i + 1}</span>
                      <span className="at-stop" style={{ cursor: 'default' }}>
                        {pick(s.title, lang)}
                        <span className="at-stop-where">{where(s)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div>
                  <button type="button" className="at-btn-gold" onClick={() => onStartJourney(j.id, 0)} disabled={!ss.length}>{copy.start}</button>
                </div>
              </section>
            );
          })}
        </>
      );
    }
    const ss = stopsOf(journey);
    const cur = ss[stop];
    return (
      <>
        {wide && cur && renderStoryCard(cur, true)}
        <section className="at-journey">
          <p className="eyebrow m-0">{copy.journey} · {fill(copy.stopOf, { i: stop + 1, n: ss.length })}</p>
          <h3 className="at-journey-title">{pick([journey.titleEn, journey.titleRo], lang)}</h3>
          {pick([journey.introEn, journey.introRo], lang) && <p>{pick([journey.introEn, journey.introRo], lang)}</p>}
          <ol className="at-stops">
            {ss.map((s, i) => (
              <li key={s.id}>
                <span className="at-stop-no">{i + 1}</span>
                <button type="button" className="at-stop" aria-current={i === stop ? 'step' : undefined} onClick={() => onStop(i)}>
                  {pick(s.title, lang)}
                  <span className="at-stop-where">{where(s)}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="at-jnav">
            <button type="button" className="at-btn-ghost" onClick={() => onStop(stop - 1)} disabled={stop === 0}>← {copy.prev}</button>
            <button type="button" className="at-btn-gold" onClick={() => onStop(stop + 1)} disabled={stop >= ss.length - 1}>{copy.next} →</button>
          </div>
          <div><button type="button" className="at-link" onClick={onLeaveJourney}>{copy.leave}</button></div>
        </section>
      </>
    );
  };

  // ---- Unwritten
  const unwrittenPane = () => {
    if (wide && selectedCounty) {
      return (
        <>
          <button type="button" className="at-back" onClick={onBack}><BackIcon />{copy.backCounties}</button>
          <CountyCard name={selectedCounty} copy={copy} />
        </>
      );
    }
    return (
      <div className="at-unw">
        <h3 className="at-count">{copy.unwTitle}</h3>
        <p>{countLabel(unwritten.length, 'county', lang)} {unwritten.length === 1 ? copy.unwCount1 : copy.unwCountN}</p>
        <div className="at-county-chips">
          {unwritten.map((c) => (
            <button key={c} type="button" className="at-county-chip" aria-pressed={selectedCounty === c} onClick={() => onSelectCounty(c)}>{c}</button>
          ))}
        </div>
      </div>
    );
  };

  const panes: Record<AtlasTab, () => React.ReactNode> = { stories: storiesPane, journeys: journeysPane, unwritten: unwrittenPane };

  return (
    <aside className="at-panel">
      <div className="at-tabs" role="tablist" onKeyDown={onTabKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="at-tab"
            id={`at-tab-${t.id}`}
            aria-controls={`at-pane-${t.id}`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => onTab(t.id)}
          >
            {t.label}
            {t.n != null && <span className="at-tab-n">{t.n}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} className="at-pane" id={`at-pane-${t.id}`} role="tabpanel" aria-labelledby={`at-tab-${t.id}`} hidden={tab !== t.id}>
          {tab === t.id && panes[t.id]()}
        </div>
      ))}
    </aside>
  );
};

export default AtlasPanel;
