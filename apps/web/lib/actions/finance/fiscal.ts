"use server";

/**
 * Fiscal-emission server action — Phase 4 (NF-e / NFS-e).
 *
 * Requests emission of a fiscal document for an invoice through the configured
 * fiscal gateway (Focus NFe). Follows the established write-path shape:
 * createClient -> getUser -> safeParse -> permission check -> adapter call ->
 * DB write -> revalidatePath.
 *
 * Honest constraint: real emission needs a Focus NFe account and an A1 digital
 * certificate the company must supply. With no credential the adapter runs in
 * no-op mode — the fiscal document is recorded as a `draft` and a clear
 * "gateway nao configurado" message is returned. Nothing crashes; nothing
 * fake-claims a document was authorised.
 */
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { emitFiscalDocumentSchema } from "@/lib/validations/finance";
import { loadFinanceCredential } from "@/lib/integrations/finance-credential-loader";
import {
  resolveFiscalAdapter,
  DEFAULT_FISCAL_PROVIDER,
} from "@/lib/integrations/finance-registry";
import { revalidatePath } from "next/cache";

export async function emitFiscalDocument(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = emitFiscalDocumentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  // The invoice is the document being emitted — load it for sector + amount.
  const { data: invoice } = await supabase
    .from("finance_invoices")
    .select("id, sector_id, number, customer_name, description, amount_cents")
    .eq("id", parsed.data.invoiceId)
    .eq("is_active", true)
    .single();
  if (!invoice) return { error: "Fatura nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, invoice.sector_id, "invoice", "update")) {
    return { error: "Sem permissao" };
  }

  // Idempotency key — deterministic per invoice + doc type so a retry never
  // double-emits at the gateway.
  const reference = `inv-${invoice.id}-${parsed.data.docType}`;

  // Resolve the fiscal gateway credential (no-op mode when unconfigured).
  const credential = await loadFinanceCredential(
    supabase,
    "fiscal",
    invoice.sector_id
  );
  const provider = credential.provider ?? DEFAULT_FISCAL_PROVIDER;
  const adapter = resolveFiscalAdapter(provider, credential.config);

  const result = await adapter.emit({
    reference,
    docType: parsed.data.docType,
    amountCents: invoice.amount_cents,
    description: invoice.description ?? invoice.number,
    customerName: invoice.customer_name,
  });

  // No-op mode -> the document is a draft pending configuration. A real
  // failure -> recorded as error. Otherwise carry the gateway status.
  const status = result.noop
    ? "draft"
    : result.ok
      ? result.status
      : "error";

  const { data: doc, error } = await supabase
    .from("finance_fiscal_documents")
    .upsert(
      {
        sector_id: invoice.sector_id,
        invoice_id: invoice.id,
        doc_type: parsed.data.docType,
        provider,
        reference,
        status,
        provider_ref: result.providerRef ?? null,
        protocol: result.protocol ?? null,
        access_key: result.accessKey ?? null,
        pdf_url: result.pdfUrl ?? null,
        xml_url: result.xmlUrl ?? null,
        status_reason: result.noop
          ? "Gateway fiscal nao configurado — documento em rascunho"
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
    data: doc,
    noop: result.noop ?? false,
    message: result.noop
      ? "Gateway fiscal nao configurado. Documento salvo como rascunho."
      : undefined,
  };
}
