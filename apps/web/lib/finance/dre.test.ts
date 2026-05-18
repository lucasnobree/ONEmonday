import { describe, it, expect } from "vitest";
import { buildDre, marginPercent, dreLinesReconcile } from "./dre";

describe("marginPercent", () => {
  it("returns 0 when revenue is 0", () => {
    expect(marginPercent(-5000, 0)).toBe(0);
  });

  it("computes a positive margin", () => {
    expect(marginPercent(25_000, 100_000)).toBe(25);
  });

  it("computes a negative margin (loss)", () => {
    expect(marginPercent(-10_000, 100_000)).toBe(-10);
  });
});

describe("buildDre", () => {
  it("computes net result and margin from revenue and expenses", () => {
    const dre = buildDre({
      revenue_cents: 200_000,
      expense_total_cents: 150_000,
      expense_by_category: [
        { category: "payroll", amount_cents: 90_000 },
        { category: "software", amount_cents: 60_000 },
      ],
    });
    expect(dre.revenueCents).toBe(200_000);
    expect(dre.expenseTotalCents).toBe(150_000);
    expect(dre.netResultCents).toBe(50_000);
    expect(dre.marginPercent).toBe(25);
  });

  it("reports a loss when expenses exceed revenue", () => {
    const dre = buildDre({
      revenue_cents: 100_000,
      expense_total_cents: 130_000,
      expense_by_category: [{ category: "taxes", amount_cents: 130_000 }],
    });
    expect(dre.netResultCents).toBe(-30_000);
    expect(dre.marginPercent).toBe(-30);
  });

  it("sorts expense lines by amount descending and computes share", () => {
    const dre = buildDre({
      revenue_cents: 0,
      expense_total_cents: 100_000,
      expense_by_category: [
        { category: "office", amount_cents: 25_000 },
        { category: "payroll", amount_cents: 75_000 },
      ],
    });
    expect(dre.expenseLines.map((l) => l.category)).toEqual([
      "payroll",
      "office",
    ]);
    expect(dre.expenseLines[0].sharePercent).toBe(75);
    expect(dre.expenseLines[1].sharePercent).toBe(25);
  });

  it("handles zero expenses without dividing by zero", () => {
    const dre = buildDre({
      revenue_cents: 50_000,
      expense_total_cents: 0,
      expense_by_category: [],
    });
    expect(dre.expenseLines).toEqual([]);
    expect(dre.netResultCents).toBe(50_000);
    expect(dre.marginPercent).toBe(100);
  });
});

describe("dreLinesReconcile", () => {
  it("is true when lines sum to the total", () => {
    const dre = buildDre({
      revenue_cents: 0,
      expense_total_cents: 30_000,
      expense_by_category: [
        { category: "payroll", amount_cents: 10_000 },
        { category: "software", amount_cents: 20_000 },
      ],
    });
    expect(dreLinesReconcile(dre.expenseLines, dre.expenseTotalCents)).toBe(
      true
    );
  });

  it("is false when lines do not sum to the total", () => {
    const dre = buildDre({
      revenue_cents: 0,
      expense_total_cents: 99_999,
      expense_by_category: [{ category: "payroll", amount_cents: 10_000 }],
    });
    expect(dreLinesReconcile(dre.expenseLines, dre.expenseTotalCents)).toBe(
      false
    );
  });
});
