import { describe, it, expect } from "vitest";
import {
  createOffboardingTemplateSchema,
  startOffboardingSchema,
} from "./hr";

const SECTOR_ID = "3826e880-b077-4930-a676-7c5b96d10f63";
const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";

describe("createOffboardingTemplateSchema", () => {
  it("accepts a valid template with steps", () => {
    const result = createOffboardingTemplateSchema.safeParse({
      sectorId: SECTOR_ID,
      name: "Offboarding Padrão",
      items: [
        { title: "Entrevista de saída", dueDaysOffset: -3 },
        { title: "Revogar acessos", responsibleRole: "TI", dueDaysOffset: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a template with no steps", () => {
    const result = createOffboardingTemplateSchema.safeParse({
      sectorId: SECTOR_ID,
      name: "Vazio",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a step with an empty title", () => {
    const result = createOffboardingTemplateSchema.safeParse({
      sectorId: SECTOR_ID,
      name: "Offboarding",
      items: [{ title: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("allows a negative due-days offset (before the last day)", () => {
    const result = createOffboardingTemplateSchema.safeParse({
      sectorId: SECTOR_ID,
      name: "Offboarding",
      items: [{ title: "Entrevista", dueDaysOffset: -10 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a due-days offset beyond the allowed range", () => {
    const result = createOffboardingTemplateSchema.safeParse({
      sectorId: SECTOR_ID,
      name: "Offboarding",
      items: [{ title: "Etapa", dueDaysOffset: 9999 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("startOffboardingSchema", () => {
  it("accepts a valid start payload with a reason", () => {
    const result = startOffboardingSchema.safeParse({
      employeeId: EMPLOYEE_ID,
      templateId: TEMPLATE_ID,
      terminationDate: "2026-06-30",
      reason: "voluntary",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a start payload without a reason", () => {
    const result = startOffboardingSchema.safeParse({
      employeeId: EMPLOYEE_ID,
      templateId: TEMPLATE_ID,
      terminationDate: "2026-06-30",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown reason", () => {
    const result = startOffboardingSchema.safeParse({
      employeeId: EMPLOYEE_ID,
      templateId: TEMPLATE_ID,
      terminationDate: "2026-06-30",
      reason: "fired-for-cause",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing termination date", () => {
    const result = startOffboardingSchema.safeParse({
      employeeId: EMPLOYEE_ID,
      templateId: TEMPLATE_ID,
      terminationDate: "",
    });
    expect(result.success).toBe(false);
  });
});
