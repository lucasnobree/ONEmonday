import { describe, it, expect } from "vitest";
import {
  isSlaBreached,
  computeResponseBreachOnResolve,
  slaHealthFromPercentRemaining,
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
