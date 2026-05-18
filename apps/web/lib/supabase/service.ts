/**
 * Supabase service-role client — for inbound webhook routes only.
 *
 * Inbound webhooks (app/api/webhooks/*) arrive with no user session, so they
 * cannot use the cookie-based `createClient()`. They run with the service-role
 * key, which BYPASSES Row Level Security
 * (docs/research/migration-architecture.md §1.2c). Therefore every webhook
 * route MUST enforce its own scoping in code and verify the provider
 * signature before writing anything.
 *
 * The service-role key is read from `SUPABASE_SERVICE_ROLE_KEY` — a server-only
 * secret that is NEVER exposed to the browser and NEVER prefixed `NEXT_PUBLIC_`.
 * When unset, `hasServiceRoleKey()` returns false and webhook routes degrade to
 * a safe 503 instead of crashing — dev environments run without it.
 *
 * Server-only.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** True when the service-role key is configured (production webhook support). */
export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Builds a service-role Supabase client. Throws when the key is missing —
 * callers should gate on {@link hasServiceRoleKey} first.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL must be set for " +
        "inbound webhook processing."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
