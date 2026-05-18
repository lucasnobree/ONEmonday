/**
 * Bank reconciliation matching — Phase 4 internal financial management
 * (docs/research/migration-architecture.md §2.9 "Bank reconciliation").
 *
 * Suggests which finance invoice (AR) or expense (AP) an imported bank
 * transaction reconciles to. A `credit` transaction is money in -> it matches
 * an open invoice; a `debit` is money out -> it matches an open expense.
 *
 * The match heuristic — deliberately conservative, since a wrong reconciliation
 * mis-states the books:
 *   1. the cents amount must be exactly equal;
 *   2. the candidate's date must be within a tolerance window of the
 *      transaction's posted date;
 *   3. confidence is `high` when exactly one candidate matches, `low` when
 *      several do (the user picks), and there is no auto-match below that.
 *
 * Pure functions over already-fetched rows — no DB, fully testable. All
 * amounts stay integer cents.
 */
import type { BankTransaction } from "@/lib/integrations/finance-types";
import { parseDateOnly } from "./dates";

/** Default date tolerance: a payment can post a few days after the due date. */
export const DEFAULT_DATE_TOLERANCE_DAYS = 5;

/** A reconciliation candidate — an open invoice or expense. */
export interface ReconcileCandidate {
  id: string;
  kind: "invoice" | "expense";
  amountCents: number;
  /** The candidate's reference date (due date / expense date). */
  referenceDate: string;
  /** Customer / vendor label, for display. */
  partyName: string;
}

/** A suggested match for one bank transaction. */
export interface ReconcileSuggestion {
  transactionExternalId: string;
  /** All amount+date matches found, best (closest date) first. */
  candidates: ReconcileCandidate[];
  /**
   * `high`  — exactly one candidate; safe to pre-select.
   * `low`   — several candidates; the user must choose.
   * `none`  — no candidate matched.
   */
  confidence: "high" | "low" | "none";
}

/** Whole-day distance between two date-only strings; null when unparseable. */
function dayDistance(a: string, b: string): number | null {
  const da = parseDateOnly(a);
  const db = parseDateOnly(b);
  if (!da || !db) return null;
  const ms = Math.abs(da.getTime() - db.getTime());
  return Math.round(ms / 86_400_000);
}

/**
 * Finds the candidates that match a single bank transaction: same cents amount
 * and a reference date within `toleranceDays`. The transaction `direction`
 * picks the candidate kind (credit -> invoice, debit -> expense). Returned
 * candidates are sorted by date proximity (closest first).
 */
export function matchTransaction(
  transaction: BankTransaction,
  candidates: ReconcileCandidate[],
  toleranceDays: number = DEFAULT_DATE_TOLERANCE_DAYS
): ReconcileSuggestion {
  const wantedKind: ReconcileCandidate["kind"] =
    transaction.direction === "credit" ? "invoice" : "expense";

  const matched = candidates
    .filter((c) => c.kind === wantedKind)
    .filter((c) => c.amountCents === transaction.amountCents)
    .map((c) => ({
      candidate: c,
      distance: dayDistance(transaction.postedDate, c.referenceDate),
    }))
    .filter(
      (m): m is { candidate: ReconcileCandidate; distance: number } =>
        m.distance !== null && m.distance <= toleranceDays
    )
    .sort((a, b) => a.distance - b.distance)
    .map((m) => m.candidate);

  let confidence: ReconcileSuggestion["confidence"];
  if (matched.length === 0) confidence = "none";
  else if (matched.length === 1) confidence = "high";
  else confidence = "low";

  return {
    transactionExternalId: transaction.externalId,
    candidates: matched,
    confidence,
  };
}

/**
 * Builds a suggestion for every transaction. A candidate already chosen as a
 * `high`-confidence match for an earlier transaction is removed from the pool
 * so two transactions never both auto-claim the same invoice/expense.
 */
export function suggestReconciliation(
  transactions: BankTransaction[],
  candidates: ReconcileCandidate[],
  toleranceDays: number = DEFAULT_DATE_TOLERANCE_DAYS
): ReconcileSuggestion[] {
  const claimed = new Set<string>();
  const suggestions: ReconcileSuggestion[] = [];

  for (const transaction of transactions) {
    const available = candidates.filter((c) => !claimed.has(c.id));
    const suggestion = matchTransaction(
      transaction,
      available,
      toleranceDays
    );
    if (suggestion.confidence === "high") {
      claimed.add(suggestion.candidates[0].id);
    }
    suggestions.push(suggestion);
  }

  return suggestions;
}

/** Count of transactions an automatic pass would confidently reconcile. */
export function autoMatchableCount(
  suggestions: ReconcileSuggestion[]
): number {
  return suggestions.filter((s) => s.confidence === "high").length;
}
