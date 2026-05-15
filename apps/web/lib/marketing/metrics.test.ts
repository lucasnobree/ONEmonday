import { describe, it, expect } from "vitest";
import {
  conversionRate,
  leadRate,
  costPerLead,
  costPerConversion,
  budgetUsagePercent,
  isOverBudget,
} from "./metrics";

describe("conversionRate", () => {
  it("returns conversions as a percentage of leads", () => {
    expect(conversionRate(25, 100)).toBe(25);
  });

  it("rounds to one decimal", () => {
    expect(conversionRate(1, 3)).toBe(33.3);
  });

  it("returns 0 when there are no leads", () => {
    expect(conversionRate(5, 0)).toBe(0);
  });
});

describe("leadRate", () => {
  it("returns leads as a percentage of impressions", () => {
    expect(leadRate(50, 1000)).toBe(5);
  });

  it("returns 0 when there are no impressions", () => {
    expect(leadRate(10, 0)).toBe(0);
  });
});

describe("costPerLead / costPerConversion", () => {
  it("divides spend by leads, rounded to integer cents", () => {
    expect(costPerLead(100_00, 8)).toBe(1250);
  });

  it("divides spend by conversions", () => {
    expect(costPerConversion(90_00, 4)).toBe(2250);
  });

  it("returns 0 when the denominator is 0", () => {
    expect(costPerLead(100_00, 0)).toBe(0);
    expect(costPerConversion(100_00, 0)).toBe(0);
  });
});

describe("budgetUsagePercent / isOverBudget", () => {
  it("computes spend as a percentage of budget", () => {
    expect(budgetUsagePercent(75_00, 100_00)).toBe(75);
  });

  it("can exceed 100%", () => {
    expect(budgetUsagePercent(150_00, 100_00)).toBe(150);
    expect(isOverBudget(150_00, 100_00)).toBe(true);
  });

  it("is not over budget at or below the limit", () => {
    expect(isOverBudget(100_00, 100_00)).toBe(false);
    expect(isOverBudget(50_00, 100_00)).toBe(false);
  });

  it("guards against a zero budget", () => {
    expect(budgetUsagePercent(10_00, 0)).toBe(0);
    expect(isOverBudget(10_00, 0)).toBe(false);
  });
});
