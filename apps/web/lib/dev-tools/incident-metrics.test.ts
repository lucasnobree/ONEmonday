import { describe, it, expect } from "vitest";
import {
  isIncidentOpen,
  severityWeight,
  timeToAcknowledge,
  timeToResolve,
  summarizeIncidents,
  resolveLifecycleTimestamps,
  formatDuration,
  type IncidentLike,
} from "./incident-metrics";

const incident = (over: Partial<IncidentLike>): IncidentLike => ({
  status: "investigating",
  severity: "sev3",
  created_at: "2026-05-01T10:00:00Z",
  acknowledged_at: null,
  resolved_at: null,
  ...over,
});

describe("isIncidentOpen", () => {
  it("is open until resolved", () => {
    expect(isIncidentOpen({ status: "investigating" })).toBe(true);
    expect(isIncidentOpen({ status: "monitoring" })).toBe(true);
    expect(isIncidentOpen({ status: "resolved" })).toBe(false);
  });
});

describe("severityWeight", () => {
  it("orders sev1 ahead of sev4", () => {
    expect(severityWeight("sev1")).toBeLessThan(severityWeight("sev4"));
  });

  it("sorts unknown severities last", () => {
    expect(severityWeight("???")).toBeGreaterThan(severityWeight("sev4"));
  });
});

describe("timeToAcknowledge / timeToResolve", () => {
  it("computes minutes between timestamps", () => {
    const inc = incident({
      acknowledged_at: "2026-05-01T10:30:00Z",
      resolved_at: "2026-05-01T12:00:00Z",
    });
    expect(timeToAcknowledge(inc)).toBe(30);
    expect(timeToResolve(inc)).toBe(120);
  });

  it("returns null when a timestamp is missing", () => {
    expect(timeToResolve(incident({}))).toBeNull();
  });

  it("clamps negative durations (clock skew) to 0", () => {
    const inc = incident({ resolved_at: "2026-05-01T09:00:00Z" });
    expect(timeToResolve(inc)).toBe(0);
  });
});

describe("summarizeIncidents", () => {
  it("aggregates open/resolved counts, MTTA/MTTR and open-by-severity", () => {
    const data = [
      incident({
        severity: "sev1",
        status: "resolved",
        acknowledged_at: "2026-05-01T10:20:00Z",
        resolved_at: "2026-05-01T11:00:00Z",
      }),
      incident({ severity: "sev2", status: "investigating" }),
      incident({ severity: "sev2", status: "monitoring" }),
    ];
    const m = summarizeIncidents(data);
    expect(m.total).toBe(3);
    expect(m.open).toBe(2);
    expect(m.resolved).toBe(1);
    expect(m.mttaMinutes).toBe(20);
    expect(m.mttrMinutes).toBe(60);
    expect(m.openBySeverity).toEqual({ sev2: 2 });
  });

  it("returns null MTTA/MTTR when there is no data", () => {
    const m = summarizeIncidents([]);
    expect(m.mttaMinutes).toBeNull();
    expect(m.mttrMinutes).toBeNull();
  });
});

describe("resolveLifecycleTimestamps", () => {
  const NOW = "2026-05-02T00:00:00Z";

  it("stamps acknowledged_at when leaving investigating", () => {
    const r = resolveLifecycleTimestamps(
      "identified",
      { acknowledged_at: null, resolved_at: null },
      NOW
    );
    expect(r.acknowledged_at).toBe(NOW);
    expect(r.resolved_at).toBeNull();
  });

  it("keeps an existing acknowledged_at", () => {
    const r = resolveLifecycleTimestamps(
      "monitoring",
      { acknowledged_at: "2026-05-01T10:00:00Z", resolved_at: null },
      NOW
    );
    expect(r.acknowledged_at).toBe("2026-05-01T10:00:00Z");
  });

  it("stamps resolved_at on resolve and clears it on reopen", () => {
    const resolved = resolveLifecycleTimestamps(
      "resolved",
      { acknowledged_at: NOW, resolved_at: null },
      NOW
    );
    expect(resolved.resolved_at).toBe(NOW);

    const reopened = resolveLifecycleTimestamps(
      "investigating",
      { acknowledged_at: NOW, resolved_at: NOW },
      NOW
    );
    expect(reopened.resolved_at).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats minutes, hours and days", () => {
    expect(formatDuration(null)).toBe("-");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(192)).toBe("3h 12m");
    expect(formatDuration(60 * 24 * 2 + 60 * 4)).toBe("2d 4h");
  });
});
