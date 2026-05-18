import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Coverage for the credential connectivity test (Wave 5 — W20).
 *
 * Before Wave 5 a typo'd Teams webhook / wrong WhatsApp token failed silently
 * forever — there was no way to verify a saved credential. `testIntegrationCredential`
 * builds the provider adapter from the stored secret and sends a sample
 * message, surfacing the provider's real success/failure.
 */

/** Configurable adapter send result for the active test. */
let adapterSend = vi.fn();

vi.mock("@/lib/integrations/registry", () => ({
  resolveProvider: () => ({
    provider: "teams",
    channel: "teams",
    isConfigured: () => true,
    send: adapterSend,
  }),
}));

vi.mock("@/lib/integrations/crypto", () => ({
  encryptSecretJson: vi.fn(),
  assertProductionKey: vi.fn(),
  decryptSecretJson: () => ({ webhookUrl: "https://hook.example" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/permissions/engine", () => ({
  getUserPermissions: async () => ({ isGlobalAdmin: true }),
  hasPermission: () => true,
}));

/** The credential row the supabase stub returns. */
let credentialRow: Record<string, unknown> | null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
    },
    from() {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: credentialRow }),
      };
      return builder;
    },
  }),
}));

import { testIntegrationCredential } from "./credentials";

describe("testIntegrationCredential", () => {
  beforeEach(() => {
    adapterSend = vi.fn();
    credentialRow = {
      provider: "teams",
      sector_id: "s1",
      secret: "ciphertext",
      metadata: {},
      is_enabled: true,
    };
  });

  it("reports ok when the provider accepts the sample message", async () => {
    adapterSend.mockResolvedValue({ ok: true });
    const result = await testIntegrationCredential({
      id: "7c515a5c-9e93-43e1-b329-a4d78f40b2da",
    });
    expect(result.ok).toBe(true);
    expect(adapterSend).toHaveBeenCalledOnce();
  });

  it("surfaces a provider rejection as a failure with the reason", async () => {
    adapterSend.mockResolvedValue({ ok: false, error: "404 webhook não existe" });
    const result = await testIntegrationCredential({
      id: "7c515a5c-9e93-43e1-b329-a4d78f40b2da",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("404");
  });

  it("reports noop when the adapter runs without a secret", async () => {
    adapterSend.mockResolvedValue({ ok: true, noop: true });
    const result = await testIntegrationCredential({
      id: "7c515a5c-9e93-43e1-b329-a4d78f40b2da",
    });
    expect(result.noop).toBe(true);
  });

  it("rejects a missing credential", async () => {
    credentialRow = null;
    const result = await testIntegrationCredential({
      id: "7c515a5c-9e93-43e1-b329-a4d78f40b2da",
    });
    expect(result.error).toBe("Credencial nao encontrada");
    expect(adapterSend).not.toHaveBeenCalled();
  });

  it("rejects a disabled credential before sending", async () => {
    credentialRow = { ...credentialRow!, is_enabled: false };
    const result = await testIntegrationCredential({
      id: "7c515a5c-9e93-43e1-b329-a4d78f40b2da",
    });
    expect(result.error).toContain("desativada");
    expect(adapterSend).not.toHaveBeenCalled();
  });

  it("requires a destination number for the whatsapp provider", async () => {
    credentialRow = { ...credentialRow!, provider: "whatsapp" };
    const result = await testIntegrationCredential({
      id: "7c515a5c-9e93-43e1-b329-a4d78f40b2da",
    });
    expect(result.error).toContain("WhatsApp");
    expect(adapterSend).not.toHaveBeenCalled();
  });
});
