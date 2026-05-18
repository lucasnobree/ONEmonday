/**
 * AR / AP aging — Phase 4 internal financial management
 * (docs/research/migration-contabilidade.md backlog #7).
 *
 * Aging buckets an open receivable / payable by how many days it is past due:
 * the standard 0-30 / 31-60 / 61-90 / 90+ collections tool. A document not yet
 * due (negative days overdue) lands in the "current" bucket.
 *
 * Pure functions over already-fetched rows — no DB, fully unit-testable. All
 * amounts stay integer cents.
 */
import { sumCents } from "./money";

/** The aging bucket keys, in display order. */
export const AGING_BUCKETS = [
  "current",
  "d1_30",
  "d31_60",
  "d61_90",
  "d90_plus",
] as const;

export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** Portuguese labels for the aging buckets. */
export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "A vencer",
  d1_30: "1-30 dias",
  d31_60: "31-60 dias",
  d61_90: "61-90 dias",
  d90_plus: "90+ dias",
};

/** One open receivable / payable line for aging. */
export interface AgingItem {
  /** Customer (AR) or vendor (AP) name. */
  partyName: string;
  amountCents: number;
  /** Whole days the item is past due. Negative = not yet due. */
  daysOverdue: number;
}

/**
 * Classifies a days-overdue count into an aging bucket.
 *   <= 0   -> current      (not yet due, or due today)
 *   1-30   -> d1_30
 *   31-60  -> d31_60
 *   61-90  -> d61_90
 *   91+    -> d90_plus
 */
export function bucketForDaysOverdue(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90_plus";
}

/** Per-bucket cents totals — every bucket key is always present. */
export type AgingTotals = Record<AgingBucket, number>;

/** A new, all-zero {@link AgingTotals}. */
function emptyTotals(): AgingTotals {
  return {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_plus: 0,
  };
}

/** Sums `items` into per-bucket cents totals. */
export function agingTotals(items: AgingItem[]): AgingTotals {
  const totals = emptyTotals();
  for (const item of items) {
    totals[bucketForDaysOverdue(item.daysOverdue)] += item.amountCents;
  }
  return totals;
}

/** The grand total (all buckets) of an {@link AgingTotals}. */
export function agingGrandTotal(totals: AgingTotals): number {
  return sumCents(AGING_BUCKETS.map((b) => totals[b]));
}

/** An aging report grouped by customer / vendor. */
export interface AgingPartyRow {
  partyName: string;
  buckets: AgingTotals;
  total: number;
}

/**
 * Groups aging items by party (customer / vendor), returning one row per party
 * with its per-bucket totals. Rows are sorted by total descending — the
 * biggest outstanding party first, the natural collections order.
 */
export function agingByParty(items: AgingItem[]): AgingPartyRow[] {
  const byParty = new Map<string, AgingItem[]>();
  for (const item of items) {
    const list = byParty.get(item.partyName);
    if (list) list.push(item);
    else byParty.set(item.partyName, [item]);
  }

  const rows: AgingPartyRow[] = [];
  for (const [partyName, partyItems] of byParty) {
    const buckets = agingTotals(partyItems);
    rows.push({ partyName, buckets, total: agingGrandTotal(buckets) });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows;
}
