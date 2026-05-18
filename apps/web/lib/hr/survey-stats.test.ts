import { describe, it, expect } from "vitest";
import { participationRate } from "./survey-stats";

describe("participationRate", () => {
  it("returns null when the eligible audience is zero", () => {
    expect(participationRate(0, 0)).toBeNull();
    expect(participationRate(5, 0)).toBeNull();
  });

  it("computes a percentage rounded to one decimal", () => {
    expect(participationRate(1, 3)).toBe(33.3);
    expect(participationRate(2, 3)).toBe(66.7);
    expect(participationRate(5, 10)).toBe(50);
  });

  it("returns 100 for full participation", () => {
    expect(participationRate(12, 12)).toBe(100);
  });

  it("caps responded at eligible so the rate never exceeds 100%", () => {
    expect(participationRate(15, 12)).toBe(100);
  });

  it("clamps a negative responded count to zero", () => {
    expect(participationRate(-3, 10)).toBe(0);
  });
});
