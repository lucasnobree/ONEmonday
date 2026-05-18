/**
 * Accountant export — Phase 4 internal financial management
 * (docs/research/migration-contabilidade.md backlog #14).
 *
 * Builds a single categorized transaction list the external accountant can
 * import. ONEmonday is the source of *input* data; the accountant still files
 * SPED/ECD/ECF and the formal books (migration-architecture.md §3) — this
 * export is the bridge, not a replacement for that work.
 *
 * Pure functions over invoice / expense rows — no DB, fully testable. Amounts
 * are emitted both as integer cents and as a `pt-BR` major-unit string so the
 * CSV is both machine- and human-readable.
 */
import type { Invoice } from "@/hooks/finance/use-invoices";
import type { Expense } from "@/hooks/finance/use-expenses";
import { fromCents } from "./money";

/** One row of the accountant export — a single categorized cash movement. */
export interface AccountingExportRow {
  /** "receita" (an invoice) or "despesa" (an expense). */
  type: "receita" | "despesa";
  /** Cash date — when the money actually moved (paid_at, date-only). */
  date: string;
  /** Accounting category — the invoice's number or the expense's category. */
  category: string;
  /** Counterparty — customer (receita) or vendor (despesa). */
  party: string;
  description: string;
  amountCents: number;
  /** Signed major-unit amount, `pt-BR` formatted: receita +, despesa -. */
  amount: string;
  currency: string;
}

/** Formats integer cents as a signed plain `pt-BR` decimal (no currency mark). */
function formatSigned(cents: number, sign: 1 | -1): string {
  const major = fromCents(cents * sign);
  return major.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** The `paid_at` timestamp reduced to its date-only `YYYY-MM-DD` part. */
function paidDate(paidAt: string | null): string | null {
  if (!paidAt) return null;
  return paidAt.slice(0, 10);
}

/**
 * Builds the categorized accountant export for a period.
 *
 * Only *paid* invoices and expenses with a `paid_at` inside [from, to]
 * (inclusive, date-only) are included — the export is cash-basis, matching the
 * management DRE. Rows are sorted by date ascending. `from`/`to` are
 * `YYYY-MM-DD` strings.
 */
export function buildAccountingExport(
  invoices: Invoice[],
  expenses: Expense[],
  from: string,
  to: string
): AccountingExportRow[] {
  const rows: AccountingExportRow[] = [];

  for (const inv of invoices) {
    if (inv.status !== "paid") continue;
    const date = paidDate(inv.paid_at);
    if (!date || date < from || date > to) continue;
    rows.push({
      type: "receita",
      date,
      category: `Fatura ${inv.number}`,
      party: inv.customer_name,
      description: inv.description ?? "",
      amountCents: inv.amount_cents,
      amount: formatSigned(inv.amount_cents, 1),
      currency: inv.currency,
    });
  }

  for (const exp of expenses) {
    if (exp.status !== "paid") continue;
    const date = paidDate(exp.paid_at);
    if (!date || date < from || date > to) continue;
    rows.push({
      type: "despesa",
      date,
      category: exp.category,
      party: exp.vendor_name,
      description: exp.description ?? "",
      amountCents: exp.amount_cents,
      amount: formatSigned(exp.amount_cents, -1),
      currency: exp.currency,
    });
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

/** The net cash movement (receitas minus despesas) of an export. */
export function accountingExportNetCents(rows: AccountingExportRow[]): number {
  return rows.reduce(
    (net, r) =>
      net + (r.type === "receita" ? r.amountCents : -r.amountCents),
    0
  );
}
