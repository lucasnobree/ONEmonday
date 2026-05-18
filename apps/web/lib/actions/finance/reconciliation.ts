"use server";

/**
 * Bank-reconciliation server actions — Phase 4.
 *
 *   * `importOfxStatement` — manual OFX-file fallback: parses an uploaded OFX
 *     and inserts its transactions, skipping any already imported.
 *   * `syncBankTransactions` — pulls transactions via the Open Finance
 *     aggregator (Pluggy). No-op when the aggregator is unconfigured.
 *   * `reconcileTransaction` — links a bank transaction to one invoice or one
 *     expense (the user-confirmed match).
 *
 * Same write-path shape as the rest of the finance module.
 */
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  importOfxSchema,
  reconcileTransactionSchema,
} from "@/lib/validations/finance";
import { parseOfx } from "@/lib/finance/ofx";
import { loadFinanceCredential } from "@/lib/integrations/finance-credential-loader";
import {
  resolveBankingAdapter,
  DEFAULT_BANKING_PROVIDER,
} from "@/lib/integrations/finance-registry";
import { z } from "zod";
import { revalidatePath } from "next/cache";

/** Inserts {@link BankTransaction}-shaped rows, skipping existing dedup keys. */
async function insertTransactions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sectorId: string,
  userId: string,
  source: "ofx" | "pluggy",
  transactions: {
    externalId: string;
    direction: "credit" | "debit";
    amountCents: number;
    currency: string;
    postedDate: string;
    description: string;
    accountLabel?: string;
  }[]
): Promise<{ imported: number; skipped: number }> {
  if (transactions.length === 0) return { imported: 0, skipped: 0 };

  // Find which external ids already exist for this sector + source.
  const { data: existing } = await supabase
    .from("finance_bank_transactions")
    .select("external_id")
    .eq("sector_id", sectorId)
    .eq("source", source)
    .eq("is_active", true)
    .in(
      "external_id",
      transactions.map((t) => t.externalId)
    );
  const seen = new Set((existing ?? []).map((r) => r.external_id as string));

  const fresh = transactions.filter((t) => !seen.has(t.externalId));
  if (fresh.length === 0) {
    return { imported: 0, skipped: transactions.length };
  }

  const { error } = await supabase.from("finance_bank_transactions").insert(
    fresh.map((t) => ({
      sector_id: sectorId,
      source,
      external_id: t.externalId,
      direction: t.direction,
      amount_cents: t.amountCents,
      currency: t.currency,
      posted_date: t.postedDate,
      description: t.description,
      account_label: t.accountLabel ?? null,
      match_status: "unmatched",
      created_by: userId,
    }))
  );
  if (error) throw new Error(error.message);

  return { imported: fresh.length, skipped: transactions.length - fresh.length };
}

export async function importOfxStatement(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = importOfxSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "transaction", "create")) {
    return { error: "Sem permissao" };
  }

  const transactions = parseOfx(parsed.data.ofxContent);
  if (transactions.length === 0) {
    return { error: "Nenhuma transacao encontrada no arquivo OFX" };
  }

  try {
    const summary = await insertTransactions(
      supabase,
      parsed.data.sectorId,
      user.id,
      "ofx",
      transactions
    );
    revalidatePath("/finance");
    return { data: summary };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Falha ao importar OFX",
    };
  }
}

export async function syncBankTransactions(formData: unknown) {
  const schema = z.object({
    sectorId: z.string().uuid(),
    accountId: z.string().min(1),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  const parsed = schema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "transaction", "create")) {
    return { error: "Sem permissao" };
  }

  const credential = await loadFinanceCredential(
    supabase,
    "banking",
    parsed.data.sectorId
  );
  const provider = credential.provider ?? DEFAULT_BANKING_PROVIDER;
  const adapter = resolveBankingAdapter(provider, credential.config);

  const result = await adapter.fetchTransactions(
    parsed.data.accountId,
    parsed.data.from,
    parsed.data.to
  );

  if (!result.ok) {
    return { error: result.error ?? "Falha ao sincronizar com o banco" };
  }

  if (result.noop) {
    return {
      data: { imported: 0, skipped: 0 },
      noop: true,
      message:
        "Agregador Open Finance nao configurado. Use a importacao de OFX.",
    };
  }

  try {
    const summary = await insertTransactions(
      supabase,
      parsed.data.sectorId,
      user.id,
      "pluggy",
      result.transactions
    );
    revalidatePath("/finance");
    return { data: summary, noop: false };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Falha ao salvar transacoes",
    };
  }
}

export async function reconcileTransaction(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = reconcileTransactionSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: tx } = await supabase
    .from("finance_bank_transactions")
    .select("id, sector_id, direction, match_status")
    .eq("id", parsed.data.transactionId)
    .eq("is_active", true)
    .single();
  if (!tx) return { error: "Transacao nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, tx.sector_id, "transaction", "update")) {
    return { error: "Sem permissao" };
  }

  // A credit reconciles to an invoice; a debit reconciles to an expense.
  if (parsed.data.invoiceId && tx.direction !== "credit") {
    return { error: "Uma fatura so concilia com uma entrada (credito)" };
  }
  if (parsed.data.expenseId && tx.direction !== "debit") {
    return { error: "Uma despesa so concilia com uma saida (debito)" };
  }

  // Verify the counterpart belongs to the same sector.
  if (parsed.data.invoiceId) {
    const { data: inv } = await supabase
      .from("finance_invoices")
      .select("sector_id")
      .eq("id", parsed.data.invoiceId)
      .single();
    if (!inv || inv.sector_id !== tx.sector_id) {
      return { error: "Fatura invalida para esta conciliacao" };
    }
  } else if (parsed.data.expenseId) {
    const { data: exp } = await supabase
      .from("finance_expenses")
      .select("sector_id")
      .eq("id", parsed.data.expenseId)
      .single();
    if (!exp || exp.sector_id !== tx.sector_id) {
      return { error: "Despesa invalida para esta conciliacao" };
    }
  }

  const { error } = await supabase
    .from("finance_bank_transactions")
    .update({
      match_status: "matched",
      matched_invoice_id: parsed.data.invoiceId ?? null,
      matched_expense_id: parsed.data.expenseId ?? null,
      matched_by: user.id,
      matched_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.transactionId);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}

export async function unreconcileTransaction(transactionId: string) {
  const parsed = z.string().uuid().safeParse(transactionId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: tx } = await supabase
    .from("finance_bank_transactions")
    .select("sector_id")
    .eq("id", transactionId)
    .single();
  if (!tx) return { error: "Transacao nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, tx.sector_id, "transaction", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("finance_bank_transactions")
    .update({
      match_status: "unmatched",
      matched_invoice_id: null,
      matched_expense_id: null,
      matched_by: null,
      matched_at: null,
    })
    .eq("id", transactionId);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}
