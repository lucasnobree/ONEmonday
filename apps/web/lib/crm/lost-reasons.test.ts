import { describe, it, expect } from "vitest";
import {
  LOST_REASON_CATEGORIES,
  LOST_REASON_LABELS,
  isLostReasonCategory,
  lostReasonLabel,
} from "./lost-reasons";

describe("lost-reasons taxonomy", () => {
  it("has a pt-BR label for every category", () => {
    for (const category of LOST_REASON_CATEGORIES) {
      expect(LOST_REASON_LABELS[category]).toBeTruthy();
    }
  });

  it("exposes a finite, bounded set of categories", () => {
    // Best practice: keep the taxonomy small enough to stay analyzable.
    expect(LOST_REASON_CATEGORIES.length).toBeGreaterThan(0);
    expect(LOST_REASON_CATEGORIES.length).toBeLessThanOrEqual(12);
  });
});

describe("isLostReasonCategory", () => {
  it("accepts every known category", () => {
    for (const category of LOST_REASON_CATEGORIES) {
      expect(isLostReasonCategory(category)).toBe(true);
    }
  });

  it("rejects unknown / malformed values", () => {
    expect(isLostReasonCategory("bad fit")).toBe(false);
    expect(isLostReasonCategory("")).toBe(false);
    expect(isLostReasonCategory(null)).toBe(false);
    expect(isLostReasonCategory(42)).toBe(false);
  });
});

describe("lostReasonLabel", () => {
  it("maps a known category to its label", () => {
    expect(lostReasonLabel("competitor")).toBe(
      LOST_REASON_LABELS.competitor
    );
  });

  it("falls back to the raw value for legacy free text", () => {
    expect(lostReasonLabel("motivo antigo")).toBe("motivo antigo");
  });

  it("returns a dash for null/undefined", () => {
    expect(lostReasonLabel(null)).toBe("—");
    expect(lostReasonLabel(undefined)).toBe("—");
  });
});
