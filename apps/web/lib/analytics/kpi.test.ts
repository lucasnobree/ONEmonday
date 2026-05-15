import { describe, it, expect } from "vitest";
import {
  computeDelta,
  isFavorableDelta,
  formatMetricValue,
  formatDeltaPercent,
} from "./kpi";

describe("computeDelta", () => {
  it("reports an upward delta", () => {
    const d = computeDelta(120, 100);
    expect(d.absolute).toBe(20);
    expect(d.percent).toBe(20);
    expect(d.direction).toBe("up");
  });

  it("reports a downward delta", () => {
    const d = computeDelta(80, 100);
    expect(d.absolute).toBe(-20);
    expect(d.percent).toBe(-20);
    expect(d.direction).toBe("down");
  });

  it("treats equal values as flat", () => {
    const d = computeDelta(50, 50);
    expect(d.direction).toBe("flat");
    expect(d.absolute).toBe(0);
  });

  it("returns a null percent when the previous value is 0", () => {
    const d = computeDelta(10, 0);
    expect(d.percent).toBeNull();
    expect(d.direction).toBe("up");
  });

  it("rounds the percent to one decimal", () => {
    expect(computeDelta(101, 300).percent).toBe(-66.3);
  });
});

describe("isFavorableDelta", () => {
  it("an increase is favorable when higher is better", () => {
    expect(isFavorableDelta(computeDelta(10, 5), true)).toBe(true);
  });

  it("an increase is unfavorable when lower is better", () => {
    expect(isFavorableDelta(computeDelta(10, 5), false)).toBe(false);
  });

  it("a flat delta is never favorable", () => {
    expect(isFavorableDelta(computeDelta(5, 5), true)).toBe(false);
  });
});

describe("formatMetricValue", () => {
  it("formats counts with thousands grouping", () => {
    expect(formatMetricValue(1234, "count")).toBe("1.234");
  });

  it("formats currency cents as BRL", () => {
    const out = formatMetricValue(150000, "currency_cents");
    expect(out).toContain("1.500,00");
  });
});

describe("formatDeltaPercent", () => {
  it("prefixes a positive delta with +", () => {
    expect(formatDeltaPercent(computeDelta(110, 100))).toBe("+10%");
  });

  it("renders an em dash when the percent is null", () => {
    expect(formatDeltaPercent(computeDelta(10, 0))).toBe("—");
  });
});
