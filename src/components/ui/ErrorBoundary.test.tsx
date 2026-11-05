import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ErrorBoundary, isChunkLoadError } from './ErrorBoundary';

// React's act() needs this flag to know it is running under a test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // React and the boundary both log caught errors; keep the output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Only the boundary's retry timer; React's own scheduler stays real.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A page that throws while `state.broken` is true. */
const makeFlaky = (message = 'boom') => {
  const state = { broken: true };
  const Flaky: React.FC = () => {
    if (state.broken) throw new Error(message);
    return <p>page</p>;
  };
  return { Flaky, state };
};

const fallback = (error: Error) => <p>fallback: {error.message}</p>;

const settle = () => act(() => { vi.runAllTimers(); });

describe('ErrorBoundary', () => {
  it('draws the page again after a one-off error, without showing the fallback', () => {
    const { Flaky, state } = makeFlaky();
    act(() => root.render(<ErrorBoundary fallback={fallback}><Flaky /></ErrorBoundary>));
    expect(container.textContent).toBe('');
    state.broken = false;
    settle();
    expect(container.textContent).toBe('page');
  });

  it('shows the fallback, with the error, when the retry fails too', () => {
    const { Flaky } = makeFlaky();
    act(() => root.render(<ErrorBoundary fallback={fallback}><Flaky /></ErrorBoundary>));
    settle();
    expect(container.textContent).toBe('fallback: boom');
  });

  it('does not retry a chunk that failed to load', () => {
    const { Flaky, state } = makeFlaky('Failed to fetch dynamically imported module: /assets/Map-x.js');
    act(() => root.render(<ErrorBoundary fallback={fallback}><Flaky /></ErrorBoundary>));
    // Even if a retry would now succeed, there must not be one.
    state.broken = false;
    settle();
    expect(container.textContent).toContain('fallback: Failed to fetch dynamically imported module');
  });

  it('clears the error when the reader moves to another page', () => {
    const Broken: React.FC = () => { throw new Error('always'); };
    act(() => root.render(<ErrorBoundary resetKey="/map" fallback={fallback}><Broken /></ErrorBoundary>));
    settle();
    expect(container.textContent).toBe('fallback: always');
    act(() => root.render(<ErrorBoundary resetKey="/categories" fallback={fallback}><p>next page</p></ErrorBoundary>));
    expect(container.textContent).toBe('next page');
  });

  it('accepts a plain node as the fallback', () => {
    const Broken: React.FC = () => { throw new Error('always'); };
    act(() => root.render(<ErrorBoundary fallback={<p>plain</p>}><Broken /></ErrorBoundary>));
    settle();
    expect(container.textContent).toBe('plain');
  });
});

describe('isChunkLoadError', () => {
  it.each([
    ['Failed to fetch dynamically imported module: https://therostory.com/assets/Map-C-dV9xlK.js', true],
    ['Importing a module script failed.', true],
    ["Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of \"text/html\"", true],
    ["Cannot read properties of undefined (reading 'x')", false],
  ])('%s → %s', (message, expected) => {
    expect(isChunkLoadError(new Error(message))).toBe(expected);
  });

  it('is false for things that are not errors', () => {
    expect(isChunkLoadError('Failed to fetch')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
