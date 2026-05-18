import { describe, it, expect } from "vitest";
import {
  addDays,
  isEnrollmentDue,
  stepAt,
  evaluateStep,
  type EnrollmentState,
  type SequenceStep,
} from "./sequence-runner";

const NOW = "2026-05-18T12:00:00.000Z";

/** A two-step sequence: wait 3 days, then send an email. */
const twoStep: SequenceStep[] = [
  { stepOrder: 0, stepType: "wait", waitDays: 3, emailCampaignId: null },
  {
    stepOrder: 1,
    stepType: "send_email",
    waitDays: 0,
    emailCampaignId: "ec-1",
  },
];

function state(overrides: Partial<EnrollmentState> = {}): EnrollmentState {
  return {
    currentStep: 0,
    status: "active",
    nextRunAt: NOW,
    ...overrides,
  };
}

describe("addDays", () => {
  it("adds whole UTC days", () => {
    expect(addDays(NOW, 3)).toBe("2026-05-21T12:00:00.000Z");
  });

  it("is a no-op for zero days", () => {
    expect(addDays(NOW, 0)).toBe("2026-05-18T12:00:00.000Z");
  });
});

describe("isEnrollmentDue", () => {
  it("is due when active and next_run_at is at or before now", () => {
    expect(
      isEnrollmentDue({ status: "active", nextRunAt: NOW }, NOW)
    ).toBe(true);
    expect(
      isEnrollmentDue(
        { status: "active", nextRunAt: "2026-05-10T00:00:00.000Z" },
        NOW
      )
    ).toBe(true);
  });

  it("is not due when next_run_at is in the future", () => {
    expect(
      isEnrollmentDue(
        { status: "active", nextRunAt: "2026-06-01T00:00:00.000Z" },
        NOW
      )
    ).toBe(false);
  });

  it("is never due when not active", () => {
    expect(
      isEnrollmentDue({ status: "completed", nextRunAt: NOW }, NOW)
    ).toBe(false);
    expect(
      isEnrollmentDue({ status: "cancelled", nextRunAt: NOW }, NOW)
    ).toBe(false);
  });
});

describe("stepAt", () => {
  it("finds a step by its order in an unsorted list", () => {
    const unsorted = [...twoStep].reverse();
    expect(stepAt(unsorted, 1)?.stepType).toBe("send_email");
    expect(stepAt(unsorted, 0)?.stepType).toBe("wait");
  });

  it("returns undefined for a missing order", () => {
    expect(stepAt(twoStep, 9)).toBeUndefined();
  });
});

describe("evaluateStep", () => {
  it("a wait step delays the enrollment and advances the pointer", () => {
    const result = evaluateStep(state(), twoStep, NOW);
    expect(result.action).toEqual({
      kind: "wait",
      untilIso: "2026-05-21T12:00:00.000Z",
    });
    expect(result.nextState.currentStep).toBe(1);
    expect(result.nextState.status).toBe("active");
    expect(result.nextState.nextRunAt).toBe("2026-05-21T12:00:00.000Z");
  });

  it("a send_email step emits a send action and advances", () => {
    const result = evaluateStep(state({ currentStep: 1 }), twoStep, NOW);
    expect(result.action).toEqual({
      kind: "send_email",
      emailCampaignId: "ec-1",
    });
    // Past the last step now -> completed.
    expect(result.nextState.currentStep).toBe(2);
    expect(result.nextState.status).toBe("completed");
  });

  it("completes an enrollment positioned past the final step", () => {
    const result = evaluateStep(state({ currentStep: 5 }), twoStep, NOW);
    expect(result.action).toEqual({ kind: "complete" });
    expect(result.nextState.status).toBe("completed");
  });

  it("runs a multi-step sequence end to end", () => {
    let s = state();
    // Step 0: wait 3 days.
    let e = evaluateStep(s, twoStep, NOW);
    expect(e.action.kind).toBe("wait");
    s = e.nextState;

    // Step 1: 3 days later the send_email step is due.
    const later = s.nextRunAt;
    e = evaluateStep(s, twoStep, later);
    expect(e.action.kind).toBe("send_email");
    s = e.nextState;
    expect(s.status).toBe("completed");
  });

  it("skips a send_email step with no linked campaign instead of stalling", () => {
    const broken: SequenceStep[] = [
      {
        stepOrder: 0,
        stepType: "send_email",
        waitDays: 0,
        emailCampaignId: null,
      },
    ];
    const result = evaluateStep(state(), broken, NOW);
    expect(result.action.kind).toBe("skip");
    expect(result.nextState.currentStep).toBe(1);
    expect(result.nextState.status).toBe("completed");
  });

  it("skips a gap in the step list rather than stalling", () => {
    // Steps at order 0 and 2 — order 1 is missing.
    const gapped: SequenceStep[] = [
      { stepOrder: 0, stepType: "wait", waitDays: 1, emailCampaignId: null },
      {
        stepOrder: 2,
        stepType: "send_email",
        waitDays: 0,
        emailCampaignId: "ec-2",
      },
    ];
    const result = evaluateStep(state({ currentStep: 1 }), gapped, NOW);
    expect(result.action.kind).toBe("skip");
    expect(result.nextState.currentStep).toBe(2);
    expect(result.nextState.status).toBe("active");
  });

  it("treats a negative waitDays as zero", () => {
    const odd: SequenceStep[] = [
      { stepOrder: 0, stepType: "wait", waitDays: -5, emailCampaignId: null },
    ];
    const result = evaluateStep(state(), odd, NOW);
    expect(result.action).toEqual({ kind: "wait", untilIso: NOW });
  });

  it("an empty sequence completes immediately", () => {
    const result = evaluateStep(state(), [], NOW);
    expect(result.action).toEqual({ kind: "complete" });
    expect(result.nextState.status).toBe("completed");
  });
});
