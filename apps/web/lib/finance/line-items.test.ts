import { describe, it, expect } from "vitest";
import {
  lineTotalCents,
  invoiceTotalCents,
  quantityToMilli,
  formatQuantity,
} from "./line-items";

describe("lineTotalCents", () => {
  it("multiplies a whole quantity by the unit price", () => {
    // 3 × R$10,00 = R$30,00
    expect(lineTotalCents(3000, 1000)).toBe(3000);
  });

  it("handles a fractional quantity exactly", () => {
    // 1.5 × R$20,00 = R$30,00
    expect(lineTotalCents(1500, 2000)).toBe(3000);
  });

  it("rounds half-up on a fractional cent result", () => {
    // 1.5 × R$0,01 = 1.5 cents -> 2 cents
    expect(lineTotalCents(1500, 1)).toBe(2);
  });

  it("returns 0 for a non-positive quantity", () => {
    expect(lineTotalCents(0, 1000)).toBe(0);
    expect(lineTotalCents(-1000, 1000)).toBe(0);
  });

  it("returns 0 for a negative unit price", () => {
    expect(lineTotalCents(1000, -100)).toBe(0);
  });

  it("returns 0 for non-finite input", () => {
    expect(lineTotalCents(Number.NaN, 1000)).toBe(0);
    expect(lineTotalCents(1000, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("invoiceTotalCents", () => {
  it("sums multiple line totals as an integer", () => {
    const total = invoiceTotalCents([
      { description: "A", quantityMilli: 2000, unitPriceCents: 1500 },
      { description: "B", quantityMilli: 1000, unitPriceCents: 500 },
      { description: "C", quantityMilli: 1500, unitPriceCents: 1 },
    ]);
    // 30,00 + 5,00 + 0,02 = 3502 cents
    expect(total).toBe(3502);
  });

  it("returns 0 for an empty invoice", () => {
    expect(invoiceTotalCents([])).toBe(0);
  });
});

describe("quantityToMilli", () => {
  it("parses a whole number", () => {
    expect(quantityToMilli("2")).toBe(2000);
  });

  it("parses a pt-BR comma decimal", () => {
    expect(quantityToMilli("1,5")).toBe(1500);
  });

  it("parses an en-US dot decimal", () => {
    expect(quantityToMilli("0.25")).toBe(250);
  });

  it("rejects zero, negatives and junk", () => {
    expect(quantityToMilli("0")).toBeNull();
    expect(quantityToMilli("-3")).toBeNull();
    expect(quantityToMilli("")).toBeNull();
    expect(quantityToMilli("abc")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("drops trailing zeros for whole quantities", () => {
    expect(formatQuantity(1000)).toBe("1");
  });

  it("renders a fractional quantity with a pt-BR comma", () => {
    expect(formatQuantity(1500)).toBe("1,5");
  });
});
