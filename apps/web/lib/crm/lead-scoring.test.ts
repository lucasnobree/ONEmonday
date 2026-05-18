import { describe, it, expect } from "vitest";
import {
  scoreLead,
  scoreBand,
  scoreBandLabel,
  leadVerdict,
  emailDomain,
  isCorporateEmail,
  MAX_LEAD_SCORE,
  HOT_SCORE_THRESHOLD,
  WARM_SCORE_THRESHOLD,
} from "./lead-scoring";

describe("emailDomain", () => {
  it("extracts and lowercases the domain", () => {
    expect(emailDomain("Joao@Acme.COM")).toBe("acme.com");
  });

  it("returns null for missing / malformed addresses", () => {
    expect(emailDomain(null)).toBeNull();
    expect(emailDomain("")).toBeNull();
    expect(emailDomain("no-at-sign")).toBeNull();
    expect(emailDomain("trailing@")).toBeNull();
  });
});

describe("isCorporateEmail", () => {
  it("is true for a corporate domain", () => {
    expect(isCorporateEmail("ana@empresa.com.br")).toBe(true);
  });

  it("is false for free webmail domains", () => {
    expect(isCorporateEmail("ana@gmail.com")).toBe(false);
    expect(isCorporateEmail("ana@hotmail.com")).toBe(false);
    expect(isCorporateEmail("ana@yahoo.com.br")).toBe(false);
  });

  it("is false when there is no email", () => {
    expect(isCorporateEmail(null)).toBe(false);
  });
});

describe("scoreLead", () => {
  it("scores an empty lead at zero / cold", () => {
    const result = scoreLead({});
    expect(result.score).toBe(0);
    expect(result.band).toBe("cold");
    expect(result.rules.every((r) => !r.matched)).toBe(true);
  });

  it("awards points only for matched rules", () => {
    const result = scoreLead({ email: "x@gmail.com" });
    // has-email matches (15); corporate-email does not (gmail is free).
    expect(result.score).toBe(15);
    const hasEmail = result.rules.find((r) => r.id === "has-email");
    const corporate = result.rules.find((r) => r.id === "corporate-email");
    expect(hasEmail?.matched).toBe(true);
    expect(corporate?.matched).toBe(false);
  });

  it("rewards a corporate email on top of has-email", () => {
    const result = scoreLead({ email: "ana@empresa.com" });
    // has-email (15) + corporate-email (25) = 40.
    expect(result.score).toBe(40);
  });

  it("scores a fully-qualified hot lead", () => {
    const result = scoreLead({
      name: "Ana Souza",
      email: "ana@empresa.com",
      phone: "+55 11 99999-0000",
      company: "Empresa X",
      source: "referral",
      payload: { cargo: "Diretora", orcamento: "alto" },
    });
    // 15 + 15 + 15 + 25 + 20 + 10 = 100.
    expect(result.score).toBe(100);
    expect(result.band).toBe("hot");
  });

  it("never exceeds MAX_LEAD_SCORE", () => {
    const result = scoreLead({
      email: "ana@empresa.com",
      phone: "1",
      company: "X",
      source: "demo",
      payload: { a: "1", b: "2", c: "3" },
    });
    expect(result.score).toBeLessThanOrEqual(MAX_LEAD_SCORE);
  });

  it("ignores empty payload values when counting rich-payload", () => {
    const result = scoreLead({ payload: { a: "", b: "  ", c: null } });
    const rich = result.rules.find((r) => r.id === "rich-payload");
    expect(rich?.matched).toBe(false);
  });

  it("counts a payload with two real values as rich", () => {
    const result = scoreLead({ payload: { a: "yes", b: "also" } });
    const rich = result.rules.find((r) => r.id === "rich-payload");
    expect(rich?.matched).toBe(true);
    expect(result.score).toBe(10);
  });

  it("treats high-intent source case-insensitively", () => {
    expect(
      scoreLead({ source: "REFERRAL" }).rules.find(
        (r) => r.id === "high-intent-source"
      )?.matched
    ).toBe(true);
  });

  it("does not award points for a passive source", () => {
    expect(
      scoreLead({ source: "form" }).rules.find(
        (r) => r.id === "high-intent-source"
      )?.matched
    ).toBe(false);
  });
});

describe("scoreBand", () => {
  it("bands by the documented thresholds", () => {
    expect(scoreBand(HOT_SCORE_THRESHOLD)).toBe("hot");
    expect(scoreBand(HOT_SCORE_THRESHOLD - 1)).toBe("warm");
    expect(scoreBand(WARM_SCORE_THRESHOLD)).toBe("warm");
    expect(scoreBand(WARM_SCORE_THRESHOLD - 1)).toBe("cold");
    expect(scoreBand(0)).toBe("cold");
  });
});

describe("scoreBandLabel", () => {
  it("maps each band to a pt-BR label", () => {
    expect(scoreBandLabel("hot")).toBe("Quente");
    expect(scoreBandLabel("warm")).toBe("Morno");
    expect(scoreBandLabel("cold")).toBe("Frio");
  });
});

describe("leadVerdict", () => {
  it("returns a distinct, non-empty verdict for every band", () => {
    const verdicts = (["hot", "warm", "cold"] as const).map(leadVerdict);
    for (const verdict of verdicts) {
      expect(verdict.length).toBeGreaterThan(0);
    }
    expect(new Set(verdicts).size).toBe(3);
  });

  it("prioritizes a hot lead and de-prioritizes a cold one", () => {
    expect(leadVerdict("hot")).toMatch(/quente/i);
    expect(leadVerdict("hot")).toMatch(/hoje/i);
    expect(leadVerdict("cold")).toMatch(/frio/i);
  });
});
