/**
 * Pure helpers for the editorial content calendar month grid.
 * All dates are handled as `YYYY-MM-DD` strings (no timezone drift).
 */

/** A single day cell in the month grid. */
export interface CalendarCell {
  /** `YYYY-MM-DD` for this cell. */
  date: string;
  /** Day-of-month number (1–31). */
  day: number;
  /** True when the cell belongs to the displayed month (not padding). */
  inMonth: boolean;
}

/** Zero-pads a number to two digits. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Builds a `YYYY-MM-DD` string from a Date's local Y/M/D. */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Builds the calendar grid for the month containing `anchor` (a `YYYY-MM`
 * string or `YYYY-MM-DD`). The grid always starts on a Sunday and contains
 * whole weeks, so its length is a multiple of 7. Padding days from the
 * adjacent months are marked `inMonth: false`.
 */
export function buildMonthGrid(anchor: string): CalendarCell[] {
  const [yearStr, monthStr] = anchor.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1; // 0-indexed

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Walk back to the Sunday on or before the 1st.
  const start = new Date(firstOfMonth);
  start.setDate(1 - firstOfMonth.getDay());

  // Total cells: enough whole weeks to cover the last day of the month.
  const leading = firstOfMonth.getDay();
  const weeks = Math.ceil((leading + daysInMonth) / 7);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: toISODate(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

/** `YYYY-MM` for the month before `anchor` (`YYYY-MM`). */
export function previousMonth(anchor: string): string {
  const [y, m] = anchor.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** `YYYY-MM` for the month after `anchor` (`YYYY-MM`). */
export function nextMonth(anchor: string): string {
  const [y, m] = anchor.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** `YYYY-MM` for the current local month. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Human label for a `YYYY-MM` anchor, e.g. "Maio 2026". */
export function monthLabel(anchor: string): string {
  const [y, m] = anchor.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Groups items by their `scheduled_date` (`YYYY-MM-DD`) into a lookup map,
 * so a calendar cell can render its items with a single `Map.get`.
 */
export function groupByDate<T extends { scheduled_date: string }>(
  items: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.scheduled_date);
    if (list) {
      list.push(item);
    } else {
      map.set(item.scheduled_date, [item]);
    }
  }
  return map;
}
