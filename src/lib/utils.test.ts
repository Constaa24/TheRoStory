import { describe, expect, it } from 'vitest';
import { toJsonLd } from './utils';

// Story titles and excerpts are written by people and land inside
// <script type="application/ld+json"> tags (ArticleDetail, Categories,
// CategoryDetail, Home). JSON.stringify alone would let a title containing
// "</script>" close the tag and run whatever followed as HTML.
describe('toJsonLd', () => {
  it('never lets a value close the script tag it is placed in', () => {
    const out = toJsonLd({ headline: 'Hi</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(out).not.toMatch(/<\/script/i);
  });

  it('still parses back to exactly the same data', () => {
    const data = { headline: 'Ana <3 Peleș', nested: { tag: '<!-- x -->' }, list: ['<b>'] };
    expect(JSON.parse(toJsonLd(data))).toEqual(data);
  });
});
