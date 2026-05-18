import { describe, it, expect } from "vitest";
import {
  LEAD_SOURCES,
  leadSourceLabel,
  isKnownLeadSource,
} from "./lead-sources";

describe("leadSourceLabel", () => {
  it("maps every canonical source to a non-empty pt-BR label", () => {
    for (const source of LEAD_SOURCES) {
      expect(leadSourceLabel(source).length).toBeGreaterThan(0);
    }
  });

  it("returns distinct labels for distinct sources", () => {
    const labels = LEAD_SOURCES.map(leadSourceLabel);
    expect(new Set(labels).size).toBe(LEAD_SOURCES.length);
  });

  it("translates known sources", () => {
    expect(leadSourceLabel("form")).toBe("Formulário");
    expect(leadSourceLabel("indicacao")).toBe("Indicação");
    expect(leadSourceLabel("manual")).toBe("Manual");
  });

  it("falls back to the raw value for legacy / unknown sources", () => {
    expect(leadSourceLabel("rd_station")).toBe("rd_station");
    expect(leadSourceLabel("")).toBe("");
  });
});

describe("isKnownLeadSource", () => {
  it("is true for canonical sources", () => {
    expect(isKnownLeadSource("form")).toBe(true);
    expect(isKnownLeadSource("evento")).toBe(true);
  });

  it("is false for anything outside the canonical list", () => {
    expect(isKnownLeadSource("Site")).toBe(false);
    expect(isKnownLeadSource("website")).toBe(false);
    expect(isKnownLeadSource("")).toBe(false);
  });
});
