/**
 * In-memory token bucket, keyed by embedKey+visitorId (not IP alone —
 * many visitors share IP via corporate NAT). Single-process only, which
 * is fine for local dev; flagged for a Redis-backed implementation before
 * any real deployment with multiple server instances.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  bucket.count += 1;
  return true;
}
