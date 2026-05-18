import { describe, it, expect } from "vitest";
import {
  parseDateOnly,
  formatDateOnly,
  formatTimestamp,
  formatDateTime,
} from "./dates";

describe("parseDateOnly", () => {
  it("parses a date-only string at local midnight (no UTC shift)", () => {
    const date = parseDateOnly("2026-05-15");
    expect(date).not.toBeNull();
    // The bug being fixed: `new Date("2026-05-15")` is UTC midnight and
    // shifts to the 14th in a negative-offset timezone (UTC-3).
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(4); // 0-based: May
    expect(date?.getDate()).toBe(15);
    expect(date?.getHours()).toBe(0);
  });

  it("ignores a trailing time component", () => {
    const date = parseDateOnly("2026-01-09T12:34:56Z");
    expect(date?.getDate()).toBe(9);
    expect(date?.getMonth()).toBe(0);
  });

  it("returns null for malformed input", () => {
    expect(parseDateOnly("not-a-date")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
  });

  it("rejects an overflowing day (e.g. Feb 31)", () => {
    expect(parseDateOnly("2026-02-31")).toBeNull();
  });
});

describe("formatDateOnly", () => {
  it("formats a date-only string in pt-BR without a day shift", () => {
    expect(formatDateOnly("2026-05-15")).toBe("15/05/2026");
  });

  it("formats the first day of the year correctly", () => {
    expect(formatDateOnly("2026-01-01")).toBe("01/01/2026");
  });

  it("falls back to the raw input when unparseable", () => {
    expect(formatDateOnly("garbage")).toBe("garbage");
    expect(formatDateOnly(null)).toBe("");
  });
});

describe("formatTimestamp", () => {
  it("formats a full ISO timestamp in pt-BR", () => {
    // A timestamp carries an explicit offset, so the calendar day is stable.
    expect(formatTimestamp("2026-05-15T12:00:00Z")).toBe("15/05/2026");
  });

  it("returns an empty string for missing or invalid input", () => {
    expect(formatTimestamp(null)).toBe("");
    expect(formatTimestamp(undefined)).toBe("");
    expect(formatTimestamp("")).toBe("");
    expect(formatTimestamp("not-a-timestamp")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("includes both the date and a HH:MM time component", () => {
    const result = formatDateTime("2026-05-15T12:30:00Z");
    // pt-BR date is dd/mm/aaaa; the time is appended as HH:MM.
    expect(result).toMatch(/15\/05\/2026/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("returns an empty string for missing or invalid input", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("not-a-timestamp")).toBe("");
  });
});
