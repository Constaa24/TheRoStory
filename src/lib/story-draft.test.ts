import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '@/test/memory-storage';
import {
  clearStoryDrafts, draftKey, editorPathForKey, previewPath, pruneDrafts, readDraft, savedSince, writeDraft,
  DRAFT_MAX_AGE_MS,
} from './story-draft';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => { vi.unstubAllGlobals(); });

const copy = (savedAt: string, form: unknown = { title: 'x' }) => ({ v: 1 as const, savedAt, baseUpdatedAt: null, form });

describe('draftKey', () => {
  it('one copy per person, kind of story and story', () => {
    expect(draftKey('u1', 'text', 'art_1')).toBe('rostory_story_draft:u1:text:art_1');
    expect(draftKey('u1', 'video', null)).toBe('rostory_story_draft:u1:video:new');
  });
});

describe('readDraft', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');

  it('gives back what was written', () => {
    writeDraft('k', copy('2026-11-13T11:00:00Z'));
    expect(readDraft('k', now)?.form).toEqual({ title: 'x' });
  });

  it('drops a copy older than 30 days', () => {
    writeDraft('k', copy(new Date(now - DRAFT_MAX_AGE_MS - 1).toISOString()));
    expect(readDraft('k', now)).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('drops what it cannot read', () => {
    localStorage.setItem('a', '{not json');
    localStorage.setItem('b', JSON.stringify({ v: 2, savedAt: '2026-11-13T11:00:00Z', form: {} }));
    localStorage.setItem('c', JSON.stringify({ v: 1, savedAt: 'whenever', form: {} }));
    expect([readDraft('a', now), readDraft('b', now), readDraft('c', now)]).toEqual([null, null, null]);
    expect([localStorage.getItem('b'), localStorage.getItem('c')]).toEqual([null, null]);
  });

  it('is null when there is nothing, or no storage at all', () => {
    expect(readDraft('nothing', now)).toBeNull();
    vi.stubGlobal('localStorage', undefined);
    expect(readDraft('k', now)).toBeNull();
    expect(writeDraft('k', copy('2026-11-13T11:00:00Z'))).toBe(false);
  });
});

describe('pruneDrafts and clearStoryDrafts', () => {
  it('prunes only the old copies, and only copies', () => {
    const now = Date.parse('2026-11-13T12:00:00Z');
    writeDraft(draftKey('u1', 'text', 'old'), copy('2026-09-01T00:00:00Z'));
    writeDraft(draftKey('u1', 'text', 'fresh'), copy('2026-11-12T00:00:00Z'));
    localStorage.setItem('rostory_lang', 'ro');
    pruneDrafts(now);
    expect(localStorage.getItem(draftKey('u1', 'text', 'old'))).toBeNull();
    expect(localStorage.getItem(draftKey('u1', 'text', 'fresh'))).not.toBeNull();
    expect(localStorage.getItem('rostory_lang')).toBe('ro');
  });

  it("signing out takes that person's copies, and nobody else's", () => {
    writeDraft(draftKey('u1', 'text', 'a'), copy('2026-11-12T00:00:00Z'));
    writeDraft(draftKey('u1', 'video', null), copy('2026-11-12T00:00:00Z'));
    writeDraft(draftKey('u2', 'text', 'a'), copy('2026-11-12T00:00:00Z'));
    clearStoryDrafts('u1');
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem(draftKey('u2', 'text', 'a'))).not.toBeNull();
  });
});

describe('savedSince', () => {
  it('the story was saved again after the copy began', () => {
    expect(savedSince({ baseUpdatedAt: '2026-11-01T00:00:00Z' }, '2026-11-05T00:00:00Z')).toBe(true);
    expect(savedSince({ baseUpdatedAt: '2026-11-05T00:00:00Z' }, '2026-11-05T00:00:00Z')).toBe(false);
  });

  it('a new story, or one with no date, was not', () => {
    expect(savedSince({ baseUpdatedAt: null }, '2026-11-05T00:00:00Z')).toBe(false);
    expect(savedSince({ baseUpdatedAt: '2026-11-01T00:00:00Z' }, null)).toBe(false);
  });
});

describe('the preview’s addresses', () => {
  it('opens a story by kind and id, and leads back to its editor', () => {
    expect(previewPath('text', 'art_1')).toBe('/admin/preview?story=text%3Aart_1');
    expect(editorPathForKey('text:art_1')).toBe('/admin/text-story/edit/art_1');
    expect(editorPathForKey('video:new')).toBe('/admin/video-story/create');
    expect(editorPathForKey('carousel:art_2')).toBe('/admin/carousel-story/edit/art_2');
    expect(editorPathForKey('')).toBe('/admin/text-story/create');
  });
});
