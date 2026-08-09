/**
 * Simple in-memory rate limiter.
 * Works per-serverless-instance (no Redis). Prevents single-IP bursts.
 * For global rate limiting, upgrade to Upstash Redis later.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Clean up expired buckets every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * @param ip      Client IP address
 * @param limit   Max requests per window (default 10)
 * @param windowMs Window duration in ms (default 60s)
 * @returns true if allowed, false if rate-limited
 */
export function checkRateLimit(
  ip: string,
  limit = 10,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const bucket = store.get(ip);

  if (!bucket || bucket.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/** Extract the real client IP from Next.js request headers */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
