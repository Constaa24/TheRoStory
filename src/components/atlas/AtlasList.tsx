import React from 'react';
import { eraName, eraOf, kindName, pick, whenOf, type AtlasStory, type Lang, type TimeScale } from '@/lib/atlas/model';
import type { AtlasCopy } from './copy';

type Props = {
  list: readonly AtlasStory[];
  scale: TimeScale;
  selected: string | null;
  onSelect: (id: string) => void;
  categoryName: (id: string) => string;
  copy: AtlasCopy;
  lang: Lang;
};

/**
 * The map as a table: the same stories under the same filters, in time
 * order. Everything the map shows by position, this says in words.
 */
const AtlasList: React.FC<Props> = ({ list, scale, selected, onSelect, categoryName, copy, lang }) => {
  const rows: React.ReactNode[] = [];
  let lastEra: string | null = null;
  for (const s of list) {
    const era = eraOf(s, scale);
    if (era !== lastEra) {
      lastEra = era;
      rows.push(<tr key={`era:${era}`} className="at-era-row"><td colSpan={5}>{eraName(era, scale, lang)}</td></tr>);
    }
    rows.push(
      <tr key={s.id} className={selected === s.id ? 'at-sel' : undefined}>
        <td>{whenOf(s, lang)}</td>
        <td><button type="button" className="at-lv-title" onClick={() => onSelect(s.id)}>{pick(s.title, lang)}</button></td>
        <td>{pick(s.place, lang)}</td>
        <td>{kindName(s.kind, lang)}</td>
        <td>{categoryName(s.categoryId)}</td>
      </tr>
    );
  }
  return (
    <div className="at-list-wrap">
      <table className="at-lv">
        <caption>{copy.listCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.colWhen}</th>
            <th scope="col">{copy.colStory}</th>
            <th scope="col">{copy.colPlace}</th>
            <th scope="col">{copy.colFormat}</th>
            <th scope="col">{copy.colTheme}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows : <tr><td colSpan={5}>{copy.noMatch}</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default AtlasList;
