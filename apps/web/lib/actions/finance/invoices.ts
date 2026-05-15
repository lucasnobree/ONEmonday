"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
} from "@/lib/validations/finance";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createInvoice(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createInvoiceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "invoice", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("finance_invoices")
    .insert({
      sector_id: parsed.data.sectorId,
      number: parsed.data.number,
      customer_name: parsed.data.customerName,
      description: parsed.data.description || null,
      amount_cents: parsed.data.amountCents,
      currency: parsed.data.currency,
      status: parsed.data.status,
      issue_date: parsed.data.issueDate,
      due_date: parsed.data.dueDate,
      paid_at: parsed.data.status === "paid" ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { data };
}

export async function updateInvoice(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateInvoiceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("finance_invoices")
    .select("sector_id, status, paid_at")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Fatura nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "invoice", "update")) {
    return { error: "Sem permissao" };
  }

  // Stamp paid_at the first time an invoice transitions into "paid".
  let paidAt = existing.paid_at as string | null;
  if (parsed.data.status === "paid" && !paidAt) {
    paidAt = new Date().toISOString();
  } else if (parsed.data.status !== "paid") {
    paidAt = null;
  }

  const { error } = await supabase
    .from("finance_invoices")
    .update({
      number: parsed.data.number,
      customer_name: parsed.data.customerName,
      description: parsed.data.description || null,
      amount_cents: parsed.data.amountCents,
      currency: parsed.data.currency,
      status: parsed.data.status,
      issue_date: parsed.data.issueDate,
      due_date: parsed.data.dueDate,
      paid_at: paidAt,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}

export async function deleteInvoice(invoiceId: string) {
  const parsed = z.string().uuid().safeParse(invoiceId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: invoice } = await supabase
    .from("finance_invoices")
    .select("sector_id")
    .eq("id", invoiceId)
    .single();
  if (!invoice) return { error: "Fatura nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, invoice.sector_id, "invoice", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("finance_invoices")
    .update({ is_active: false })
    .eq("id", invoiceId);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}
