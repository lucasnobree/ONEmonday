/**
 * Date helpers for the Legal module.
 *
 * Legal stores calendar dates (`effective_date`, `expiry_date`, `due_date`,
 * the computed notice `deadline`) as date-only `YYYY-MM-DD` strings. Passing
 * such a string to `new Date(...)` parses it as **UTC midnight**, so a user in
 * a negative-offset timezone (e.g. `America/Sao_Paulo`, UTC-3) sees the date
 * shifted back one day. `formatDateOnly` parses date-only strings in the
 * *local* timezone so the displayed day always matches what was entered.
 *
 * Timestamp columns (`created_at`, `resolved_at`) are full ISO datetimes and
 * are safe to pass to `new Date`; `formatTimestamp` handles those.
 */

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR");

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
  return DATE_FORMAT.format(date);
}

/**
 * Formats a full ISO timestamp (e.g. a `created_at` column) as a localized
 * `pt-BR` date. Unlike {@link formatDateOnly} this trusts `new Date` because
 * a timestamp carries an explicit offset. Falls back to an empty string when
 * the input is missing or unparseable.
 */
export function formatTimestamp(input: string | null | undefined): string {
  if (typeof input !== "string" || input.length === 0) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return DATE_FORMAT.format(date);
}

/**
 * Formats a full ISO timestamp as a localized `pt-BR` date *and time*. Used by
 * the status-history timeline and the matter comment thread, where the time of
 * day matters (multiple transitions / comments can happen the same day).
 */
export function formatDateTime(input: string | null | undefined): string {
  if (typeof input !== "string" || input.length === 0) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
