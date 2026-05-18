import { describe, it, expect } from "vitest";
import { evaluateSlaBreach, notificationTypeFor } from "./breach";

const NOW = new Date("2026-05-18T12:00:00Z");

describe("evaluateSlaBreach", () => {
  it("returns none when the rule has no breach action", () => {
    expect(
      evaluateSlaBreach({
        createdAt: "2026-05-18T08:00:00Z",
        deadlineAt: "2026-05-18T10:00:00Z",
        breachAction: "none",
        warnThresholdPct: 80,
        alreadyActioned: false,
        at: NOW,
      })
    ).toBe("none");
  });

  it("returns none when the breach action was already applied", () => {
    expect(
      evaluateSlaBreach({
        createdAt: "2026-05-18T08:00:00Z",
        deadlineAt: "2026-05-18T10:00:00Z",
        breachAction: "escalate",
        warnThresholdPct: 80,
        alreadyActioned: true,
        at: NOW,
      })
    ).toBe("none");
  });

  it("returns breach when the deadline has passed", () => {
    expect(
      evaluateSlaBreach({
        createdAt: "2026-05-18T08:00:00Z",
        deadlineAt: "2026-05-18T10:00:00Z", // 2h ago
        breachAction: "notify",
        warnThresholdPct: 80,
        alreadyActioned: false,
        at: NOW,
      })
    ).toBe("breach");
  });

  it("returns warn once the elapsed fraction crosses the threshold", () => {
    // Window 08:00 -> 13:00 (5h). At 12:00, 4h elapsed = 80%.
    expect(
      evaluateSlaBreach({
        createdAt: "2026-05-18T08:00:00Z",
        deadlineAt: "2026-05-18T13:00:00Z",
        breachAction: "notify",
        warnThresholdPct: 80,
        alreadyActioned: false,
        at: NOW,
      })
    ).toBe("warn");
  });

  it("returns none while still under the warn threshold", () => {
    // Window 08:00 -> 20:00 (12h). At 12:00, 4h elapsed = 33%.
    expect(
      evaluateSlaBreach({
        createdAt: "2026-05-18T08:00:00Z",
        deadlineAt: "2026-05-18T20:00:00Z",
        breachAction: "escalate",
        warnThresholdPct: 80,
        alreadyActioned: false,
        at: NOW,
      })
    ).toBe("none");
  });

  it("returns none when the SLA window is uncomputable", () => {
    expect(
      evaluateSlaBreach({
        createdAt: null,
        deadlineAt: "2026-05-18T13:00:00Z",
        breachAction: "notify",
        warnThresholdPct: 80,
        alreadyActioned: false,
        at: NOW,
      })
    ).toBe("none");
  });
});

describe("notificationTypeFor", () => {
  it("maps a warning outcome to sla_warning", () => {
    expect(notificationTypeFor("warn", "notify")).toBe("sla_warning");
  });

  it("maps a breach with notify action to sla_breach", () => {
    expect(notificationTypeFor("breach", "notify")).toBe("sla_breach");
  });

  it("maps a breach with escalate action to sla_escalation", () => {
    expect(notificationTypeFor("breach", "escalate")).toBe("sla_escalation");
  });

  it("maps a none outcome to null", () => {
    expect(notificationTypeFor("none", "escalate")).toBeNull();
  });
});
