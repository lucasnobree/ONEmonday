import { describe, it, expect } from "vitest";
import {
  toCents,
  fromCents,
  parseCents,
  formatCents,
  sumCents,
  budgetUsagePercent,
} from "./money";

describe("toCents", () => {
  it("converts whole reais to cents", () => {
    expect(toCents(10)).toBe(1000);
  });

  it("converts a decimal amount to integer cents", () => {
    expect(toCents(19.99)).toBe(1999);
  });

  it("rounds half-up to the nearest cent", () => {
    expect(toCents(19.999)).toBe(2000);
    expect(toCents(0.005)).toBe(1);
  });

  it("avoids binary-float drift (0.1 + 0.2)", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754.
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("handles zero", () => {
    expect(toCents(0)).toBe(0);
  });

  it("returns null for non-finite input", () => {
    expect(toCents(NaN)).toBeNull();
    expect(toCents(Infinity)).toBeNull();
  });
});

describe("parseCents", () => {
  it("parses a plain decimal string", () => {
    expect(parseCents("1234.56")).toBe(123456);
  });

  it("parses pt-BR formatting (comma decimal, dot thousands)", () => {
    expect(parseCents("1.234,56")).toBe(123456);
  });

  it("parses en-US formatting (dot decimal, comma thousands)", () => {
    expect(parseCents("1,234.56")).toBe(123456);
  });

  it("treats a lone comma as the decimal separator", () => {
    expect(parseCents("99,90")).toBe(9990);
  });

  it("strips currency symbols and spaces", () => {
    expect(parseCents("R$ 1.000,00")).toBe(100000);
  });

  it("parses an integer with no decimals", () => {
    expect(parseCents("500")).toBe(50000);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(parseCents("")).toBeNull();
    expect(parseCents("abc")).toBeNull();
    expect(parseCents("-")).toBeNull();
  });

  it("rejects negative amounts", () => {
    expect(parseCents("-50")).toBeNull();
  });
});

describe("fromCents", () => {
  it("converts integer cents back to major units", () => {
    expect(fromCents(123456)).toBe(1234.56);
    expect(fromCents(0)).toBe(0);
  });

  it("round-trips with toCents", () => {
    expect(toCents(fromCents(8675))).toBe(8675);
  });
});

describe("formatCents", () => {
  it("formats BRL with the pt-BR locale", () => {
    // Non-breaking space between symbol and number.
    expect(formatCents(123456, "BRL")).toBe("R$ 1.234,56");
  });

  it("formats zero", () => {
    expect(formatCents(0, "BRL")).toBe("R$ 0,00");
  });

  it("defaults to BRL", () => {
    expect(formatCents(100)).toBe("R$ 1,00");
  });

  it("formats USD", () => {
    expect(formatCents(123456, "USD")).toBe("$1,234.56");
  });
});

describe("sumCents", () => {
  it("sums a list of integer cents", () => {
    expect(sumCents([100, 250, 99])).toBe(449);
  });

  it("returns 0 for an empty list", () => {
    expect(sumCents([])).toBe(0);
  });

  it("stays exact across many additions (no float drift)", () => {
    const items = Array.from({ length: 1000 }, () => 1);
    expect(sumCents(items)).toBe(1000);
  });
});

describe("budgetUsagePercent", () => {
  it("computes usage as an integer percentage", () => {
    expect(budgetUsagePercent(5000, 10000)).toBe(50);
  });

  it("can exceed 100 when over budget", () => {
    expect(budgetUsagePercent(15000, 10000)).toBe(150);
  });

  it("rounds to the nearest integer", () => {
    expect(budgetUsagePercent(3333, 10000)).toBe(33);
  });

  it("returns 0 when the budget is zero (no division by zero)", () => {
    expect(budgetUsagePercent(5000, 0)).toBe(0);
  });
});
