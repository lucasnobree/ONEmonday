/**
 * Stateless anonymous Supabase client — for PUBLIC, unauthenticated routes.
 *
 * The public lead-capture endpoint (app/api/forms/[id]/route.ts) is reached by
 * visitors with no session and no cookies. It must NOT use the cookie-based
 * `createClient()` (there is nothing to read) and it must NOT use the
 * service-role client (that bypasses RLS — a public endpoint must stay inside
 * RLS).
 *
 * This client uses only the public anon key, so every query it runs is
 * governed by the `anon`-role RLS policies. For the lead lifecycle that means:
 *   * it can SELECT a published lead-capture form;
 *   * it can INSERT a brand-new `crm_leads` row tied to such a form;
 *   * it can do nothing else (migration 00128).
 *
 * Server-only.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Builds a stateless anon Supabase client (no session persistence). */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
