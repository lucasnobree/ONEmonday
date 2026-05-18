"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  type InvoiceLineItemInput,
} from "@/lib/validations/finance";
import { invoiceTotalCents, lineTotalCents } from "@/lib/finance/line-items";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Replaces the persisted line items of an invoice with `lines`, and returns
 * the invoice amount the lines imply (their integer-cent sum). Line items are
 * fully rewritten on every save — simple and correct for the small line counts
 * a real invoice has.
 */
async function syncLineItems(
  supabase: SupabaseClient,
  invoiceId: string,
  sectorId: string,
  lines: InvoiceLineItemInput[]
): Promise<{ error?: string; totalCents: number }> {
  // Remove the existing lines before reinserting.
  const { error: deleteError } = await supabase
    .from("finance_invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId);
  if (deleteError) return { error: deleteError.message, totalCents: 0 };

  if (lines.length === 0) return { totalCents: 0 };

  const rows = lines.map((line, index) => ({
    invoice_id: invoiceId,
    sector_id: sectorId,
    description: line.description,
    quantity_milli: line.quantityMilli,
    unit_price_cents: line.unitPriceCents,
    line_total_cents: lineTotalCents(line.quantityMilli, line.unitPriceCents),
    position: index,
  }));

  const { error: insertError } = await supabase
    .from("finance_invoice_line_items")
    .insert(rows);
  if (insertError) return { error: insertError.message, totalCents: 0 };

  return { totalCents: invoiceTotalCents(lines) };
}

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

  const lines = parsed.data.lineItems ?? [];
  // When the invoice is itemized the amount is derived from the lines; the
  // free-typed amountCents is ignored to keep header and lines consistent.
  const amountCents =
    lines.length > 0 ? invoiceTotalCents(lines) : parsed.data.amountCents;
  if (amountCents <= 0) {
    return { error: "Valor da fatura deve ser maior que zero" };
  }

  const { data, error } = await supabase
    .from("finance_invoices")
    .insert({
      sector_id: parsed.data.sectorId,
      number: parsed.data.number,
      customer_name: parsed.data.customerName,
      description: parsed.data.description || null,
      amount_cents: amountCents,
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

  if (lines.length > 0) {
    const synced = await syncLineItems(
      supabase,
      data.id,
      parsed.data.sectorId,
      lines
    );
    if (synced.error) return { error: synced.error };
  }

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

  // `lineItems` undefined => leave the existing lines untouched.
  // `lineItems` present => rewrite them and derive the amount from their sum.
  let amountCents = parsed.data.amountCents;
  if (parsed.data.lineItems !== undefined) {
    const synced = await syncLineItems(
      supabase,
      parsed.data.id,
      existing.sector_id,
      parsed.data.lineItems
    );
    if (synced.error) return { error: synced.error };
    if (parsed.data.lineItems.length > 0) amountCents = synced.totalCents;
  }
  if (amountCents <= 0) {
    return { error: "Valor da fatura deve ser maior que zero" };
  }

  const { error } = await supabase
    .from("finance_invoices")
    .update({
      number: parsed.data.number,
      customer_name: parsed.data.customerName,
      description: parsed.data.description || null,
      amount_cents: amountCents,
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
