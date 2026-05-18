/**
 * In-memory, fixed-window rate limiter for the public lead-capture endpoint.
 *
 * The public form-submission route (app/api/forms/[id]/route.ts) is
 * unauthenticated, so it is the one CRM surface a bot can hammer. A real
 * deployment should sit this behind an edge WAF / a shared store (Redis), but
 * an in-process limiter is a cheap, dependency-free first line that blunts a
 * naive flood without affecting a legitimate visitor (a human submits a form
 * a handful of times, not dozens per minute).
 *
 * Pure and testable: the clock is injectable.
 */

/** One caller's request timestamps within the current observation period. */
interface Bucket {
  /** Epoch-ms timestamps of recent hits, oldest first. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Max submissions allowed per key inside {@link WINDOW_MS}. */
export const RATE_LIMIT_MAX = 5;
/** The sliding window length, in milliseconds. */
export const WINDOW_MS = 60_000;

export interface RateLimitResult {
  /** Whether this request is allowed through. */
  allowed: boolean;
  /** Hits remaining in the current window after this request. */
  remaining: number;
  /** Epoch-ms when the window resets (the oldest hit ages out). */
  resetAt: number;
}

/**
 * Record a hit for `key` and report whether it is within the limit.
 *
 * @param key   The rate-limit key (e.g. client IP, or IP + form id).
 * @param now   Current time in epoch-ms (injectable for tests).
 * @param max   Override the per-window cap.
 * @param windowMs Override the window length.
 */
export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  max: number = RATE_LIMIT_MAX,
  windowMs: number = WINDOW_MS
): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [] };
  // Drop hits that have aged out of the window.
  const cutoff = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= max) {
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.hits[0] + windowMs,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: max - bucket.hits.length,
    resetAt: bucket.hits[0] + windowMs,
  };
}

/** Clears all rate-limit state — test-only helper. */
export function resetRateLimitState(): void {
  buckets.clear();
}
