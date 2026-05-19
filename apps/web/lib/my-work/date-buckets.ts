/**
 * Date bucketing for the "Meu Trabalho" (My Work) cross-board task view.
 *
 * Every task assigned to the current user is grouped by its due date into
 * five buckets, mirroring Monday.com's "My Work" layout:
 *
 *  - `overdue`   — due strictly before today and not done
 *  - `today`     — due today
 *  - `thisWeek`  — due after today, up to and including the end of the
 *                  current week (week ends Sunday, matching the dashboard's
 *                  `getDay()`-based week handling)
 *  - `later`     — due after this week
 *  - `noDate`    — no due date at all
 *
 * "Done" tasks never land in `overdue`: a completed task is not late even if
 * its due date has passed. They still bucket by date otherwise so the
 * "Concluídas" toggle can reveal them in place.
 *
 * All logic here is pure and date-only (the time component is ignored) so it
 * is fully unit-testable without a clock.
 */

export type WorkBucket =
  | "overdue"
  | "today"
  | "thisWeek"
  | "later"
  | "noDate";

/** Ordered bucket keys — drives section rendering order in the UI. */
export const WORK_BUCKET_ORDER: readonly WorkBucket[] = [
  "overdue",
  "today",
  "thisWeek",
  "later",
  "noDate",
] as const;

/** Human (pt-BR) labels for each bucket. */
export const WORK_BUCKET_LABELS: Record<WorkBucket, string> = {
  overdue: "Atrasado",
  today: "Hoje",
  thisWeek: "Esta semana",
  later: "Depois",
  noDate: "Sem data",
};

/**
 * Normalises a `Date` to local midnight, discarding the time component so
 * date comparisons are not skewed by hours/minutes/timezone offsets.
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parses a `YYYY-MM-DD` date string (the Postgres `date` wire format) into a
 * local-midnight `Date`. Using the explicit Y/M/D constructor avoids the UTC
 * interpretation `new Date("2026-05-19")` would apply.
 *
 * Returns `null` for empty/invalid input.
 */
export function parseDueDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Last day (Sunday) of the week containing `reference`, at local midnight.
 * Matches `useDashboardStats`, where the week starts on Sunday (`getDay()`
 * returns 0 for Sunday).
 */
export function endOfWeek(reference: Date): Date {
  const start = startOfDay(reference);
  const end = new Date(start);
  // getDay(): 0=Sun..6=Sat. Days remaining until Sunday = (7 - day) % 7.
  end.setDate(start.getDate() + ((7 - start.getDay()) % 7));
  return end;
}

/**
 * Resolves the bucket a task falls into.
 *
 * @param dueDate  the task's due date (`YYYY-MM-DD` string), or null
 * @param isDone   whether the task sits in a done column
 * @param now      the reference "today" (defaults to the current date)
 */
export function bucketForDueDate(
  dueDate: string | null | undefined,
  isDone: boolean,
  now: Date = new Date()
): WorkBucket {
  const due = parseDueDate(dueDate);
  if (!due) return "noDate";

  const today = startOfDay(now);
  const dueDay = startOfDay(due);

  if (dueDay.getTime() === today.getTime()) return "today";

  if (dueDay.getTime() < today.getTime()) {
    // A past due date on a finished task is not "overdue" — bucket it by the
    // week it belonged to so it can still surface under "Concluídas".
    return isDone ? "later" : "overdue";
  }

  const weekEnd = endOfWeek(today);
  if (dueDay.getTime() <= weekEnd.getTime()) return "thisWeek";

  return "later";
}

/** A minimal task shape the bucketer needs — see {@link MyWorkItem}. */
export interface BucketableTask {
  dueDate: string | null;
  isDone: boolean;
}

/**
 * Groups tasks into the five buckets, preserving each bucket's input order.
 * Buckets with no tasks are still present (as empty arrays) so the caller can
 * decide whether to render or skip them.
 */
export function groupTasksByBucket<T extends BucketableTask>(
  tasks: readonly T[],
  now: Date = new Date()
): Record<WorkBucket, T[]> {
  const groups: Record<WorkBucket, T[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    noDate: [],
  };
  for (const task of tasks) {
    groups[bucketForDueDate(task.dueDate, task.isDone, now)].push(task);
  }
  return groups;
}
