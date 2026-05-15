"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createBudgetSchema,
  updateBudgetSchema,
} from "@/lib/validations/finance";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createBudget(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createBudgetSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "budget", "create")) {
    return { error: "Sem permissao" };
  }

  // Normalize to the first day of the month so the (sector, category, month)
  // uniqueness constraint behaves predictably regardless of the day entered.
  const periodMonth = parsed.data.periodMonth.slice(0, 7) + "-01";

  const { data, error } = await supabase
    .from("finance_budgets")
    .insert({
      sector_id: parsed.data.sectorId,
      category: parsed.data.category,
      period_month: periodMonth,
      amount_cents: parsed.data.amountCents,
      currency: parsed.data.currency,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Ja existe um orcamento para esta categoria neste mes" };
    }
    return { error: error.message };
  }

  revalidatePath("/finance");
  return { data };
}

export async function updateBudget(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateBudgetSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("finance_budgets")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Orcamento nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "budget", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("finance_budgets")
    .update({ amount_cents: parsed.data.amountCents })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}

export async function deleteBudget(budgetId: string) {
  const parsed = z.string().uuid().safeParse(budgetId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: budget } = await supabase
    .from("finance_budgets")
    .select("sector_id")
    .eq("id", budgetId)
    .single();
  if (!budget) return { error: "Orcamento nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, budget.sector_id, "budget", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("finance_budgets")
    .update({ is_active: false })
    .eq("id", budgetId);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}
