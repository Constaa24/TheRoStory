import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: string; message?: string };
  return (
    err.name === 'AbortError' ||
    err.message?.includes('aborted') === true ||
    err.message === 'signal is aborted without reason'
  );
}

/**
 * Logs an error with a context label, but skips silent abort errors
 * (which fire normally when an in-flight request is replaced by a newer one).
 */
export function logError(context: string, error: unknown): void {
  if (isAbortError(error)) return;
  console.error(`[${context}]`, error);
}
