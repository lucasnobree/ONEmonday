"use server";

/**
 * Legal status-workflow server actions.
 *
 * - `applyContractApproval` runs the lightweight contract approval step
 *   (submit-for-approval / approve / reject) over the existing contract
 *   statuses, enforcing the transition set in `lib/legal/status-history`.
 * - `changeMatterStatus` advances a matter's status directly from the detail
 *   sheet (no full edit dialog).
 *
 * Both write an append-only `legal_status_history` row so the detail sheet can
 * surface a who/when/from->to audit trail (Wave 4 audit C1/C4).
 */

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  contractApprovalSchema,
  matterStatusChangeSchema,
} from "@/lib/validations/legal";
import { applyApprovalAction } from "@/lib/legal/status-history";
import { revalidatePath } from "next/cache";

/** Statuses that count as terminal for a matter — used to stamp `resolved_at`. */
const TERMINAL_MATTER_STATUSES = new Set(["resolved", "closed"]);

export async function applyContractApproval(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = contractApprovalSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.action === "reject" && !parsed.data.note?.trim()) {
    return { error: "Informe o motivo da rejeição" };
  }

  const { data: existing } = await supabase
    .from("legal_contracts")
    .select("sector_id, status")
    .eq("id", parsed.data.contractId)
    .single();
  if (!existing) return { error: "Contrato não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "contract", "update")) {
    return { error: "Sem permissão" };
  }

  const nextStatus = applyApprovalAction(existing.status, parsed.data.action);
  if (nextStatus === null) {
    return { error: "Ação inválida para o status atual do contrato" };
  }

  // Optimistic-concurrency guard: only transition if the status is still what
  // we validated against, so two concurrent approvers cannot both apply.
  const { data: updated, error } = await supabase
    .from("legal_contracts")
    .update({ status: nextStatus })
    .eq("id", parsed.data.contractId)
    .eq("status", existing.status)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return { error: "O status do contrato mudou. Recarregue e tente novamente." };
  }

  const { error: historyError } = await supabase
    .from("legal_status_history")
    .insert({
      entity_type: "contract",
      entity_id: parsed.data.contractId,
      sector_id: existing.sector_id,
      from_status: existing.status,
      to_status: nextStatus,
      note: parsed.data.note?.trim() || null,
      changed_by: user.id,
    });
  if (historyError) return { error: historyError.message };

  revalidatePath("/legal");
  revalidatePath("/legal/contracts");
  return { success: true, status: nextStatus };
}

export async function changeMatterStatus(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = matterStatusChangeSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("legal_matters")
    .select("sector_id, status, resolved_at")
    .eq("id", parsed.data.matterId)
    .single();
  if (!existing) return { error: "Demanda não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "legal_matter", "update")) {
    return { error: "Sem permissão" };
  }

  if (existing.status === parsed.data.status) {
    return { error: "A demanda já está nesse status" };
  }

  const isTerminal = TERMINAL_MATTER_STATUSES.has(parsed.data.status);
  const resolvedAt = isTerminal
    ? (existing.resolved_at ?? new Date().toISOString())
    : null;

  // Optimistic-concurrency guard: the matter must still hold the status we read.
  const { data: updated, error } = await supabase
    .from("legal_matters")
    .update({ status: parsed.data.status, resolved_at: resolvedAt })
    .eq("id", parsed.data.matterId)
    .eq("status", existing.status)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return { error: "O status da demanda mudou. Recarregue e tente novamente." };
  }

  const { error: historyError } = await supabase
    .from("legal_status_history")
    .insert({
      entity_type: "matter",
      entity_id: parsed.data.matterId,
      sector_id: existing.sector_id,
      from_status: existing.status,
      to_status: parsed.data.status,
      note: parsed.data.note?.trim() || null,
      changed_by: user.id,
    });
  if (historyError) return { error: historyError.message };

  revalidatePath("/legal");
  revalidatePath("/legal/matters");
  return { success: true };
}
