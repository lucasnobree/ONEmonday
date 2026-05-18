import { describe, it, expect } from "vitest";
import {
  createEmployeeSchema,
  requestTimeOffSchema,
  createOnboardingTemplateSchema,
  updateJobOpeningSchema,
  upsertSelfAssessmentSchema,
  submitSurveyResponseSchema,
} from "./hr";

const SECTOR = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE = "22222222-2222-4222-8222-222222222222";
const POLICY = "33333333-3333-4333-8333-333333333333";
const OPENING = "44444444-4444-4444-8444-444444444444";
const CYCLE = "55555555-5555-4555-8555-555555555555";
const SURVEY = "66666666-6666-4666-8666-666666666666";
const QUESTION = "77777777-7777-4777-8777-777777777777";

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

describe("updateJobOpeningSchema", () => {
  const base = {
    openingId: OPENING,
    title: "Analista de Suporte",
  };

  it("accepts a minimal vaga edit and defaults employmentType", () => {
    const parsed = updateJobOpeningSchema.parse(base);
    expect(parsed.employmentType).toBe("full_time");
  });

  it("rejects a blank title", () => {
    expect(
      updateJobOpeningSchema.safeParse({ ...base, title: "" }).success
    ).toBe(false);
  });

  it("rejects a non-uuid opening id", () => {
    expect(
      updateJobOpeningSchema.safeParse({ ...base, openingId: "abc" }).success
    ).toBe(false);
  });
});

describe("upsertSelfAssessmentSchema", () => {
  it("accepts a draft with only a cycle id and defaults submit to false", () => {
    const parsed = upsertSelfAssessmentSchema.parse({ cycleId: CYCLE });
    expect(parsed.submit).toBe(false);
  });

  it("rejects a performance score outside 1-3", () => {
    expect(
      upsertSelfAssessmentSchema.safeParse({
        cycleId: CYCLE,
        performanceScore: 4,
      }).success
    ).toBe(false);
  });

  it("rejects an overall rating outside 1-5", () => {
    expect(
      upsertSelfAssessmentSchema.safeParse({
        cycleId: CYCLE,
        overallRating: 9,
      }).success
    ).toBe(false);
  });
});

describe("submitSurveyResponseSchema", () => {
  const base = {
    surveyId: SURVEY,
    employeeId: EMPLOYEE,
    answers: [{ questionId: QUESTION, scoreValue: 4 }],
  };

  it("accepts a response carrying the responding employee id", () => {
    expect(submitSurveyResponseSchema.safeParse(base).success).toBe(true);
  });

  it("requires the employee id for the one-response guard", () => {
    const { employeeId: _omit, ...withoutEmployee } = base;
    void _omit;
    expect(submitSurveyResponseSchema.safeParse(withoutEmployee).success).toBe(
      false
    );
  });

  it("rejects an empty answer list", () => {
    expect(
      submitSurveyResponseSchema.safeParse({ ...base, answers: [] }).success
    ).toBe(false);
  });

  it("rejects a score outside the 0-10 range", () => {
    expect(
      submitSurveyResponseSchema.safeParse({
        ...base,
        answers: [{ questionId: QUESTION, scoreValue: 11 }],
      }).success
    ).toBe(false);
  });
});
