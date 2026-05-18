import { describe, it, expect } from "vitest";
import {
  isSlaBreached,
  computeResponseBreachOnResolve,
  slaHealthFromPercentRemaining,
  isSlaPausedStatus,
  computeSlaPauseTransition,
} from "./sla";

const NOW = new Date("2026-05-15T12:00:00Z");

describe("isSlaBreached", () => {
  it("returns false when no deadline is set", () => {
    expect(isSlaBreached(null, NOW)).toBe(false);
    expect(isSlaBreached(undefined, NOW)).toBe(false);
  });

  it("returns false when the deadline is still in the future", () => {
    expect(isSlaBreached("2026-05-15T13:00:00Z", NOW)).toBe(false);
  });

  it("returns true when the deadline has already passed", () => {
    expect(isSlaBreached("2026-05-15T11:00:00Z", NOW)).toBe(true);
  });

  it("treats an exactly-equal deadline as not breached", () => {
    expect(isSlaBreached("2026-05-15T12:00:00Z", NOW)).toBe(false);
  });
});

describe("computeResponseBreachOnResolve", () => {
  it("keeps an already-breached flag", () => {
    expect(
      computeResponseBreachOnResolve({
        alreadyBreached: true,
        firstResponseAt: "2026-05-15T11:00:00Z",
        responseDueAt: "2026-05-15T13:00:00Z",
        at: NOW,
      })
    ).toBe(true);
  });

  it("is not breached when a first response was recorded", () => {
    expect(
      computeResponseBreachOnResolve({
        alreadyBreached: false,
        firstResponseAt: "2026-05-15T11:30:00Z",
        responseDueAt: "2026-05-15T11:00:00Z",
        at: NOW,
      })
    ).toBe(false);
  });

  it("is breached when resolved with no response past the deadline", () => {
    expect(
      computeResponseBreachOnResolve({
        alreadyBreached: false,
        firstResponseAt: null,
        responseDueAt: "2026-05-15T11:00:00Z",
        at: NOW,
      })
    ).toBe(true);
  });

  it("is not breached when resolved with no response before the deadline", () => {
    expect(
      computeResponseBreachOnResolve({
        alreadyBreached: false,
        firstResponseAt: null,
        responseDueAt: "2026-05-15T13:00:00Z",
        at: NOW,
      })
    ).toBe(false);
  });

  it("is not breached when no response deadline exists", () => {
    expect(
      computeResponseBreachOnResolve({
        alreadyBreached: false,
        firstResponseAt: null,
        responseDueAt: null,
        at: NOW,
      })
    ).toBe(false);
  });
});

describe("slaHealthFromPercentRemaining", () => {
  it("buckets a healthy percentage as ok", () => {
    expect(slaHealthFromPercentRemaining(80)).toBe("ok");
    expect(slaHealthFromPercentRemaining(51)).toBe("ok");
  });

  it("buckets the 25-50 range as warning", () => {
    expect(slaHealthFromPercentRemaining(50)).toBe("warning");
    expect(slaHealthFromPercentRemaining(25)).toBe("warning");
  });

  it("buckets below 25 as critical", () => {
    expect(slaHealthFromPercentRemaining(24.9)).toBe("critical");
    expect(slaHealthFromPercentRemaining(1)).toBe("critical");
  });

  it("buckets zero or negative as breached", () => {
    expect(slaHealthFromPercentRemaining(0)).toBe("breached");
    expect(slaHealthFromPercentRemaining(-10)).toBe("breached");
  });
});

describe("isSlaPausedStatus", () => {
  it("treats pending and on_hold as paused", () => {
    expect(isSlaPausedStatus("pending")).toBe(true);
    expect(isSlaPausedStatus("on_hold")).toBe(true);
  });

  it("treats new, open and resolved as not paused", () => {
    expect(isSlaPausedStatus("new")).toBe(false);
    expect(isSlaPausedStatus("open")).toBe(false);
    expect(isSlaPausedStatus("resolved")).toBe(false);
  });
});

describe("computeSlaPauseTransition", () => {
  const RESPONSE_DUE = "2026-05-15T14:00:00Z";
  const RESOLVE_DUE = "2026-05-15T18:00:00Z";

  it("records the pause start when entering a paused status", () => {
    const result = computeSlaPauseTransition({
      fromStatus: "open",
      toStatus: "pending",
      slaPausedAt: null,
      slaResponseDueAt: RESPONSE_DUE,
      slaResolveDueAt: RESOLVE_DUE,
      at: NOW,
    });
    expect(result.slaPausedAt).toBe(NOW.toISOString());
    // Due dates are untouched while paused.
    expect(result.slaResponseDueAt).toBe(RESPONSE_DUE);
    expect(result.slaResolveDueAt).toBe(RESOLVE_DUE);
    expect(result.pausedMsAdded).toBe(0);
  });

  it("extends both due dates by the paused span when resuming", () => {
    // Paused for 2 hours (10:00 -> 12:00).
    const result = computeSlaPauseTransition({
      fromStatus: "pending",
      toStatus: "open",
      slaPausedAt: "2026-05-15T10:00:00Z",
      slaResponseDueAt: RESPONSE_DUE,
      slaResolveDueAt: RESOLVE_DUE,
      at: NOW,
    });
    expect(result.slaPausedAt).toBeNull();
    expect(result.pausedMsAdded).toBe(2 * 60 * 60 * 1000);
    expect(result.slaResponseDueAt).toBe("2026-05-15T16:00:00.000Z");
    expect(result.slaResolveDueAt).toBe("2026-05-15T20:00:00.000Z");
  });

  it("leaves bookkeeping untouched for an active-to-active transition", () => {
    const result = computeSlaPauseTransition({
      fromStatus: "new",
      toStatus: "open",
      slaPausedAt: null,
      slaResponseDueAt: RESPONSE_DUE,
      slaResolveDueAt: RESOLVE_DUE,
      at: NOW,
    });
    expect(result.slaPausedAt).toBeNull();
    expect(result.pausedMsAdded).toBe(0);
    expect(result.slaResponseDueAt).toBe(RESPONSE_DUE);
    expect(result.slaResolveDueAt).toBe(RESOLVE_DUE);
  });

  it("clears the pause clock when resolving from a paused status", () => {
    const result = computeSlaPauseTransition({
      fromStatus: "on_hold",
      toStatus: "resolved",
      slaPausedAt: "2026-05-15T11:00:00Z",
      slaResponseDueAt: RESPONSE_DUE,
      slaResolveDueAt: RESOLVE_DUE,
      at: NOW,
    });
    expect(result.slaPausedAt).toBeNull();
    expect(result.pausedMsAdded).toBe(60 * 60 * 1000);
  });

  it("handles null due dates without throwing", () => {
    const result = computeSlaPauseTransition({
      fromStatus: "pending",
      toStatus: "open",
      slaPausedAt: "2026-05-15T11:00:00Z",
      slaResponseDueAt: null,
      slaResolveDueAt: null,
      at: NOW,
    });
    expect(result.slaResponseDueAt).toBeNull();
    expect(result.slaResolveDueAt).toBeNull();
    expect(result.pausedMsAdded).toBe(60 * 60 * 1000);
  });
});
