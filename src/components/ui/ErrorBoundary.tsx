import React from "react";

/** A dynamic import that failed: the chunk is missing (stale build) or the network dropped. */
export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error &&
  /dynamically imported module|Failed to fetch|importing a module script|module script/i.test(error.message);

type ErrorBoundaryProps = {
  fallback: React.ReactNode | ((error: Error) => React.ReactNode);
  children: React.ReactNode;
  /** When this changes (the page's path), a caught error is cleared. */
  resetKey?: string;
};
type ErrorBoundaryState = { error: Error | null; retrying: boolean };

/** How soon a second error counts as "the retry failed too". */
const RETRY_WINDOW_MS = 5000;

/**
 * Catches a render error below it. A one-off error (a browser extension or
 * the browser's own translator rewriting the page under React, a race in a
 * fast sequence of taps) is retried once by drawing the page afresh, which
 * the reader barely notices: the Atlas, for one, keeps its whole view in the
 * address. Only an error that comes straight back shows the fallback, and
 * moving to another page clears it, instead of leaving every page broken
 * until a reload.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // `declare` avoids useDefineForClassFields conflict with React 19 types
  declare state: ErrorBoundaryState;
  declare props: Readonly<ErrorBoundaryProps>;
  private lastRetryAt = 0;
  private retryTimer: number | undefined;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, retrying: false };
  }
  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    const now = Date.now();
    // A chunk that failed to load fails again on a retry; it needs the
    // reload the fallback offers (lazyWithReload has already tried one).
    if (isChunkLoadError(error) || now - this.lastRetryAt < RETRY_WINDOW_MS) return;
    this.lastRetryAt = now;
    this.setState({ retrying: true });
    this.retryTimer = window.setTimeout(() => this.setState({ error: null, retrying: false }), 0);
  }
  override componentDidUpdate(prev: ErrorBoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      window.clearTimeout(this.retryTimer);
      this.setState({ error: null, retrying: false });
    }
  }
  override componentWillUnmount() {
    window.clearTimeout(this.retryTimer);
  }
  override render() {
    const { error, retrying } = this.state;
    if (!error) return this.props.children;
    if (retrying) return null;
    const { fallback } = this.props;
    return typeof fallback === "function" ? fallback(error) : fallback;
  }
}
