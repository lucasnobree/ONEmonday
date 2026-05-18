/**
 * Server-side credential resolution for the Phase-5 email gateway.
 *
 * Mirrors `finance-credential-loader.ts`: resolves the `integration_credentials`
 * row for the `email` capability in a sector, decrypts its secret, and returns
 * an {@link EmailAdapterConfig} ready to build a {@link ResendAdapter}. A
 * sector-specific credential is preferred; a global credential (sector_id NULL)
 * is the fallback.
 *
 * Always resolves — when nothing is configured it returns
 * `{ provider: null, config: { secret: null } }` so the caller builds an
 * adapter in no-op mode. A missing ESP account never crashes anything.
 *
 * Server-only — it decrypts secrets.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailAdapterConfig } from "./email-types";
import { decryptSecretJson } from "./crypto";

interface CredentialRow {
  provider: string;
  secret: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * The resolved email credential: the provider slug plus an
 * {@link EmailAdapterConfig}. `provider` is null when no credential row exists
 * — callers fall back to the default email provider in no-op mode.
 */
export interface ResolvedEmailCredential {
  provider: string | null;
  config: EmailAdapterConfig;
}

/**
 * Loads and decrypts the `email`-capability credential for `sectorId`. A
 * sector-specific row wins over a global one. Always resolves — when nothing
 * is configured it returns a no-op config.
 */
export async function loadEmailCredential(
  client: SupabaseClient,
  sectorId: string
): Promise<ResolvedEmailCredential> {
  // Prefer the sector-specific credential, then fall back to the global one.
  const candidates: (string | null)[] = [sectorId, null];

  for (const candidate of candidates) {
    const query = client
      .from("integration_credentials")
      .select("provider, secret, metadata")
      .eq("capability", "email")
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
        // Corrupt / undecryptable secret — treat as unconfigured (no-op mode).
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
