import "server-only";

// Minimal fixed-window rate limiter for the AI routes — they spend real money
// (Anthropic tokens) per call, so an authenticated-but-abusive client
// shouldn't be able to loop them. In-memory per serverless instance: on
// Vercel this is per-lambda and best-effort rather than a hard global cap,
// which is proportionate for cost abuse (each instance still bounds the
// damage). Swap for Upstash/Redis if you need a strict global limit.

const buckets = new Map<string, { windowStart: number; count: number }>();
const MAX_BUCKETS = 10_000;

/**
 * Returns true when the caller is within `limit` calls per `windowMs` for
 * this key (use `${route}:${userId}`), false when they should get a 429.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    // Cheap sweep so abandoned keys don't accumulate forever.
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) {
        if (now - v.windowStart >= windowMs) buckets.delete(k);
      }
    }
    buckets.set(key, { windowStart: now, count: 1 });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export const RATE_LIMITED = { error: "Too many requests — give it a minute." };
