import { describe, it, expect } from "vitest";
import {
  matterPriorityWeight,
  compareMatterByPriority,
  matterDueStatus,
} from "./matters";

describe("matterPriorityWeight", () => {
  it("orders urgent before high before medium before low", () => {
    expect(matterPriorityWeight("urgent")).toBeLessThan(
      matterPriorityWeight("high")
    );
    expect(matterPriorityWeight("high")).toBeLessThan(
      matterPriorityWeight("medium")
    );
    expect(matterPriorityWeight("medium")).toBeLessThan(
      matterPriorityWeight("low")
    );
  });

  it("sinks an unknown priority to the bottom", () => {
    expect(matterPriorityWeight("mystery")).toBeGreaterThan(
      matterPriorityWeight("low")
    );
  });
});

describe("compareMatterByPriority", () => {
  it("sorts a list urgent-first", () => {
    const sorted = [
      { priority: "low" },
      { priority: "urgent" },
      { priority: "medium" },
      { priority: "high" },
    ]
      .slice()
      .sort(compareMatterByPriority);
    expect(sorted.map((m) => m.priority)).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
    ]);
  });
});

describe("matterDueStatus", () => {
  const from = new Date(2026, 4, 18); // 18 May 2026, local

  it("reports no urgency when there is no due date", () => {
    const s = matterDueStatus(null, "open", from);
    expect(s.urgency).toBe("none");
    expect(s.variant).toBeNull();
    expect(s.label).toBeNull();
  });

  it("flags an overdue matter as destructive", () => {
    const s = matterDueStatus("2026-05-10", "open", from);
    expect(s.urgency).toBe("overdue");
    expect(s.variant).toBe("destructive");
    expect(s.label).toBe("Atrasada 8d");
  });

  it("flags a matter due within a week as soon", () => {
    const s = matterDueStatus("2026-05-22", "in_progress", from);
    expect(s.urgency).toBe("soon");
    expect(s.variant).toBe("secondary");
    expect(s.label).toBe("Vence em 4d");
  });

  it("labels a matter due today distinctly", () => {
    const s = matterDueStatus("2026-05-18", "open", from);
    expect(s.urgency).toBe("soon");
    expect(s.label).toBe("Vence hoje");
  });

  it("does not badge a matter due comfortably in the future", () => {
    const s = matterDueStatus("2026-07-01", "open", from);
    expect(s.urgency).toBe("ok");
    expect(s.variant).toBeNull();
  });

  it("suppresses the urgency signal for resolved/closed matters", () => {
    for (const status of ["resolved", "closed"]) {
      const s = matterDueStatus("2026-05-01", status, from);
      expect(s.urgency).toBe("ok");
      expect(s.variant).toBeNull();
      expect(s.label).toBeNull();
    }
  });
});
