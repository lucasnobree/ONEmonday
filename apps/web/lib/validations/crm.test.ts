import { describe, it, expect } from "vitest";
import { closeDealLostSchema, stageDefaultSchema } from "./crm";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("closeDealLostSchema", () => {
  it("accepts a valid closed-lost payload", () => {
    const result = closeDealLostSchema.safeParse({
      dealId: UUID,
      category: "competitor",
      reason: "Cliente escolheu concorrente X",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown lost-reason category", () => {
    const result = closeDealLostSchema.safeParse({
      dealId: UUID,
      category: "bad fit",
      reason: "algo",
    });
    expect(result.success).toBe(false);
  });

  it("requires a non-empty reason note", () => {
    const result = closeDealLostSchema.safeParse({
      dealId: UUID,
      category: "price",
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid deal id", () => {
    const result = closeDealLostSchema.safeParse({
      dealId: "not-a-uuid",
      category: "timing",
      reason: "motivo",
    });
    expect(result.success).toBe(false);
  });
});

describe("stageDefaultSchema", () => {
  it("defaults rotting_days to 0 when omitted", () => {
    const result = stageDefaultSchema.safeParse({
      stage_name: "Negociacao",
      default_probability: 50,
      position: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rotting_days).toBe(0);
  });

  it("rejects probability outside 0-100", () => {
    const result = stageDefaultSchema.safeParse({
      stage_name: "Negociacao",
      default_probability: 150,
      position: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative rotting threshold", () => {
    const result = stageDefaultSchema.safeParse({
      stage_name: "Negociacao",
      default_probability: 50,
      position: 0,
      rotting_days: -1,
    });
    expect(result.success).toBe(false);
  });
});
