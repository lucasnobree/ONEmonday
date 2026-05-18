/**
 * Management DRE / P&L — Phase 4 internal financial management
 * (docs/research/migration-contabilidade.md backlog #5).
 *
 * This builds a *management* income statement for internal decision-making:
 * revenue minus expenses, grouped by category, with the net result and a
 * margin. It is NOT the official Demonstração de Resultado do Exercício filed
 * with the books — SPED/ECD/ECF and the formal DRE stay with the accountant
 * (migration-contabilidade.md §5.2).
 *
 * Pure functions over the `get_finance_dre` RPC payload — fully testable. All
 * amounts stay integer cents.
 */
import { sumCents } from "./money";
import type { ExpenseCategory } from "@/hooks/finance/use-expenses";

/** One category line of the expense side of the DRE. */
export interface DreCategoryLine {
  category: ExpenseCategory;
  amountCents: number;
  /** Share of total expenses, 0-100, rounded — 0 when there are no expenses. */
  sharePercent: number;
}

/** Raw shape returned by the `get_finance_dre` RPC. */
export interface DrePayload {
  revenue_cents: number;
  expense_total_cents: number;
  expense_by_category: { category: ExpenseCategory; amount_cents: number }[];
}

/** A computed management DRE. */
export interface DreResult {
  revenueCents: number;
  expenseTotalCents: number;
  /** Revenue minus expenses — positive is profit, negative is loss. */
  netResultCents: number;
  /** Net result as a percent of revenue, rounded; 0 when revenue is 0. */
  marginPercent: number;
  /** Expense lines, largest first. */
  expenseLines: DreCategoryLine[];
}

/**
 * Net margin as a percentage of revenue, rounded to an integer.
 * Returns 0 when revenue is 0 to avoid division by zero.
 */
export function marginPercent(
  netResultCents: number,
  revenueCents: number
): number {
  if (revenueCents <= 0) return 0;
  return Math.round((netResultCents / revenueCents) * 100);
}

/**
 * Builds a management DRE from a {@link DrePayload}. The expense total is taken
 * from the RPC (`expense_total_cents`) — it always equals the sum of the
 * category lines — and expense lines are sorted by amount descending.
 */
export function buildDre(payload: DrePayload): DreResult {
  const revenueCents = payload.revenue_cents;
  const expenseTotalCents = payload.expense_total_cents;
  const netResultCents = revenueCents - expenseTotalCents;

  const expenseLines: DreCategoryLine[] = payload.expense_by_category
    .map((line) => ({
      category: line.category,
      amountCents: line.amount_cents,
      sharePercent:
        expenseTotalCents > 0
          ? Math.round((line.amount_cents / expenseTotalCents) * 100)
          : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);

  return {
    revenueCents,
    expenseTotalCents,
    netResultCents,
    marginPercent: marginPercent(netResultCents, revenueCents),
    expenseLines,
  };
}

/** True when an expense-line list sums to the stated total — a sanity check. */
export function dreLinesReconcile(
  lines: DreCategoryLine[],
  expenseTotalCents: number
): boolean {
  return sumCents(lines.map((l) => l.amountCents)) === expenseTotalCents;
}
