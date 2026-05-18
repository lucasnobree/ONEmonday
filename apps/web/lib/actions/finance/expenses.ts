"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createExpenseSchema,
  updateExpenseSchema,
} from "@/lib/validations/finance";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createExpense(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createExpenseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "expense", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("finance_expenses")
    .insert({
      sector_id: parsed.data.sectorId,
      vendor_name: parsed.data.vendorName,
      description: parsed.data.description || null,
      category: parsed.data.category,
      amount_cents: parsed.data.amountCents,
      currency: parsed.data.currency,
      status: parsed.data.status,
      expense_date: parsed.data.expenseDate,
      due_date: parsed.data.dueDate ?? null,
      paid_at: parsed.data.status === "paid" ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { data };
}

export async function updateExpense(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateExpenseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("finance_expenses")
    .select("sector_id, paid_at")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Despesa nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "expense", "update")) {
    return { error: "Sem permissao" };
  }

  let paidAt = existing.paid_at as string | null;
  if (parsed.data.status === "paid" && !paidAt) {
    paidAt = new Date().toISOString();
  } else if (parsed.data.status !== "paid") {
    paidAt = null;
  }

  const { error } = await supabase
    .from("finance_expenses")
    .update({
      vendor_name: parsed.data.vendorName,
      description: parsed.data.description || null,
      category: parsed.data.category,
      amount_cents: parsed.data.amountCents,
      currency: parsed.data.currency,
      status: parsed.data.status,
      expense_date: parsed.data.expenseDate,
      due_date: parsed.data.dueDate ?? null,
      paid_at: paidAt,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}

export async function deleteExpense(expenseId: string) {
  const parsed = z.string().uuid().safeParse(expenseId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: expense } = await supabase
    .from("finance_expenses")
    .select("sector_id")
    .eq("id", expenseId)
    .single();
  if (!expense) return { error: "Despesa nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, expense.sector_id, "expense", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("finance_expenses")
    .update({ is_active: false })
    .eq("id", expenseId);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}
