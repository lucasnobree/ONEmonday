import { describe, it, expect } from "vitest";
import {
  parseDateOnly,
  formatDateOnly,
  formatTimestamp,
  todayDateOnly,
  currentMonthKey,
  shiftMonthKey,
  formatMonthKey,
} from "./dates";

describe("formatTimestamp", () => {
  it("formats an ISO timestamp with both date and HH:MM time", () => {
    const result = formatTimestamp("2026-05-15T12:30:00Z");
    expect(result).toMatch(/15\/05\/2026/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("returns an empty string for missing or invalid input", () => {
    expect(formatTimestamp(null)).toBe("");
    expect(formatTimestamp(undefined)).toBe("");
    expect(formatTimestamp("")).toBe("");
    expect(formatTimestamp("not-a-timestamp")).toBe("");
  });
});

describe("parseDateOnly", () => {
  it("parses a date-only string at local midnight (no UTC shift)", () => {
    const date = parseDateOnly("2026-05-15");
    expect(date).not.toBeNull();
    // Local components must match the input exactly — the bug being fixed is
    // that `new Date("2026-05-15")` is UTC midnight and shifts to the 14th
    // in a negative-offset timezone.
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
    expect(parseDateOnly("2026-13")).toBeNull();
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

describe("todayDateOnly", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayDateOnly()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("currentMonthKey", () => {
  it("returns a YYYY-MM string", () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("shiftMonthKey", () => {
  it("moves forward within a year", () => {
    expect(shiftMonthKey("2026-05", 2)).toBe("2026-07");
  });

  it("moves backward within a year", () => {
    expect(shiftMonthKey("2026-05", -3)).toBe("2026-02");
  });

  it("rolls over a year boundary forward", () => {
    expect(shiftMonthKey("2026-11", 3)).toBe("2027-02");
  });

  it("rolls over a year boundary backward", () => {
    expect(shiftMonthKey("2026-02", -3)).toBe("2025-11");
  });

  it("is a no-op for offset 0", () => {
    expect(shiftMonthKey("2026-05", 0)).toBe("2026-05");
  });
});

describe("formatMonthKey", () => {
  it("formats a month key as a pt-BR month-year label", () => {
    // Only the first letter is capitalized — the preposition stays lowercase
    // ("Maio de 2026", never the title-cased "Maio De 2026").
    expect(formatMonthKey("2026-05")).toBe("Maio de 2026");
  });

  it("keeps the preposition lowercase", () => {
    expect(formatMonthKey("2026-12")).toBe("Dezembro de 2026");
  });

  it("falls back to the raw key when unparseable", () => {
    expect(formatMonthKey("nope")).toBe("nope");
  });
});
