// Pure business-hours helpers for the Support Desk SLA engine.
//
// Wave 4 audit S1: the "Horário Comercial" flag was cosmetic — nothing
// defined what business hours are or honoured them. These helpers add a real
// weekly schedule (a working-day window + a working-days bitset) and project
// an SLA deadline forward through it: the clock only counts time that falls
// inside the schedule.
//
// Kept free of Supabase/React/Date-library dependencies so they are fully
// unit-testable. Timezone handling is intentionally simple — the schedule is
// interpreted against the *local* getters of the JS Date passed in. The
// caller (a server action) is responsible for supplying a Date in the
// business timezone; for the dev/demo environment UTC is acceptable.

/** A weekly business-hours schedule attached to an SLA rule. */
export interface BusinessHoursSchedule {
  /** Local working-day start, minutes from midnight (e.g. 540 = 09:00). */
  startMinute: number;
  /** Local working-day end, minutes from midnight (e.g. 1080 = 18:00). */
  endMinute: number;
  /**
   * Working-days bitset: bit 0 = Sunday ... bit 6 = Saturday.
   * 62 (0b0111110) = Monday-Friday.
   */
  daysMask: number;
}

/** The conventional Monday-Friday, 09:00-18:00 schedule. */
export const DEFAULT_BUSINESS_HOURS: BusinessHoursSchedule = {
  startMinute: 9 * 60,
  endMinute: 18 * 60,
  daysMask: 62,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Whether a given weekday index (0 = Sunday) is a working day. */
export function isWorkingDay(
  schedule: BusinessHoursSchedule,
  weekday: number
): boolean {
  return (schedule.daysMask & (1 << weekday)) !== 0;
}

/** Minutes-from-midnight for a Date, using its local clock. */
function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/**
 * Whether `at` falls inside the business-hours window — both a working day
 * and within the daily start/end window.
 */
export function isWithinBusinessHours(
  schedule: BusinessHoursSchedule,
  at: Date
): boolean {
  if (!isWorkingDay(schedule, at.getDay())) return false;
  const m = minuteOfDay(at);
  return m >= schedule.startMinute && m < schedule.endMinute;
}

/** Length of one business day in milliseconds. */
function dailyWindowMs(schedule: BusinessHoursSchedule): number {
  return (schedule.endMinute - schedule.startMinute) * MINUTE_MS;
}

/** The start-of-window Date for the calendar day `date` falls on. */
function windowStart(schedule: BusinessHoursSchedule, date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + schedule.startMinute * MINUTE_MS);
}

/** The end-of-window Date for the calendar day `date` falls on. */
function windowEnd(schedule: BusinessHoursSchedule, date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + schedule.endMinute * MINUTE_MS);
}

/**
 * Advance `from` to the next instant that is inside the business-hours
 * window. If `from` is already inside, it is returned unchanged.
 */
export function nextBusinessInstant(
  schedule: BusinessHoursSchedule,
  from: Date
): Date {
  let cursor = new Date(from);
  // Bounded loop: at most 8 calendar-day hops covers any weekly schedule.
  for (let i = 0; i < 8; i++) {
    if (isWorkingDay(schedule, cursor.getDay())) {
      const start = windowStart(schedule, cursor);
      const end = windowEnd(schedule, cursor);
      if (cursor < start) return start;
      if (cursor < end) return cursor;
    }
    // Move to the start of the next calendar day.
    const nextDay = new Date(cursor);
    nextDay.setHours(0, 0, 0, 0);
    cursor = new Date(nextDay.getTime() + DAY_MS);
  }
  return cursor;
}

/**
 * Project a deadline forward from `start` by `hours` of *business* time.
 *
 * Only time inside the schedule's working window is consumed; nights,
 * weekends and non-working days are skipped. When `hours` is 0 the schedule
 * is still honoured — the deadline is simply the next business instant.
 */
export function addBusinessHours(
  schedule: BusinessHoursSchedule,
  start: Date,
  hours: number
): Date {
  let remainingMs = Math.max(0, hours) * 60 * MINUTE_MS;
  let cursor = nextBusinessInstant(schedule, start);
  const perDay = dailyWindowMs(schedule);
  if (perDay <= 0) return cursor;

  // Bounded: a window of >= 1h/day consumes at most ~10 years of `hours`
  // before the guard trips; the guard exists only to prevent a hard hang.
  for (let i = 0; i < 100000 && remainingMs > 0; i++) {
    const dayEnd = windowEnd(schedule, cursor);
    const availableToday = dayEnd.getTime() - cursor.getTime();
    if (remainingMs <= availableToday) {
      return new Date(cursor.getTime() + remainingMs);
    }
    remainingMs -= availableToday;
    // Jump to the next business window start.
    cursor = nextBusinessInstant(schedule, new Date(dayEnd.getTime() + 1));
  }
  return cursor;
}

/**
 * Compute an SLA deadline `hours` ahead of `start`. When `businessHoursOnly`
 * is false the deadline is plain calendar time (24x7); otherwise the
 * business-hours schedule is honoured.
 */
export function computeSlaDeadline(params: {
  start: Date;
  hours: number;
  businessHoursOnly: boolean;
  schedule: BusinessHoursSchedule;
}): Date {
  const { start, hours, businessHoursOnly, schedule } = params;
  if (!businessHoursOnly) {
    return new Date(start.getTime() + Math.max(0, hours) * 60 * MINUTE_MS);
  }
  return addBusinessHours(schedule, start, hours);
}
