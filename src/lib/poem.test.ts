import { describe, expect, it } from "vitest";
import { alignStanzas } from "./poem";

describe("alignStanzas", () => {
  it("pairs matching stanzas as they are", () => {
    const ro = [["a1", "a2"], ["b1"]];
    const en = [["A1", "A2"], ["B1"]];
    expect(alignStanzas(ro, en)).toEqual([
      { ro: ["a1", "a2"], en: ["A1", "A2"] },
      { ro: ["b1"], en: ["B1"] },
    ]);
  });

  it("re-breaks a translation that lost a blank line, so later stanzas stay paired", () => {
    // The English ran stanzas 2 and 3 together.
    const ro = [["a1"], ["b1", "b2"], ["c1"], ["d1"]];
    const en = [["A1"], ["B1", "B2", "C1"], ["D1"]];
    expect(alignStanzas(ro, en)).toEqual([
      { ro: ["a1"], en: ["A1"] },
      { ro: ["b1", "b2"], en: ["B1", "B2"] },
      { ro: ["c1"], en: ["C1"] },
      { ro: ["d1"], en: ["D1"] },
    ]);
  });

  it("takes the breaks from whichever side kept more of them", () => {
    const ro = [["a1", "a2", "b1"]];
    const en = [["A1", "A2"], ["B1"]];
    expect(alignStanzas(ro, en)).toEqual([
      { ro: ["a1", "a2"], en: ["A1", "A2"] },
      { ro: ["b1"], en: ["B1"] },
    ]);
  });

  it("pairs a free translation stanza by stanza", () => {
    const ro = [["a1", "a2"], ["b1"]];
    const en = [["A1"], ["B1", "B2"], ["C1"]];
    expect(alignStanzas(ro, en)).toEqual([
      { ro: ["a1", "a2"], en: ["A1"] },
      { ro: ["b1"], en: ["B1", "B2"] },
      { ro: [], en: ["C1"] },
    ]);
  });

  it("copes with one side being empty", () => {
    expect(alignStanzas([["a1"]], [])).toEqual([{ ro: ["a1"], en: [] }]);
  });
});
