"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createContractSchema,
  updateContractSchema,
} from "@/lib/validations/legal";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Maps the parsed/validated contract form into a DB row payload. */
function toRow(data: z.infer<typeof createContractSchema>) {
  return {
    title: data.title,
    counterparty: data.counterparty,
    contract_type: data.contractType,
    status: data.status,
    renewal_type: data.renewalType,
    notice_period_days: data.noticePeriodDays,
    value_amount: data.valueAmount ?? null,
    currency: data.currency,
    effective_date: data.effectiveDate || null,
    expiry_date: data.expiryDate || null,
    owner_id: data.ownerId || null,
    description: data.description || null,
  };
}

export async function createContract(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createContractSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "contract", "create")) {
    return { error: "Sem permissão" };
  }

  const { data: contract, error } = await supabase
    .from("legal_contracts")
    .insert({
      sector_id: parsed.data.sectorId,
      created_by: user.id,
      ...toRow(parsed.data),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Seed the status history with the creation entry (from_status NULL).
  await supabase.from("legal_status_history").insert({
    entity_type: "contract",
    entity_id: contract.id,
    sector_id: parsed.data.sectorId,
    from_status: null,
    to_status: contract.status,
    changed_by: user.id,
  });

  revalidatePath("/legal");
  revalidatePath("/legal/contracts");
  return { data: contract };
}

export async function updateContract(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = updateContractSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("legal_contracts")
    .select("sector_id, status")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Contrato não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "contract", "update")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("legal_contracts")
    .update(toRow(parsed.data))
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  // Record a status-history entry when the edit changed the status (audit C1).
  if (existing.status !== parsed.data.status) {
    await supabase.from("legal_status_history").insert({
      entity_type: "contract",
      entity_id: parsed.data.id,
      sector_id: existing.sector_id,
      from_status: existing.status,
      to_status: parsed.data.status,
      changed_by: user.id,
    });
  }

  revalidatePath("/legal");
  revalidatePath("/legal/contracts");
  return { success: true };
}

export async function deleteContract(contractId: string) {
  const idParsed = z.string().uuid().safeParse(contractId);
  if (!idParsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: existing } = await supabase
    .from("legal_contracts")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Contrato não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "contract", "delete")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("legal_contracts")
    .update({ is_active: false })
    .eq("id", idParsed.data);

  if (error) return { error: error.message };

  revalidatePath("/legal");
  revalidatePath("/legal/contracts");
  return { success: true };
}
