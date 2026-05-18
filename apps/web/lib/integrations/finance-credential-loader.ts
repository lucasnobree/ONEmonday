/**
 * Server-side credential resolution for the Phase-4 finance gateways.
 *
 * Mirrors `credential-loader.ts` (messaging): resolves the
 * `integration_credentials` row for a fiscal / banking / payment provider in a
 * sector, decrypts its secret, and returns an {@link AdapterConfig} ready to
 * build an adapter. A sector credential is preferred; a global credential
 * (sector_id NULL) is the fallback.
 *
 * Returns a config with `secret: null` when no enabled credential exists — the
 * adapter then runs in no-op mode, so a missing provider account never crashes
 * anything.
 *
 * Server-only — it decrypts secrets.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdapterConfig } from "./finance-types";
import { decryptSecretJson } from "./crypto";

/** Integration capabilities backed by a Phase-4 finance adapter. */
export type FinanceCapability = "fiscal" | "banking" | "payments";

interface CredentialRow {
  provider: string;
  secret: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * The resolved credential for a finance capability: the provider slug plus an
 * {@link AdapterConfig}. `provider` is null when no credential row exists —
 * callers fall back to the capability's default provider in no-op mode.
 */
export interface ResolvedFinanceCredential {
  provider: string | null;
  config: AdapterConfig;
}

/**
 * Loads and decrypts the credential for `capability` in `sectorId`. A
 * sector-specific row wins over a global one. Always resolves — when nothing
 * is configured it returns `{ provider: null, config: { secret: null } }` so
 * the caller builds an adapter in no-op mode.
 */
export async function loadFinanceCredential(
  client: SupabaseClient,
  capability: FinanceCapability,
  sectorId: string
): Promise<ResolvedFinanceCredential> {
  // Prefer the sector-specific credential, then fall back to the global one.
  const candidates: (string | null)[] = [sectorId, null];

  for (const candidate of candidates) {
    const query = client
      .from("integration_credentials")
      .select("provider, secret, metadata")
      .eq("capability", capability)
      .eq("is_active", true)
      .eq("is_enabled", true);
    if (candidate === null) {
      query.is("sector_id", null);
    } else {
      query.eq("sector_id", candidate);
    }
    const { data } = await query.maybeSingle<CredentialRow>();
    if (!data) continue;

    let secret: Record<string, unknown> | null = null;
    if (data.secret) {
      try {
        secret = decryptSecretJson(data.secret);
      } catch {
        // Corrupt/undecryptable secret — treat as unconfigured (no-op mode).
        secret = null;
      }
    }
    return {
      provider: data.provider,
      config: { secret, metadata: data.metadata ?? {} },
    };
  }

  // Nothing configured — no-op mode.
  return { provider: null, config: { secret: null, metadata: {} } };
}
