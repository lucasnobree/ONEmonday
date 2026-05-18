import { describe, it, expect } from "vitest";
import {
  bucketForDaysOverdue,
  agingTotals,
  agingGrandTotal,
  agingByParty,
  type AgingItem,
} from "./aging";

describe("bucketForDaysOverdue", () => {
  it("classifies not-yet-due and due-today as current", () => {
    expect(bucketForDaysOverdue(-10)).toBe("current");
    expect(bucketForDaysOverdue(0)).toBe("current");
  });

  it("classifies boundary days into the correct bucket", () => {
    expect(bucketForDaysOverdue(1)).toBe("d1_30");
    expect(bucketForDaysOverdue(30)).toBe("d1_30");
    expect(bucketForDaysOverdue(31)).toBe("d31_60");
    expect(bucketForDaysOverdue(60)).toBe("d31_60");
    expect(bucketForDaysOverdue(61)).toBe("d61_90");
    expect(bucketForDaysOverdue(90)).toBe("d61_90");
    expect(bucketForDaysOverdue(91)).toBe("d90_plus");
    expect(bucketForDaysOverdue(365)).toBe("d90_plus");
  });
});

describe("agingTotals", () => {
  it("returns all-zero buckets for no items", () => {
    expect(agingTotals([])).toEqual({
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90_plus: 0,
    });
  });

  it("sums cents into the right buckets", () => {
    const items: AgingItem[] = [
      { partyName: "A", amountCents: 10_000, daysOverdue: -5 },
      { partyName: "A", amountCents: 25_000, daysOverdue: 15 },
      { partyName: "B", amountCents: 5_000, daysOverdue: 45 },
      { partyName: "B", amountCents: 7_500, daysOverdue: 120 },
    ];
    const totals = agingTotals(items);
    expect(totals.current).toBe(10_000);
    expect(totals.d1_30).toBe(25_000);
    expect(totals.d31_60).toBe(5_000);
    expect(totals.d61_90).toBe(0);
    expect(totals.d90_plus).toBe(7_500);
  });

  it("keeps cents integers (no float drift)", () => {
    const items: AgingItem[] = [
      { partyName: "A", amountCents: 333, daysOverdue: 10 },
      { partyName: "A", amountCents: 333, daysOverdue: 10 },
      { partyName: "A", amountCents: 334, daysOverdue: 10 },
    ];
    expect(agingTotals(items).d1_30).toBe(1_000);
  });
});

describe("agingGrandTotal", () => {
  it("sums every bucket", () => {
    const totals = agingTotals([
      { partyName: "A", amountCents: 100, daysOverdue: 0 },
      { partyName: "A", amountCents: 200, daysOverdue: 40 },
      { partyName: "A", amountCents: 300, daysOverdue: 200 },
    ]);
    expect(agingGrandTotal(totals)).toBe(600);
  });
});

describe("agingByParty", () => {
  it("groups by party and sorts by total descending", () => {
    const items: AgingItem[] = [
      { partyName: "Small Co", amountCents: 1_000, daysOverdue: 5 },
      { partyName: "Big Co", amountCents: 50_000, daysOverdue: 10 },
      { partyName: "Big Co", amountCents: 30_000, daysOverdue: 70 },
      { partyName: "Mid Co", amountCents: 20_000, daysOverdue: 0 },
    ];
    const rows = agingByParty(items);
    expect(rows.map((r) => r.partyName)).toEqual([
      "Big Co",
      "Mid Co",
      "Small Co",
    ]);
    expect(rows[0].total).toBe(80_000);
    expect(rows[0].buckets.d1_30).toBe(50_000);
    expect(rows[0].buckets.d61_90).toBe(30_000);
  });

  it("returns an empty array for no items", () => {
    expect(agingByParty([])).toEqual([]);
  });
});
