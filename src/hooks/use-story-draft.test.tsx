import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Article } from '@/lib/supabase';
import { memoryStorage } from '@/test/memory-storage';
import { draftKey, readDraft, writeDraft, PREVIEW_CHANNEL, type PreviewMessage } from '@/lib/story-draft';
import { useStoryDraft } from './use-story-draft';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Form = { title: string };
const KEY = draftKey('u1', 'text', 's1');
const stored = () => readDraft<Form>(KEY)?.form.title ?? null;

/** An editor with one field, its saved value `saved`. */
let api: ReturnType<typeof useStoryDraft<Form>>;
let setTitle: (t: string) => void;
const Editor: React.FC<{ saved: string; updatedAt?: string | null; badPreview?: boolean }> = ({ saved, updatedAt = null, badPreview }) => {
  const [title, set] = useState(saved);
  setTitle = set;
  const form = { title };
  const snapshot = JSON.stringify(form);
  api = useStoryDraft<Form>({
    userId: 'u1', kind: 'text', storyId: 's1', ready: true, form, snapshot,
    dirty: snapshot !== JSON.stringify({ title: saved }),
    updatedAt,
    buildPreview: () => {
      if (badPreview && title.includes('?')) throw new Error('not a story yet');
      return { id: 's1', titleEn: title } as Article;
    },
    onRestore: (f) => set(f.title),
  });
  return <p>{title}</p>;
};

let container: HTMLDivElement;
let root: Root;
const mount = (el: React.ReactElement) => act(() => root.render(el));
const type = (t: string) => act(() => setTitle(t));
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the unsaved copy', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });

  it('follows unsaved changes, and goes when there are none', () => {
    mount(<Editor saved="A" />);
    type('B');
    expect(stored()).toBeNull();
    wait(700);
    expect(stored()).toBe('B');
    type('A');
    wait(700);
    expect(stored()).toBeNull();
  });

  it('is written at once when the tab is hidden', () => {
    mount(<Editor saved="A" />);
    type('B');
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(stored()).toBe('B');
  });

  it('is offered back, and restored', () => {
    writeDraft(KEY, { v: 1, savedAt: new Date().toISOString(), baseUpdatedAt: null, form: { title: 'Unsaved' } });
    mount(<Editor saved="A" />);
    expect(api.offer).toEqual({ savedAt: expect.any(String), savedSince: false });
    act(() => api.restore());
    expect(container.textContent).toBe('Unsaved');
    expect(api.offer).toBeNull();
    wait(700);
    expect(stored()).toBe('Unsaved');
  });

  it('says when the story was saved again after it', () => {
    writeDraft(KEY, { v: 1, savedAt: new Date().toISOString(), baseUpdatedAt: '2026-11-01T00:00:00Z', form: { title: 'Old' } });
    mount(<Editor saved="A" updatedAt="2026-11-05T00:00:00Z" />);
    expect(api.offer?.savedSince).toBe(true);
  });

  it('is never overwritten while the offer waits for an answer', () => {
    writeDraft(KEY, { v: 1, savedAt: new Date().toISOString(), baseUpdatedAt: null, form: { title: 'Old' } });
    mount(<Editor saved="A" />);
    type('New');
    wait(2000);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(stored()).toBe('Old');
  });

  it('discarded, it goes, and the new work is kept instead', () => {
    writeDraft(KEY, { v: 1, savedAt: new Date().toISOString(), baseUpdatedAt: null, form: { title: 'Old' } });
    mount(<Editor saved="A" />);
    act(() => api.dismiss());
    expect(stored()).toBeNull();
    type('New');
    wait(700);
    expect(stored()).toBe('New');
  });

  it('a copy that says nothing new is dropped unasked', () => {
    writeDraft(KEY, { v: 1, savedAt: new Date().toISOString(), baseUpdatedAt: null, form: { title: 'A' } });
    mount(<Editor saved="A" />);
    expect(api.offer).toBeNull();
    expect(stored()).toBeNull();
  });

  it('after a save or a discard (clear), nothing more is kept', () => {
    mount(<Editor saved="A" />);
    type('B');
    act(() => api.clear());
    wait(700);
    expect(stored()).toBeNull();
    expect(api.flush()).toBe(false);
  });

  it('on leaving, flush keeps unsaved work at once and says so', () => {
    mount(<Editor saved="A" />);
    type('B');
    expect(api.flush()).toBe(true);
    expect(stored()).toBe('B');
    type('A');
    expect(api.flush()).toBe(false);
    expect(stored()).toBeNull();
  });
});

describe('the preview', () => {
  /** A preview tab: asks for the story, collects what the editor sends. */
  const previewTab = () => {
    const ch = new BroadcastChannel(PREVIEW_CHANNEL);
    const got: PreviewMessage[] = [];
    ch.onmessage = (e: MessageEvent<PreviewMessage>) => { got.push(e.data); };
    return { got, ask: () => ch.postMessage({ type: 'want', key: 'text:s1' }), close: () => ch.close() };
  };
  const until = async (cond: () => boolean) => {
    for (let i = 0; i < 100 && !cond(); i++) await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(cond()).toBe(true);
  };
  const titles = (got: PreviewMessage[]) => got.flatMap((m) => (m.type === 'story' ? [m.article.titleEn] : []));

  it('answers a preview tab, follows the edits, and says when it closes', async () => {
    const tab = previewTab();
    mount(<Editor saved="A" />);
    tab.ask();
    await until(() => titles(tab.got).includes('A'));
    type('B');
    await until(() => titles(tab.got).includes('B'));
    expect(tab.got.find((m) => m.type === 'story' && m.article.titleEn === 'B')).toMatchObject({ dirty: true });
    act(() => root.unmount());
    await until(() => tab.got.some((m) => m.type === 'closed'));
    root = createRoot(container);
    tab.close();
  });

  it('a story half-written into something it can’t show yet keeps the last good version', async () => {
    const tab = previewTab();
    mount(<Editor saved="A" badPreview />);
    tab.ask();
    await until(() => titles(tab.got).includes('A'));
    type('B?');
    await act(() => new Promise((r) => setTimeout(r, 400)));
    type('B!');
    await until(() => titles(tab.got).includes('B!'));
    expect(titles(tab.got)).not.toContain('B?');
    tab.close();
  });
});
