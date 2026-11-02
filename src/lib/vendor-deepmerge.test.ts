import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

/**
 * vendor/deepmerge replaces every deepmerge in the dependency tree (see the
 * "overrides" in package.json and README, "Dependency advisories"). It is
 * upstream 4.3.1 with one change, so these check both halves of that claim:
 * the advisory's attack no longer works, and ordinary merging is unchanged.
 *
 * Loaded through require: it is the CommonJS package the build tooling
 * loads, not an ES module.
 */
const require = createRequire(import.meta.url);
const deepmerge = require('../../vendor/deepmerge') as typeof import('../../vendor/deepmerge');

describe('vendored deepmerge', () => {
  it('is what the build tooling actually resolves', () => {
    const fromPlugin = require.resolve('deepmerge', {
      paths: [require.resolve('@rollup/plugin-node-resolve')],
    });
    expect(fromPlugin.replace(/\\/g, '/')).toMatch(/vendor\/deepmerge\/index\.js$/);
  });

  /** GHSA-gcqx-w48m-w2h4: a "__proto__" key replaced the result's prototype. */
  it('does not let a "__proto__" key poison the merged result', () => {
    const hostile = JSON.parse('{"__proto__": {"isAdmin": true}, "name": "x"}');

    for (const out of [deepmerge(hostile, {}), deepmerge({}, hostile), deepmerge.all([{}, hostile])]) {
      const result = out as Record<string, unknown>;
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(result.isAdmin).toBeUndefined();
      expect(result.name).toBe('x');
    }
    // Nothing global was touched either.
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it('keeps the data a "__proto__" key held, as an ordinary property', () => {
    const hostile = JSON.parse('{"__proto__": {"isAdmin": true}}');
    const out = deepmerge(hostile, {}) as object;
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toEqual({ isAdmin: true });
  });

  it('merges exactly as deepmerge 4.3.1 does', () => {
    const target = { a: { b: 1, list: [1] }, keep: 'x', date: new Date(0) };
    const source = { a: { c: 2, list: [2] }, add: true };
    const out = deepmerge(target, source);

    expect(out).toEqual({ a: { b: 1, c: 2, list: [1, 2] }, keep: 'x', add: true, date: new Date(0) });
    // Clones rather than sharing references, and leaves both inputs alone.
    expect(out.a).not.toBe(target.a);
    expect(target).toEqual({ a: { b: 1, list: [1] }, keep: 'x', date: new Date(0) });
    expect(source).toEqual({ a: { c: 2, list: [2] }, add: true });

    // The options upstream supports.
    const overwrite = (_t: unknown[], s: unknown[]) => s;
    expect(deepmerge({ l: [1] }, { l: [2] }, { arrayMerge: overwrite })).toEqual({ l: [2] });
    expect(deepmerge({ k: { a: 1 } }, { k: { b: 2 } }, { customMerge: (key) => (key === 'k' ? () => 'custom' : undefined) }))
      .toEqual({ k: 'custom' });
    expect(deepmerge.all([{ a: 1 }, { b: 2 }, { a: 3 }])).toEqual({ a: 3, b: 2 });
    expect(() => deepmerge.all('nope' as unknown as object[])).toThrow('first argument should be an array');
  });
});
