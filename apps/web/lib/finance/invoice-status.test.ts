import { describe, it, expect } from "vitest";
import { isInvoiceOverdue, effectiveInvoiceStatus } from "./invoice-status";
import type { Invoice } from "@/hooks/finance/use-invoices";

/** Builds the minimal invoice shape the helpers need. */
function inv(
  status: Invoice["status"],
  due_date: string
): Pick<Invoice, "status" | "due_date"> {
  return { status, due_date };
}

const TODAY = "2026-05-15";

describe("isInvoiceOverdue", () => {
  it("treats a sent invoice past its due date as overdue", () => {
    expect(isInvoiceOverdue(inv("sent", "2026-05-14"), TODAY)).toBe(true);
  });

  it("does not treat a sent invoice due today as overdue", () => {
    expect(isInvoiceOverdue(inv("sent", "2026-05-15"), TODAY)).toBe(false);
  });

  it("does not treat a sent invoice due in the future as overdue", () => {
    expect(isInvoiceOverdue(inv("sent", "2026-06-01"), TODAY)).toBe(false);
  });

  it("keeps an already-overdue invoice overdue regardless of date", () => {
    expect(isInvoiceOverdue(inv("overdue", "2026-12-31"), TODAY)).toBe(true);
  });

  it("never marks a draft, paid or void invoice as overdue", () => {
    expect(isInvoiceOverdue(inv("draft", "2020-01-01"), TODAY)).toBe(false);
    expect(isInvoiceOverdue(inv("paid", "2020-01-01"), TODAY)).toBe(false);
    expect(isInvoiceOverdue(inv("void", "2020-01-01"), TODAY)).toBe(false);
  });
});

describe("effectiveInvoiceStatus", () => {
  it("promotes a past-due sent invoice to overdue", () => {
    expect(effectiveInvoiceStatus(inv("sent", "2026-05-01"), TODAY)).toBe(
      "overdue"
    );
  });

  it("leaves a not-yet-due sent invoice as sent", () => {
    expect(effectiveInvoiceStatus(inv("sent", "2026-05-20"), TODAY)).toBe(
      "sent"
    );
  });

  it("leaves a paid invoice as paid even when its due date passed", () => {
    expect(effectiveInvoiceStatus(inv("paid", "2026-01-01"), TODAY)).toBe(
      "paid"
    );
  });
});
