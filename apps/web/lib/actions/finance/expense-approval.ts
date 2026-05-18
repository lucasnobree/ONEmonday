"use server";

/**
 * Expense approval-workflow server action.
 *
 * Applies a workflow transition (submit / approve / reject / pay / void /
 * reopen) to an expense. The legal transition set lives in
 * `lib/finance/expense-approval`; this action enforces it server-side together
 * with the permission bar:
 *  - approve / reject  require `expense:approve` (managers / admins only).
 *  - submit / pay / void / reopen require `expense:update`.
 */
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { expenseTransitionSchema } from "@/lib/validations/finance";
import {
  applyTransition,
  transitionNeedsApprovalPermission,
  type ExpenseStatus,
} from "@/lib/finance/expense-approval";
import { revalidatePath } from "next/cache";

export async function transitionExpense(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = expenseTransitionSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  if (parsed.data.transition === "reject" && !parsed.data.reason?.trim()) {
    return { error: "Informe o motivo da rejeicao" };
  }

  const { data: existing } = await supabase
    .from("finance_expenses")
    .select("sector_id, status, paid_at")
    .eq("id", parsed.data.id)
    .eq("is_active", true)
    .single();
  if (!existing) return { error: "Despesa nao encontrada" };

  const perms = await getUserPermissions(user.id);
  // Approving / rejecting needs the dedicated `approve` permission; every
  // other transition needs ordinary `update`.
  const requiredAction = transitionNeedsApprovalPermission(
    parsed.data.transition
  )
    ? "approve"
    : "update";
  if (!hasPermission(perms, existing.sector_id, "expense", requiredAction)) {
    return { error: "Sem permissao" };
  }

  const nextStatus = applyTransition(
    existing.status as ExpenseStatus,
    parsed.data.transition
  );
  if (nextStatus === null) {
    return { error: "Transicao invalida para o status atual" };
  }

  // Build the patch: status always changes; the approval-tracking fields are
  // set/cleared to reflect the new state.
  const patch: Record<string, unknown> = { status: nextStatus };

  if (parsed.data.transition === "approve") {
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
    patch.rejection_reason = null;
  } else if (parsed.data.transition === "reject") {
    patch.approved_by = null;
    patch.approved_at = null;
    patch.rejection_reason = parsed.data.reason?.trim() ?? null;
  } else if (parsed.data.transition === "reopen") {
    patch.approved_by = null;
    patch.approved_at = null;
    patch.rejection_reason = null;
  }

  // Keep paid_at consistent with the original create/update actions.
  if (nextStatus === "paid") {
    patch.paid_at = existing.paid_at ?? new Date().toISOString();
  } else {
    patch.paid_at = null;
  }

  const { error } = await supabase
    .from("finance_expenses")
    .update(patch)
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true, status: nextStatus };
}
