// Shared in-memory rate limiter for all edge functions.
//
// The store survives across requests on a warm instance; a cold start
// resets the budget. That's acceptable for every current consumer: the
// goal is to blunt scripted abuse (contact-form spam, view-count
// inflation, confirmation-email bombing), not to be a bulletproof gate.
//
// Each function passes a distinct `globalKey` so limiters never share a
// bucket even if two functions are ever bundled into one isolate.

type RateLimitStore = Map<string, number[]>;

export type RateLimiterOptions = {
  /** Unique per function, e.g. "__rostoryContactRateLimit". */
  globalKey: string;
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Max requests per key inside the window. */
  max: number;
  /**
   * Cap on tracked keys so a long-lived instance can't grow the map
   * unbounded under a flood of distinct keys. Once past the threshold,
   * keys whose timestamps are all older than the window are dropped
   * (they'd reset anyway).
   */
  sweepThreshold?: number;
};

export function getClientIp(req: Request): string {
  // Supabase Edge sits behind its own proxy, which sets x-real-ip /
  // x-forwarded-for from the actual client. Headers like cf-connecting-ip
  // are NOT trustworthy here — a client can send any value and we'd bucket
  // them into a fresh rate-limit slot. Only trust headers the platform
  // populates.
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // The leftmost entry is the original client (RFC 7239). Subsequent
    // entries are intermediate proxies. The Supabase ingress overwrites
    // any client-supplied prefix before this code runs.
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    return parts[0] || "unknown";
  }
  return "unknown";
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { globalKey, windowMs, max, sweepThreshold = 5000 } = options;

  const getStore = (): RateLimitStore => {
    const g = globalThis as typeof globalThis & Record<string, RateLimitStore | undefined>;
    if (!g[globalKey]) g[globalKey] = new Map();
    return g[globalKey] as RateLimitStore;
  };

  const sweep = (store: RateLimitStore, now: number): void => {
    if (store.size < sweepThreshold) return;
    for (const [key, timestamps] of store) {
      if (timestamps.every((ts) => now - ts >= windowMs)) store.delete(key);
    }
  };

  /** Records a hit for `key` and reports whether it is now over budget. */
  const isRateLimited = (key: string): boolean => {
    const store = getStore();
    const now = Date.now();
    sweep(store, now);
    const recent = (store.get(key) || []).filter((ts) => now - ts < windowMs);
    recent.push(now);
    store.set(key, recent);
    return recent.length > max;
  };

  return { isRateLimited };
}
