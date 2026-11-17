/**
 * Where to take a reader after signing in.
 *
 * Signing in used to end on the home page whatever started it, so a reader
 * who pressed "Save to your shelf" or "Leave a note" on a story lost the
 * story. The page they were on is kept for the length of the tab
 * (sessionStorage: it has to survive the full-page trip to /auth, and to
 * Google and back) and taken, once, when the sign-in completes.
 *
 * Only a path inside this site is ever kept or followed: it must start with
 * a single "/" (never "//host" or a backslash, which browsers resolve as
 * another site), and never the sign-in pages themselves.
 */

const KEY = "rostory_return_to";
const AUTH_PAGES = /^\/(?:auth|reset-password)(?:[/?#]|$)/;

/** The path if it is safe to send a reader to, else null. In-app paths, without the /ro prefix. */
export const safeReturnPath = (path: unknown): string | null => {
  if (typeof path !== "string" || path.length > 500) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (AUTH_PAGES.test(path)) return null;
  return path;
};

/** Keeps `path` as the place to come back to (or forgets it, if it isn't a safe one). */
export const rememberReturnPath = (path: string): void => {
  const safe = safeReturnPath(path);
  try {
    if (safe) sessionStorage.setItem(KEY, safe);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the reader lands on the home page, as before */
  }
};

/** The place to come back to, once: reading it forgets it. */
export const takeReturnPath = (): string | null => {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return safeReturnPath(value);
  } catch {
    return null;
  }
};
