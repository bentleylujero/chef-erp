/**
 * In-memory sliding-window rate limiter.
 *
 * For single-instance deployments (Vercel serverless, single Node process).
 * Swap for Redis-backed limiter (e.g. @upstash/ratelimit) when scaling to
 * multiple instances.
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterConfig {
  /** Max requests in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Periodic cleanup to prevent memory leaks — runs every 60s per store
const cleanupIntervals = new Set<string>();

function ensureCleanup(storeName: string, windowMs: number) {
  if (cleanupIntervals.has(storeName)) return;
  cleanupIntervals.add(storeName);

  setInterval(() => {
    const store = stores.get(storeName);
    if (!store) return;
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.lastRefill > windowMs * 2) {
        store.delete(key);
      }
    }
  }, 60_000).unref();
}

export function createRateLimiter(name: string, config: RateLimiterConfig) {
  const store = new Map<string, RateLimitEntry>();
  stores.set(name, store);
  ensureCleanup(name, config.windowMs);

  return {
    check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now - entry.lastRefill >= config.windowMs) {
        // New window — full tokens minus this request
        store.set(key, { tokens: config.limit - 1, lastRefill: now });
        return { allowed: true, remaining: config.limit - 1, resetMs: config.windowMs };
      }

      if (entry.tokens <= 0) {
        const resetMs = config.windowMs - (now - entry.lastRefill);
        return { allowed: false, remaining: 0, resetMs };
      }

      entry.tokens -= 1;
      const resetMs = config.windowMs - (now - entry.lastRefill);
      return { allowed: true, remaining: entry.tokens, resetMs };
    },
  };
}

// Pre-configured limiters
export const apiLimiter = createRateLimiter("api", {
  limit: 100,
  windowMs: 60_000, // 100 req/min
});

export const aiLimiter = createRateLimiter("ai", {
  limit: 20,
  windowMs: 60_000, // 20 AI calls/min
});

export const authLimiter = createRateLimiter("auth", {
  limit: 10,
  windowMs: 60_000, // 10 auth attempts/min
});
