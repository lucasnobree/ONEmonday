/**
 * Overdue derivation for invoices.
 *
 * `INVOICE_STATUSES` includes `overdue`, but no automation transitions a
 * `sent` invoice to `overdue` once its `due_date` passes — it would depend on
 * a human editing the status. To keep the "faturas vencidas" hint and the
 * Vencida tab reliable, the UI derives the effective status for display: a
 * `sent` invoice whose `due_date` is before today is treated as `overdue`.
 *
 * This is a *display-only* derivation — the stored `status` is unchanged.
 */

import type { Invoice, InvoiceStatus } from "@/hooks/finance/use-invoices";
import { parseDateOnly, todayDateOnly } from "./dates";

/**
 * Returns `true` when a `sent` invoice is past its `due_date` (strictly
 * before today, in the local timezone). Already-`overdue` invoices also
 * return `true`. Anything else (draft / paid / void) is never overdue.
 */
export function isInvoiceOverdue(
  invoice: Pick<Invoice, "status" | "due_date">,
  today: string = todayDateOnly()
): boolean {
  if (invoice.status === "overdue") return true;
  if (invoice.status !== "sent") return false;
  const due = parseDateOnly(invoice.due_date);
  const now = parseDateOnly(today);
  if (!due || !now) return false;
  return due.getTime() < now.getTime();
}

/**
 * The effective status of an invoice for display: identical to the stored
 * status except that a `sent` invoice past its `due_date` becomes `overdue`.
 */
export function effectiveInvoiceStatus(
  invoice: Pick<Invoice, "status" | "due_date">,
  today: string = todayDateOnly()
): InvoiceStatus {
  return isInvoiceOverdue(invoice, today) ? "overdue" : invoice.status;
}
