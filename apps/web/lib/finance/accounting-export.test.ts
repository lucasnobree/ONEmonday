import { describe, it, expect } from "vitest";
import {
  buildAccountingExport,
  accountingExportNetCents,
} from "./accounting-export";
import type { Invoice } from "@/hooks/finance/use-invoices";
import type { Expense } from "@/hooks/finance/use-expenses";

function invoice(over: Partial<Invoice>): Invoice {
  return {
    id: "i1",
    sector_id: "s1",
    number: "INV-1",
    customer_name: "Cliente A",
    description: null,
    amount_cents: 10_000,
    currency: "BRL",
    status: "paid",
    issue_date: "2026-01-01",
    due_date: "2026-01-31",
    paid_at: "2026-01-15T12:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: "e1",
    sector_id: "s1",
    vendor_name: "Fornecedor X",
    description: null,
    category: "software",
    amount_cents: 5_000,
    currency: "BRL",
    status: "paid",
    expense_date: "2026-01-05",
    due_date: null,
    paid_at: "2026-01-10T08:00:00Z",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    created_at: "2026-01-05T00:00:00Z",
    ...over,
  };
}

describe("buildAccountingExport", () => {
  it("includes only paid items inside the period", () => {
    const rows = buildAccountingExport(
      [
        invoice({ id: "in", paid_at: "2026-01-15T00:00:00Z" }),
        invoice({ id: "out", paid_at: "2026-02-15T00:00:00Z" }),
        invoice({ id: "draft", status: "sent", paid_at: null }),
      ],
      [],
      "2026-01-01",
      "2026-01-31"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("receita");
  });

  it("formats receita positive and despesa negative", () => {
    const rows = buildAccountingExport(
      [invoice({ amount_cents: 123_456 })],
      [expense({ amount_cents: 50_000 })],
      "2026-01-01",
      "2026-01-31"
    );
    const receita = rows.find((r) => r.type === "receita");
    const despesa = rows.find((r) => r.type === "despesa");
    expect(receita?.amount).toBe("1.234,56");
    expect(despesa?.amount).toBe("-500,00");
  });

  it("sorts rows by date ascending", () => {
    const rows = buildAccountingExport(
      [invoice({ paid_at: "2026-01-20T00:00:00Z" })],
      [expense({ paid_at: "2026-01-05T00:00:00Z" })],
      "2026-01-01",
      "2026-01-31"
    );
    expect(rows.map((r) => r.date)).toEqual(["2026-01-05", "2026-01-20"]);
  });

  it("uses category for expenses and invoice number for receitas", () => {
    const rows = buildAccountingExport(
      [invoice({ number: "INV-99" })],
      [expense({ category: "payroll" })],
      "2026-01-01",
      "2026-01-31"
    );
    expect(rows.find((r) => r.type === "receita")?.category).toBe("Fatura INV-99");
    expect(rows.find((r) => r.type === "despesa")?.category).toBe("payroll");
  });
});

describe("accountingExportNetCents", () => {
  it("nets receitas against despesas", () => {
    const rows = buildAccountingExport(
      [invoice({ amount_cents: 100_000 })],
      [expense({ amount_cents: 30_000 })],
      "2026-01-01",
      "2026-01-31"
    );
    expect(accountingExportNetCents(rows)).toBe(70_000);
  });

  it("is 0 for an empty export", () => {
    expect(accountingExportNetCents([])).toBe(0);
  });
});
