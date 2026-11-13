import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  PublishingFields, usePublishGuard, fromLocalInput, publishAtToSave, scheduleProblem, statusFrom, toLocalInput,
  type CheckItem,
} from './PublishingFields';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('toLocalInput / fromLocalInput', () => {
  it('turns an instant into a datetime-local value and back, to the minute', () => {
    const value = toLocalInput('2026-11-14T07:00:42.000Z');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromLocalInput(value)).toBe('2026-11-14T07:00:00.000Z');
  });

  it('is empty for nothing, and null for what is not a time', () => {
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput(undefined)).toBe('');
    expect(toLocalInput('not a date')).toBe('');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('tomorrow-ish')).toBeNull();
  });
});

describe('statusFrom', () => {
  it('published wins; a time makes a draft scheduled', () => {
    expect(statusFrom(true, '')).toBe('published');
    expect(statusFrom(true, '2026-12-01T09:00')).toBe('published');
    expect(statusFrom(false, '2026-12-01T09:00')).toBe('scheduled');
    expect(statusFrom(false, '')).toBe('draft');
  });
});

describe('scheduleProblem', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  const later = toLocalInput('2026-11-14T08:00:00Z');
  const earlier = toLocalInput('2026-11-13T08:00:00Z');

  it('has nothing to say unless the story is scheduled', () => {
    expect(scheduleProblem(true, earlier, 'en', now)).toBeNull();
    expect(scheduleProblem(false, '', 'en', now)).toBeNull();
  });

  it('a time to come is fine', () => {
    expect(scheduleProblem(false, later, 'en', now)).toBeNull();
  });

  it('a time gone by, or no time at all, is a problem, in either language', () => {
    expect(scheduleProblem(false, earlier, 'en', now)).toMatch(/passed/);
    expect(scheduleProblem(false, earlier, 'ro', now)).toMatch(/trecut/);
    expect(scheduleProblem(false, 'garbage', 'en', now)).toMatch(/Choose the day/);
  });
});

describe('publishAtToSave', () => {
  const at = toLocalInput('2026-12-01T07:00:00Z');

  it('a scheduled story saves its time', () => {
    expect(publishAtToSave(false, at, false)).toBe('2026-12-01T07:00:00.000Z');
  });

  it('clears a schedule the story had, once published or back to a draft', () => {
    expect(publishAtToSave(true, '', true)).toBeNull();
    expect(publishAtToSave(false, '', true)).toBeNull();
    // Published straight from "Scheduled": the time is dropped.
    expect(publishAtToSave(true, at, true)).toBeNull();
  });

  it('leaves the column alone for a story that never had a schedule', () => {
    expect(publishAtToSave(true, '', false)).toBeUndefined();
    expect(publishAtToSave(false, '', false)).toBeUndefined();
  });
});

describe('the Publishing block', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  const checklist: CheckItem[] = [
    { label: 'A title in English', done: true },
    { label: 'A cover picture', done: false },
  ];

  /** The block with its own state, as an editor holds it. */
  const Editor: React.FC<{ isAdmin: boolean; at?: string }> = ({ isAdmin, at = '' }) => {
    const [published, setPublished] = useState(false);
    const [publishAt, setPublishAt] = useState(at);
    return (
      <>
        <PublishingFields language="en" isAdmin={isAdmin} published={published} onPublished={setPublished} publishAt={publishAt} onPublishAt={setPublishAt} checklist={checklist} />
        <output data-testid="state">{JSON.stringify({ published, publishAt })}</output>
      </>
    );
  };
  const state = () => JSON.parse(container.querySelector('output')!.textContent!) as { published: boolean; publishAt: string };
  const radio = (value: string) => container.querySelector<HTMLInputElement>(`input[name="publish-status"][value="${value}"]`)!;

  it('"Scheduled" proposes tomorrow at nine, and "Published" or "Draft" drops the time', () => {
    act(() => root.render(<Editor isAdmin />));
    expect(radio('draft').checked).toBe(true);
    expect(container.querySelector('#publish-at')).toBeNull();

    act(() => radio('scheduled').click());
    const nine = new Date();
    nine.setDate(nine.getDate() + 1);
    nine.setHours(9, 0, 0, 0);
    expect(state()).toEqual({ published: false, publishAt: toLocalInput(nine.toISOString()) });
    expect(container.querySelector<HTMLInputElement>('#publish-at')!.value).toBe(toLocalInput(nine.toISOString()));
    expect(container.textContent).toContain('A draft until then.');

    act(() => radio('published').click());
    expect(state()).toEqual({ published: true, publishAt: '' });
    expect(container.textContent).toContain('Readers can see it.');

    act(() => radio('draft').click());
    expect(state()).toEqual({ published: false, publishAt: '' });
  });

  it('says so at once when the time has passed', () => {
    act(() => root.render(<Editor isAdmin at={toLocalInput(new Date(Date.now() - 3_600_000).toISOString())} />));
    const input = container.querySelector<HTMLInputElement>('#publish-at')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(container.textContent).toContain('That time has passed.');
  });

  it('a writer sees where the story stands, and no controls', () => {
    act(() => root.render(<Editor isAdmin={false} />));
    expect(container.querySelector('input[name="publish-status"]')).toBeNull();
    expect(container.textContent).toContain('A draft. An editor publishes it.');
  });

  it('the list says what is there and what is missing, to screen readers too', () => {
    act(() => root.render(<Editor isAdmin />));
    const items = [...container.querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual(['A title in English (done)', 'A cover picture (missing)']);
  });
});

describe('usePublishGuard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  const Save: React.FC<{ goingOut: boolean; checklist: CheckItem[]; save: () => void }> = ({ goingOut, checklist, save }) => {
    const { guard, dialog } = usePublishGuard({ language: 'en', goingOut, scheduled: false, checklist });
    return (<>{dialog}<button type="button" onClick={() => guard(save)}>Save</button></>);
  };
  const button = (name: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === name);

  it('asks once before a story goes out with something missing, then saves', () => {
    const save = vi.fn();
    act(() => root.render(<Save goingOut checklist={[{ label: 'A cover picture', done: false }]} save={save} />));
    act(() => button('Save')!.click());
    expect(save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('A few things are missing.');
    expect(document.body.textContent).toContain('A cover picture');

    act(() => button('Publish anyway')!.click());
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('"Keep editing" saves nothing', () => {
    const save = vi.fn();
    act(() => root.render(<Save goingOut checklist={[{ label: 'A cover picture', done: false }]} save={save} />));
    act(() => button('Save')!.click());
    act(() => button('Keep editing')!.click());
    expect(save).not.toHaveBeenCalled();
  });

  it('saves straight away when nothing is missing, or the story is not going out', () => {
    const save = vi.fn();
    act(() => root.render(<Save goingOut checklist={[{ label: 'A cover picture', done: true }]} save={save} />));
    act(() => button('Save')!.click());
    act(() => root.render(<Save goingOut={false} checklist={[{ label: 'A cover picture', done: false }]} save={save} />));
    act(() => button('Save')!.click());
    expect(save).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toContain('A few things are missing.');
  });
});
