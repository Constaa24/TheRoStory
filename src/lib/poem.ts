/**
 * A bilingual poem, lined up for reading side by side.
 *
 * Each language's text is split into stanzas (blank lines). The two are
 * then paired line by line, so a Romanian line always sits beside its
 * English reading — even when one wraps onto two lines and the other
 * doesn't.
 *
 * When both languages have the same number of lines but break them into
 * stanzas differently, one of them is missing a blank line (a stanza run on
 * into the next) and pairing stanza by stanza would put every stanza after
 * it beside the wrong one. Then both take the breaks of the version with
 * more stanzas, and the lines stay paired one for one. With different line
 * counts the two are a free translation, paired stanza by stanza.
 */

export type StanzaPair = { ro: string[]; en: string[] };

const chunk = (lines: string[], sizes: number[]): string[][] => {
  const out: string[][] = [];
  let at = 0;
  for (const n of sizes) {
    out.push(lines.slice(at, at + n));
    at += n;
  }
  return out;
};

export const alignStanzas = (ro: string[][], en: string[][]): StanzaPair[] => {
  const roLines = ro.flat();
  const enLines = en.flat();
  if (roLines.length && roLines.length === enLines.length) {
    const sizes = (ro.length >= en.length ? ro : en).map((s) => s.length);
    const roShared = chunk(roLines, sizes);
    const enShared = chunk(enLines, sizes);
    return roShared.map((lines, i) => ({ ro: lines, en: enShared[i] }));
  }
  return Array.from({ length: Math.max(ro.length, en.length) }, (_, i) => ({ ro: ro[i] ?? [], en: en[i] ?? [] }));
};
