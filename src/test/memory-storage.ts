/**
 * A localStorage for tests. Under Node 26 the jsdom environment has none
 * (Node's own global shadows it and needs --localstorage-file), so tests
 * that touch storage install this: vi.stubGlobal('localStorage', memoryStorage()).
 */
export const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  const store = {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  };
  return store as unknown as Storage;
};
