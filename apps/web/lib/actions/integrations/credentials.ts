"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  upsertCredentialSchema,
  deleteCredentialSchema,
  testCredentialSchema,
  secretSchemaForProvider,
} from "@/lib/validations/integrations";
import {
  encryptSecretJson,
  assertProductionKey,
  decryptSecretJson,
} from "@/lib/integrations/crypto";
import { resolveProvider } from "@/lib/integrations/registry";
import type { ProviderSlug } from "@/lib/integrations/types";
import { revalidatePath } from "next/cache";

/**
 * Integration-credential server actions.
 *
 * Secrets are encrypted with AES-256-GCM (lib/integrations/crypto.ts) BEFORE
 * the DB write — `integration_credentials.secret` only ever holds ciphertext.
 * A global credential (`sectorId === null`) requires global-admin; a sector
 * credential requires the `integration`/`manage` permission in that sector.
 */

/** Authorises the caller for a credential write in `sectorId`. */
async function authorize(sectorId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" as const };

  const perms = await getUserPermissions(user.id);
  if (sectorId === null) {
    if (!perms.isGlobalAdmin) return { error: "Sem permissao" as const };
  } else if (!hasPermission(perms, sectorId, "integration", "manage")) {
    return { error: "Sem permissao" as const };
  }
  return { supabase, userId: user.id };
}

/** Creates or updates an integration credential, encrypting the secret. */
export async function upsertIntegrationCredential(formData: unknown) {
  const parsed = upsertCredentialSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const auth = await authorize(parsed.data.sectorId);
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  // Validate the secret against the provider-specific shape.
  let encryptedSecret: string | null = null;
  if (parsed.data.secret && Object.keys(parsed.data.secret).length > 0) {
    const secretParsed = secretSchemaForProvider(parsed.data.provider).safeParse(
      parsed.data.secret
    );
    if (!secretParsed.success) {
      return { error: { secret: ["Configuracao de secret invalida"] } };
    }
    // Drop empty-string fields so an "unconfigured" save stays unconfigured.
    const cleaned = Object.fromEntries(
      Object.entries(secretParsed.data).filter(
        ([, v]) => typeof v === "string" && v.length > 0
      )
    );
    if (Object.keys(cleaned).length > 0) {
      assertProductionKey();
      encryptedSecret = encryptSecretJson(cleaned);
    }
  }

  // Look for an existing active row for (sector, provider) — upsert by hand
  // since the unique index uses a COALESCE expression.
  const existingQuery = supabase
    .from("integration_credentials")
    .select("id")
    .eq("provider", parsed.data.provider)
    .eq("is_active", true);
  if (parsed.data.sectorId === null) {
    existingQuery.is("sector_id", null);
  } else {
    existingQuery.eq("sector_id", parsed.data.sectorId);
  }
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const update: Record<string, unknown> = {
      capability: parsed.data.capability,
      metadata: parsed.data.metadata,
      is_enabled: parsed.data.isEnabled,
    };
    // Only overwrite the secret when a new one was supplied.
    if (encryptedSecret !== null) update.secret = encryptedSecret;

    const { error } = await supabase
      .from("integration_credentials")
      .update(update)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("integration_credentials").insert({
      sector_id: parsed.data.sectorId,
      provider: parsed.data.provider,
      capability: parsed.data.capability,
      secret: encryptedSecret,
      metadata: parsed.data.metadata,
      is_enabled: parsed.data.isEnabled,
      created_by: userId,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/settings/integrations");
  return { success: true };
}

/** Soft-deletes an integration credential. */
export async function deleteIntegrationCredential(formData: unknown) {
  const parsed = deleteCredentialSchema.safeParse(formData);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: row } = await supabase
    .from("integration_credentials")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!row) return { error: "Credencial nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (row.sector_id === null) {
    if (!perms.isGlobalAdmin) return { error: "Sem permissao" };
  } else if (!hasPermission(perms, row.sector_id, "integration", "manage")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("integration_credentials")
    .update({ is_active: false, is_enabled: false })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/settings/integrations");
  return { success: true };
}

/** Result of a credential connectivity test. */
export interface TestCredentialResult {
  /** Validation/permission/lookup failure — the test never ran. */
  error?: string;
  /** True when the provider accepted the sample message. */
  ok?: boolean;
  /**
   * True when the credential has no secret and the adapter ran in no-op mode —
   * the configuration was reached but nothing was actually delivered.
   */
  noop?: boolean;
  /** Human-readable detail (provider error message, or a success note). */
  message?: string;
}

/**
 * Performs a real connectivity check for a saved integration credential
 * (Wave 5 — W20). It decrypts the stored secret, builds the provider adapter,
 * and sends a sample message — surfacing the provider's actual success or
 * failure instead of letting a typo'd webhook / wrong token fail silently.
 *
 * Never throws: an unconfigured credential resolves to `noop`, a provider
 * rejection to `ok: false` with the reason.
 */
export async function testIntegrationCredential(
  formData: unknown
): Promise<TestCredentialResult> {
  const parsed = testCredentialSchema.safeParse(formData);
  if (!parsed.success) return { error: "Dados inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: row } = await supabase
    .from("integration_credentials")
    .select("provider, sector_id, secret, metadata, is_enabled")
    .eq("id", parsed.data.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!row) return { error: "Credencial nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (row.sector_id === null) {
    if (!perms.isGlobalAdmin) return { error: "Sem permissao" };
  } else if (!hasPermission(perms, row.sector_id, "integration", "manage")) {
    return { error: "Sem permissao" };
  }

  if (!row.is_enabled) {
    return { error: "Credencial desativada — reative-a antes de testar" };
  }

  // Decrypt the stored secret. A corrupt/absent secret means no-op mode.
  let secret: Record<string, unknown> | null = null;
  if (row.secret) {
    try {
      secret = decryptSecretJson(row.secret);
    } catch {
      return { error: "Não foi possível ler o segredo da credencial" };
    }
  }

  if (row.provider === "whatsapp" && !parsed.data.target) {
    return {
      error: "Informe um número de WhatsApp de destino para o teste",
    };
  }

  let adapter;
  try {
    adapter = resolveProvider(row.provider as ProviderSlug, {
      secret,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Provedor desconhecido",
    };
  }

  const result = await adapter.send({
    title: "Teste de integração ONEmonday",
    body: "Esta é uma mensagem de teste enviada a partir das Configurações › Integrações. Se você recebeu isto, a credencial está funcionando.",
    target: parsed.data.target,
    eventType: "integration_test",
  });

  if (result.noop) {
    return {
      noop: true,
      message:
        "Credencial sem segredo — o adaptador rodou em modo no-op e nada foi enviado.",
    };
  }
  if (result.ok) {
    return {
      ok: true,
      message: "Mensagem de teste enviada com sucesso.",
    };
  }
  return {
    ok: false,
    error: result.error ?? "Falha ao enviar a mensagem de teste",
  };
}
