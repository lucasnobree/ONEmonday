/**
 * Shared-secret guard for the internal cron-trigger routes.
 *
 * The `app/api/cron/*` routes invoke privileged worker logic (the notification
 * outbox dispatcher, the marketing-sequence runner) with the service-role
 * Supabase client — they MUST NOT be publicly callable. They are reached by a
 * `pg_cron` job that `POST`s with a shared secret, so authentication is a
 * constant-time compare of that secret rather than a user session.
 *
 * The expected secret is read from the server-only `CRON_SECRET` env var. When
 * it is unset the routes fail closed (every request is rejected) — a
 * misconfigured deploy never exposes the workers anonymously.
 *
 * The caller presents the secret either as a bearer token
 * (`Authorization: Bearer <secret>`) or in the `x-cron-secret` header — the
 * `pg_net` call in the migration uses the bearer form.
 *
 * Server-only — uses Node's `crypto`.
 */
import { timingSafeEqual } from "node:crypto";

/** Constant-time string comparison that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** True when a server-side `CRON_SECRET` is configured. */
export function hasCronSecret(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

/**
 * Extracts the presented secret from a request's headers. Accepts an
 * `Authorization: Bearer <secret>` header or a raw `x-cron-secret` header.
 * Returns an empty string when neither is present.
 */
export function extractPresentedSecret(headers: Headers): string {
  const auth = headers.get("authorization");
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match) return match[1].trim();
  }
  return headers.get("x-cron-secret")?.trim() ?? "";
}

/**
 * Verifies a cron request against the configured `CRON_SECRET`. Fails closed
 * when the secret is unset or the presented value is empty / wrong. The
 * comparison is constant-time so it never leaks the secret via timing.
 */
export function isAuthorizedCronRequest(headers: Headers): boolean {
  const expected = process.env.CRON_SECRET?.trim() ?? "";
  if (!expected) return false;
  const presented = extractPresentedSecret(headers);
  if (!presented) return false;
  return safeEqual(expected, presented);
}
