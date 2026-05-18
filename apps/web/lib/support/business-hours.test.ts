import { describe, it, expect } from "vitest";
import {
  DEFAULT_BUSINESS_HOURS,
  isWorkingDay,
  isWithinBusinessHours,
  nextBusinessInstant,
  addBusinessHours,
  computeSlaDeadline,
  type BusinessHoursSchedule,
} from "./business-hours";

// All test dates use a fixed local clock. 2026-05-18 is a Monday;
// the same week runs Tue 19, Fri 22, Sat 23, Sun 24, next Mon 25.
const MON = (h: number, m = 0) => new Date(2026, 4, 18, h, m, 0);
const TUE = (h: number, m = 0) => new Date(2026, 4, 19, h, m, 0);
const SAT = (h: number, m = 0) => new Date(2026, 4, 23, h, m, 0);
const SUN = (h: number, m = 0) => new Date(2026, 4, 24, h, m, 0);
const NEXT_MON = (h: number, m = 0) => new Date(2026, 4, 25, h, m, 0);

describe("isWorkingDay", () => {
  it("treats Mon-Fri as working in the default schedule", () => {
    expect(isWorkingDay(DEFAULT_BUSINESS_HOURS, 1)).toBe(true); // Mon
    expect(isWorkingDay(DEFAULT_BUSINESS_HOURS, 5)).toBe(true); // Fri
  });

  it("treats Sat/Sun as non-working in the default schedule", () => {
    expect(isWorkingDay(DEFAULT_BUSINESS_HOURS, 0)).toBe(false); // Sun
    expect(isWorkingDay(DEFAULT_BUSINESS_HOURS, 6)).toBe(false); // Sat
  });
});

describe("isWithinBusinessHours", () => {
  it("is true inside the Mon-Fri 09-18 window", () => {
    expect(isWithinBusinessHours(DEFAULT_BUSINESS_HOURS, MON(10))).toBe(true);
  });

  it("is false before the window opens", () => {
    expect(isWithinBusinessHours(DEFAULT_BUSINESS_HOURS, MON(8))).toBe(false);
  });

  it("is false at and after the window closes", () => {
    expect(isWithinBusinessHours(DEFAULT_BUSINESS_HOURS, MON(18))).toBe(false);
    expect(isWithinBusinessHours(DEFAULT_BUSINESS_HOURS, MON(19))).toBe(false);
  });

  it("is false on a weekend even within window hours", () => {
    expect(isWithinBusinessHours(DEFAULT_BUSINESS_HOURS, SAT(11))).toBe(false);
  });
});

describe("nextBusinessInstant", () => {
  it("returns the instant unchanged when already inside the window", () => {
    const t = MON(11);
    expect(nextBusinessInstant(DEFAULT_BUSINESS_HOURS, t).getTime()).toBe(
      t.getTime()
    );
  });

  it("jumps a pre-open time to the window start", () => {
    expect(nextBusinessInstant(DEFAULT_BUSINESS_HOURS, MON(7))).toEqual(MON(9));
  });

  it("jumps an after-hours Friday past the weekend to Monday open", () => {
    const fri = new Date(2026, 4, 22, 20, 0, 0); // Fri 20:00
    expect(nextBusinessInstant(DEFAULT_BUSINESS_HOURS, fri)).toEqual(
      NEXT_MON(9)
    );
  });

  it("jumps a Sunday to Monday open", () => {
    expect(nextBusinessInstant(DEFAULT_BUSINESS_HOURS, SUN(12))).toEqual(
      NEXT_MON(9)
    );
  });
});

describe("addBusinessHours", () => {
  it("adds hours wholly inside a single working day", () => {
    expect(addBusinessHours(DEFAULT_BUSINESS_HOURS, MON(10), 3)).toEqual(
      MON(13)
    );
  });

  it("rolls overflow onto the next working day", () => {
    // Mon 16:00 + 4h: 2h consumed today (ends 18:00), 2h carries to Tue 09-11.
    expect(addBusinessHours(DEFAULT_BUSINESS_HOURS, MON(16), 4)).toEqual(
      TUE(11)
    );
  });

  it("skips the weekend", () => {
    // Fri 17:00 + 2h: 1h Friday, 1h carries to next Monday 09-10.
    const fri = new Date(2026, 4, 22, 17, 0, 0);
    expect(addBusinessHours(DEFAULT_BUSINESS_HOURS, fri, 2)).toEqual(
      NEXT_MON(10)
    );
  });

  it("anchors a start before the window to the window opening", () => {
    // Mon 06:00 + 1h => clock starts at 09:00 => 10:00.
    expect(addBusinessHours(DEFAULT_BUSINESS_HOURS, MON(6), 1)).toEqual(
      MON(10)
    );
  });

  it("returns the next business instant for a zero-hour window", () => {
    expect(addBusinessHours(DEFAULT_BUSINESS_HOURS, SAT(10), 0)).toEqual(
      NEXT_MON(9)
    );
  });
});

describe("computeSlaDeadline", () => {
  it("uses plain calendar time when business hours are off (24x7)", () => {
    const start = MON(16);
    const result = computeSlaDeadline({
      start,
      hours: 10,
      businessHoursOnly: false,
      schedule: DEFAULT_BUSINESS_HOURS,
    });
    expect(result).toEqual(new Date(start.getTime() + 10 * 3600 * 1000));
  });

  it("honours the business schedule when business hours are on", () => {
    const result = computeSlaDeadline({
      start: MON(16),
      hours: 4,
      businessHoursOnly: true,
      schedule: DEFAULT_BUSINESS_HOURS,
    });
    expect(result).toEqual(TUE(11));
  });

  it("honours a non-default schedule", () => {
    // Sat-only support, 10:00-14:00.
    const weekendOnly: BusinessHoursSchedule = {
      startMinute: 10 * 60,
      endMinute: 14 * 60,
      daysMask: 1 << 6, // Saturday only
    };
    const result = computeSlaDeadline({
      start: MON(9),
      hours: 2,
      businessHoursOnly: true,
      schedule: weekendOnly,
    });
    expect(result).toEqual(SAT(12));
  });
});
