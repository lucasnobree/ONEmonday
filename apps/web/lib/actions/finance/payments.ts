"use server";

/**
 * Payment-charge server action — Phase 4 (boleto / PIX).
 *
 * Generates a boleto / PIX charge for an invoice through the configured PSP
 * (Asaas). Same write-path shape as the rest of the finance module.
 *
 * Honest constraint: real charge issuance needs an Asaas merchant account the
 * company must open. With no credential the adapter runs in no-op mode — the
 * charge is recorded as a `draft` and a clear message is returned. Nothing
 * crashes; nothing fake-claims a charge was issued.
 */
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createPaymentChargeSchema } from "@/lib/validations/finance";
import { loadFinanceCredential } from "@/lib/integrations/finance-credential-loader";
import {
  resolvePaymentAdapter,
  DEFAULT_PAYMENT_PROVIDER,
} from "@/lib/integrations/finance-registry";
import { revalidatePath } from "next/cache";

export async function createPaymentCharge(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createPaymentChargeSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: invoice } = await supabase
    .from("finance_invoices")
    .select(
      "id, sector_id, number, customer_name, description, amount_cents, currency, due_date"
    )
    .eq("id", parsed.data.invoiceId)
    .eq("is_active", true)
    .single();
  if (!invoice) return { error: "Fatura nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, invoice.sector_id, "invoice", "update")) {
    return { error: "Sem permissao" };
  }

  // Idempotency key — deterministic per invoice + billing type.
  const reference = `inv-${invoice.id}-${parsed.data.billingType}`;

  const credential = await loadFinanceCredential(
    supabase,
    "payments",
    invoice.sector_id
  );
  const provider = credential.provider ?? DEFAULT_PAYMENT_PROVIDER;
  const adapter = resolvePaymentAdapter(provider, credential.config);

  const result = await adapter.createCharge({
    reference,
    billingType: parsed.data.billingType,
    amountCents: invoice.amount_cents,
    currency: invoice.currency,
    dueDate: invoice.due_date,
    customerName: invoice.customer_name,
    description: invoice.description ?? `Fatura ${invoice.number}`,
  });

  const status = result.noop
    ? "draft"
    : result.ok
      ? result.status
      : "error";

  const { data: charge, error } = await supabase
    .from("finance_payment_charges")
    .upsert(
      {
        sector_id: invoice.sector_id,
        invoice_id: invoice.id,
        provider,
        billing_type: parsed.data.billingType,
        reference,
        amount_cents: invoice.amount_cents,
        currency: invoice.currency,
        due_date: invoice.due_date,
        status,
        provider_ref: result.providerRef ?? null,
        boleto_line: result.boletoLine ?? null,
        pix_payload: result.pixPayload ?? null,
        invoice_url: result.invoiceUrl ?? null,
        status_reason: result.noop
          ? "PSP nao configurado — cobranca em rascunho"
          : (result.reason ?? null),
        last_payload: { result },
        created_by: user.id,
        is_active: true,
      },
      { onConflict: "provider,reference" }
    )
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return {
    data: charge,
    noop: result.noop ?? false,
    message: result.noop
      ? "PSP de pagamentos nao configurado. Cobranca salva como rascunho."
      : undefined,
  };
}
