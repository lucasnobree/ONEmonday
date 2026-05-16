/**
 * Date helpers for the Finance module.
 *
 * Finance stores calendar dates (`issue_date`, `due_date`, `expense_date`,
 * `period_month`) as date-only `YYYY-MM-DD` strings. Passing such a string to
 * `new Date(...)` parses it as **UTC midnight**, so a user in a negative-offset
 * timezone (e.g. `America/Sao_Paulo`, UTC-3) sees the date shifted back one
 * day. These helpers parse date-only strings in the *local* timezone so the
 * displayed day always matches what was entered.
 */

/**
 * Parses a date-only `YYYY-MM-DD` string into a `Date` at local midnight.
 * Returns `null` when the input is not a valid date-only string.
 */
export function parseDateOnly(input: string | null | undefined): Date | null {
  if (typeof input !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Guard against overflow (e.g. "2026-02-31").
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Formats a date-only `YYYY-MM-DD` string as a localized `pt-BR` date
 * (`dd/mm/aaaa`) without the UTC timezone shift. Falls back to the raw input
 * when it cannot be parsed.
 */
export function formatDateOnly(input: string | null | undefined): string {
  const date = parseDateOnly(input);
  if (!date) return input ?? "";
  return date.toLocaleDateString("pt-BR");
}

/** Today's date as a date-only `YYYY-MM-DD` string in the local timezone. */
export function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The current month as a `YYYY-MM` key in the local timezone. */
export function currentMonthKey(): string {
  return todayDateOnly().slice(0, 7);
}

/**
 * Returns the `YYYY-MM` key `offset` months away from `monthKey`
 * (negative = past). Pure string/number math, no timezone involved.
 */
export function shiftMonthKey(monthKey: string, offset: number): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  // Convert to a 0-based absolute month index, shift, convert back.
  const index = year * 12 + (month - 1) + offset;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/** Formats a `YYYY-MM` key as a `pt-BR` "month year" label (e.g. "maio de 2026"). */
export function formatMonthKey(monthKey: string): string {
  const date = parseDateOnly(`${monthKey}-01`);
  if (!date) return monthKey;
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
