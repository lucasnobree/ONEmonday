import { describe, it, expect } from "vitest";
import {
  createInvoiceSchema,
  createExpenseSchema,
  createBudgetSchema,
} from "./finance";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("createInvoiceSchema", () => {
  const valid = {
    sectorId: UUID,
    number: "INV-001",
    customerName: "Cliente ACME",
    amountCents: 150000,
    currency: "BRL" as const,
    status: "draft" as const,
    issueDate: "2026-05-01",
    dueDate: "2026-05-31",
  };

  it("accepts a valid invoice payload", () => {
    expect(createInvoiceSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a zero amount", () => {
    expect(
      createInvoiceSchema.safeParse({ ...valid, amountCents: 0 }).success
    ).toBe(false);
  });

  it("rejects a non-integer amount (floats not allowed)", () => {
    expect(
      createInvoiceSchema.safeParse({ ...valid, amountCents: 1999.5 }).success
    ).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(
      createInvoiceSchema.safeParse({ ...valid, amountCents: -100 }).success
    ).toBe(false);
  });

  it("rejects a due date earlier than the issue date", () => {
    const result = createInvoiceSchema.safeParse({
      ...valid,
      issueDate: "2026-05-31",
      dueDate: "2026-05-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(
      createInvoiceSchema.safeParse({ ...valid, dueDate: "31/05/2026" }).success
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(
      createInvoiceSchema.safeParse({ ...valid, status: "archived" }).success
    ).toBe(false);
  });
});

describe("createExpenseSchema", () => {
  const valid = {
    sectorId: UUID,
    vendorName: "Fornecedor X",
    category: "software" as const,
    amountCents: 49900,
    currency: "BRL" as const,
    status: "pending" as const,
    expenseDate: "2026-05-10",
  };

  it("accepts a valid expense payload", () => {
    expect(createExpenseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(
      createExpenseSchema.safeParse({ ...valid, category: "rent" }).success
    ).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    expect(
      createExpenseSchema.safeParse({ ...valid, amountCents: 0.99 }).success
    ).toBe(false);
  });

  it("requires a vendor name", () => {
    expect(
      createExpenseSchema.safeParse({ ...valid, vendorName: "" }).success
    ).toBe(false);
  });
});

describe("createBudgetSchema", () => {
  const valid = {
    sectorId: UUID,
    category: "marketing" as const,
    periodMonth: "2026-05-01",
    amountCents: 500000,
    currency: "BRL" as const,
  };

  it("accepts a valid budget payload", () => {
    expect(createBudgetSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-integer amount", () => {
    expect(
      createBudgetSchema.safeParse({ ...valid, amountCents: 5000.5 }).success
    ).toBe(false);
  });

  it("rejects a malformed period month", () => {
    expect(
      createBudgetSchema.safeParse({ ...valid, periodMonth: "2026-05" }).success
    ).toBe(false);
  });
});
