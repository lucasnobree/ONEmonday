import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatPercent,
  attainmentHealth,
  mapMetricsRow,
  EMPTY_METRICS,
} from "./metrics";

describe("formatDuration", () => {
  it("returns an em dash for null/undefined/NaN", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
  });

  it("collapses sub-minute durations", () => {
    expect(formatDuration(0)).toBe("<1min");
    expect(formatDuration(0.4)).toBe("<1min");
  });

  it("formats minutes under an hour", () => {
    expect(formatDuration(42)).toBe("42min");
    expect(formatDuration(59.6)).toBe("1h"); // rounds to 60
  });

  it("formats hours, dropping a zero minute remainder", () => {
    expect(formatDuration(180)).toBe("3h");
    expect(formatDuration(195)).toBe("3h 15m");
  });

  it("formats days, dropping a zero hour remainder", () => {
    expect(formatDuration(2 * 24 * 60)).toBe("2d");
    expect(formatDuration(2 * 24 * 60 + 4 * 60)).toBe("2d 4h");
  });
});

describe("formatPercent", () => {
  it("returns an em dash for null", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("rounds to a whole percent", () => {
    expect(formatPercent(96.7)).toBe("97%");
    expect(formatPercent(100)).toBe("100%");
  });
});

describe("attainmentHealth", () => {
  it("is neutral when unknown", () => {
    expect(attainmentHealth(null)).toBe("neutral");
  });

  it("buckets by threshold", () => {
    expect(attainmentHealth(98)).toBe("good");
    expect(attainmentHealth(95)).toBe("good");
    expect(attainmentHealth(85)).toBe("warning");
    expect(attainmentHealth(80)).toBe("warning");
    expect(attainmentHealth(50)).toBe("bad");
  });
});

describe("mapMetricsRow", () => {
  it("returns EMPTY_METRICS for a missing row", () => {
    expect(mapMetricsRow(null)).toEqual(EMPTY_METRICS);
    expect(mapMetricsRow(undefined)).toEqual(EMPTY_METRICS);
  });

  it("maps numeric and numeric-string columns", () => {
    const result = mapMetricsRow({
      avg_first_response_minutes: 42.5,
      avg_resolution_minutes: "320",
      sla_attainment_pct: 97.1,
      oldest_backlog_minutes: null,
      open_backlog_count: 7,
    });
    expect(result).toEqual({
      avgFirstResponseMinutes: 42.5,
      avgResolutionMinutes: 320,
      slaAttainmentPct: 97.1,
      oldestBacklogMinutes: null,
      openBacklogCount: 7,
    });
  });

  it("defaults a missing backlog count to zero", () => {
    expect(mapMetricsRow({}).openBacklogCount).toBe(0);
  });
});
