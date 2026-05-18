import { describe, it, expect } from "vitest";
import {
  hoursSince,
  agingLabel,
  classifyLeadAging,
  type AgeableLead,
} from "./lead-aging";

/** A fixed "now" so the elapsed-time math is deterministic. */
const NOW = new Date("2026-05-18T12:00:00Z");

/** Builds an ISO string `hours` before NOW. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe("hoursSince", () => {
  it("counts whole elapsed hours", () => {
    expect(hoursSince(hoursAgo(3), NOW)).toBe(3);
    expect(hoursSince(hoursAgo(25), NOW)).toBe(25);
  });

  it("floors a partial hour", () => {
    const ninetyMin = new Date(NOW.getTime() - 90 * 60_000).toISOString();
    expect(hoursSince(ninetyMin, NOW)).toBe(1);
  });

  it("never returns a negative value for a future date", () => {
    expect(hoursSince(hoursAgo(-5), NOW)).toBe(0);
  });

  it("returns 0 for an unparseable date", () => {
    expect(hoursSince("not-a-date", NOW)).toBe(0);
  });
});

describe("agingLabel", () => {
  it("labels sub-hour ages in minutes", () => {
    const tenMin = new Date(NOW.getTime() - 10 * 60_000).toISOString();
    expect(agingLabel(tenMin, NOW)).toBe("há 10 min");
  });

  it("labels sub-day ages in hours", () => {
    expect(agingLabel(hoursAgo(5), NOW)).toBe("há 5 h");
  });

  it("labels a single day in the singular", () => {
    expect(agingLabel(hoursAgo(24), NOW)).toBe("há 1 dia");
  });

  it("labels multi-day ages in the plural", () => {
    expect(agingLabel(hoursAgo(72), NOW)).toBe("há 3 dias");
  });

  it("labels a just-received lead", () => {
    expect(agingLabel(NOW.toISOString(), NOW)).toBe("agora mesmo");
  });
});

describe("classifyLeadAging", () => {
  const newLead = (hours: number): AgeableLead => ({
    status: "new",
    created_at: hoursAgo(hours),
  });

  it("flags an untouched lead past the SLA as overdue", () => {
    const result = classifyLeadAging(newLead(30), 24, NOW);
    expect(result.state).toBe("overdue");
    expect(result.hours).toBe(30);
  });

  it("keeps an untouched lead inside the SLA as aging", () => {
    expect(classifyLeadAging(newLead(5), 24, NOW).state).toBe("aging");
  });

  it("treats a lead exactly at the SLA boundary as overdue", () => {
    expect(classifyLeadAging(newLead(24), 24, NOW).state).toBe("overdue");
  });

  it("never flags a worked/qualified/discarded lead", () => {
    for (const status of ["working", "qualified", "discarded"] as const) {
      const result = classifyLeadAging(
        { status, created_at: hoursAgo(200) },
        24,
        NOW
      );
      expect(result.state).toBe("ok");
    }
  });

  it("disables the overdue verdict when the SLA is 0", () => {
    expect(classifyLeadAging(newLead(500), 0, NOW).state).toBe("aging");
  });
});
