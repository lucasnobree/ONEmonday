import { describe, it, expect } from "vitest";
import {
  createEmployeeSchema,
  requestTimeOffSchema,
  createOnboardingTemplateSchema,
} from "./hr";

const SECTOR = "11111111-1111-1111-1111-111111111111";
const EMPLOYEE = "22222222-2222-2222-2222-222222222222";
const POLICY = "33333333-3333-3333-3333-333333333333";

describe("createEmployeeSchema", () => {
  const base = {
    sectorId: SECTOR,
    fullName: "Ana Silva",
    position: "Analista",
    hireDate: "2026-01-10",
  };

  it("accepts a minimal valid employee", () => {
    expect(createEmployeeSchema.safeParse(base).success).toBe(true);
  });

  it("defaults employmentType to full_time", () => {
    const parsed = createEmployeeSchema.parse(base);
    expect(parsed.employmentType).toBe("full_time");
  });

  it("accepts an optional manager and birth date", () => {
    const result = createEmployeeSchema.safeParse({
      ...base,
      managerId: EMPLOYEE,
      birthDate: "1990-05-01",
      phone: "+55 11 90000-0000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank full name", () => {
    expect(
      createEmployeeSchema.safeParse({ ...base, fullName: "" }).success
    ).toBe(false);
  });

  it("rejects a non-uuid manager id", () => {
    expect(
      createEmployeeSchema.safeParse({ ...base, managerId: "abc" }).success
    ).toBe(false);
  });

  it("rejects an invalid employment type", () => {
    expect(
      createEmployeeSchema.safeParse({ ...base, employmentType: "freelance" })
        .success
    ).toBe(false);
  });
});

describe("requestTimeOffSchema", () => {
  const base = {
    employeeId: EMPLOYEE,
    sectorId: SECTOR,
    policyId: POLICY,
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    daysCount: 5,
  };

  it("accepts a valid request", () => {
    expect(requestTimeOffSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a non-positive day count", () => {
    expect(requestTimeOffSchema.safeParse({ ...base, daysCount: 0 }).success).toBe(
      false
    );
  });

  it("rejects a fractional day count", () => {
    expect(
      requestTimeOffSchema.safeParse({ ...base, daysCount: 1.5 }).success
    ).toBe(false);
  });
});

describe("createOnboardingTemplateSchema", () => {
  const base = {
    sectorId: SECTOR,
    position: "Desenvolvedor",
    name: "Onboarding Dev",
  };

  it("defaults items to an empty array", () => {
    const parsed = createOnboardingTemplateSchema.parse(base);
    expect(parsed.items).toEqual([]);
  });

  it("accepts items with offsets", () => {
    const result = createOnboardingTemplateSchema.safeParse({
      ...base,
      items: [
        { title: "Criar contas", responsibleRole: "TI", dueDaysAfterHire: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an item with a blank title", () => {
    const result = createOnboardingTemplateSchema.safeParse({
      ...base,
      items: [{ title: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative due-days offset", () => {
    const result = createOnboardingTemplateSchema.safeParse({
      ...base,
      items: [{ title: "Etapa", dueDaysAfterHire: -3 }],
    });
    expect(result.success).toBe(false);
  });
});
