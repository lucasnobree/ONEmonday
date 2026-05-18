/**
 * Server-side credential resolution for the integration layer.
 *
 * Resolves the `integration_credentials` row for a channel + sector, decrypts
 * its secret, and returns a {@link ResolvedCredential} ready to build an
 * adapter. A sector credential is preferred; a global credential (sector_id
 * NULL) is the fallback — exactly mirroring the registry's resolution intent.
 *
 * Server-only — it decrypts secrets.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntegrationChannel } from "./types";
import type { ResolvedCredential } from "./dispatch";
import { decryptSecretJson } from "./crypto";

/** Provider slug that backs each outbound channel. */
const CHANNEL_PROVIDER: Record<string, string> = {
  teams: "teams",
  whatsapp: "whatsapp",
};

interface CredentialRow {
  secret: string | null;
  metadata: Record<string, unknown> | null;
  is_enabled: boolean;
}

/**
 * Loads and decrypts the credential for `channel` in `sectorId`. Returns null
 * when no enabled credential row exists. A disabled row also resolves to null.
 *
 * `client` may be the cookie client (RLS-scoped) or the service-role client
 * (webhook context) — both expose the same query surface.
 */
export async function loadCredentialFor(
  client: SupabaseClient,
  channel: IntegrationChannel,
  sectorId: string | null
): Promise<ResolvedCredential | null> {
  if (channel === "in_app") return null;
  const provider = CHANNEL_PROVIDER[channel];
  if (!provider) return null;

  // Prefer the sector-specific credential, then fall back to the global one.
  const candidates: (string | null)[] =
    sectorId === null ? [null] : [sectorId, null];

  for (const candidate of candidates) {
    const query = client
      .from("integration_credentials")
      .select("secret, metadata, is_enabled")
      .eq("provider", provider)
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
    return { secret, metadata: data.metadata ?? {} };
  }

  return null;
}
