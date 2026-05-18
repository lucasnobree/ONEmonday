/**
 * CRM activity / task categorisation — pure logic (no DB, no I/O), unit-tested.
 *
 * `crm_activities` mixes two things: an immutable history of things that
 * happened (a logged call, a note) and forward-looking *tasks* with a
 * `scheduled_at` due date and an optional `completed_at`. Pipedrive's model —
 * "today's tasks", "overdue", "upcoming" — is core CRM usability. This module
 * derives that split so the UI does not re-implement the date math everywhere.
 */

/** The minimal activity shape this module reasons about. */
export interface TaskLike {
  scheduled_at: string | null;
  completed_at: string | null;
}

/** Where an activity belongs in the task/history split. */
export type TaskBucket =
  | "overdue" // scheduled, not done, due before today
  | "today" // scheduled, not done, due today
  | "upcoming" // scheduled, not done, due after today
  | "done" // a completed task
  | "history"; // never had a schedule — a logged historical activity

/** Start-of-day for a date, in local time. */
function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/**
 * Classifies one activity. `now` is injectable so tests are deterministic and
 * the caller can pass a stable "now" for a whole render pass.
 */
export function bucketActivity(
  activity: TaskLike,
  now: Date = new Date()
): TaskBucket {
  if (!activity.scheduled_at) return "history";
  if (activity.completed_at) return "done";

  const due = new Date(activity.scheduled_at);
  if (Number.isNaN(due.getTime())) return "history";

  const today = startOfDay(now);
  const dueDay = startOfDay(due);

  if (dueDay.getTime() < today.getTime()) return "overdue";
  if (dueDay.getTime() === today.getTime()) return "today";
  return "upcoming";
}

/** True when an activity is an open (incomplete, scheduled) task. */
export function isOpenTask(activity: TaskLike, now: Date = new Date()): boolean {
  const bucket = bucketActivity(activity, now);
  return bucket === "overdue" || bucket === "today" || bucket === "upcoming";
}

/** True when an activity is overdue (open and past its due day). */
export function isOverdue(activity: TaskLike, now: Date = new Date()): boolean {
  return bucketActivity(activity, now) === "overdue";
}

/** Summary counts for the open-task widgets (dashboard / activities header). */
export interface TaskCounts {
  overdue: number;
  today: number;
  upcoming: number;
  openTotal: number;
}

/** Tallies a list of activities into the open-task buckets. */
export function countOpenTasks(
  activities: TaskLike[],
  now: Date = new Date()
): TaskCounts {
  const counts: TaskCounts = {
    overdue: 0,
    today: 0,
    upcoming: 0,
    openTotal: 0,
  };
  for (const a of activities) {
    const bucket = bucketActivity(a, now);
    if (bucket === "overdue") counts.overdue += 1;
    else if (bucket === "today") counts.today += 1;
    else if (bucket === "upcoming") counts.upcoming += 1;
  }
  counts.openTotal = counts.overdue + counts.today + counts.upcoming;
  return counts;
}
