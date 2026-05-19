import { describe, it, expect } from "vitest";
import {
  parseDueDate,
  startOfDay,
  endOfWeek,
  bucketForDueDate,
  groupTasksByBucket,
  WORK_BUCKET_ORDER,
  WORK_BUCKET_LABELS,
  type BucketableTask,
} from "./date-buckets";

// Reference "now": Tuesday 2026-05-19, 14:30 local time.
const NOW = new Date(2026, 4, 19, 14, 30, 0);

describe("parseDueDate", () => {
  it("parses a YYYY-MM-DD string to local midnight", () => {
    const d = parseDueDate("2026-05-19");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(19);
    expect(d!.getHours()).toBe(0);
  });

  it("parses a full timestamp by ignoring the time part", () => {
    const d = parseDueDate("2026-05-19T23:00:00+00:00");
    expect(d!.getDate()).toBe(19);
  });

  it("returns null for empty, null or malformed input", () => {
    expect(parseDueDate(null)).toBeNull();
    expect(parseDueDate(undefined)).toBeNull();
    expect(parseDueDate("")).toBeNull();
    expect(parseDueDate("not-a-date")).toBeNull();
  });
});

describe("startOfDay", () => {
  it("strips the time component", () => {
    const d = startOfDay(new Date(2026, 4, 19, 18, 45, 12));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(19);
  });
});

describe("endOfWeek", () => {
  it("returns the upcoming Sunday for a mid-week date", () => {
    // 2026-05-19 is a Tuesday; week ends Sunday 2026-05-24.
    const end = endOfWeek(NOW);
    expect(end.getDate()).toBe(24);
    expect(end.getDay()).toBe(0);
  });

  it("returns the same day when the reference is already Sunday", () => {
    const sunday = new Date(2026, 4, 24, 9, 0, 0);
    const end = endOfWeek(sunday);
    expect(end.getDate()).toBe(24);
  });
});

describe("bucketForDueDate", () => {
  it("buckets a missing due date as noDate", () => {
    expect(bucketForDueDate(null, false, NOW)).toBe("noDate");
  });

  it("buckets today's due date as today", () => {
    expect(bucketForDueDate("2026-05-19", false, NOW)).toBe("today");
  });

  it("buckets a past due date on an unfinished task as overdue", () => {
    expect(bucketForDueDate("2026-05-10", false, NOW)).toBe("overdue");
  });

  it("never marks a done task overdue even if its due date passed", () => {
    expect(bucketForDueDate("2026-05-10", true, NOW)).toBe("later");
  });

  it("buckets a due date later this week as thisWeek", () => {
    // Sunday 2026-05-24 is the last day of the current week.
    expect(bucketForDueDate("2026-05-24", false, NOW)).toBe("thisWeek");
    expect(bucketForDueDate("2026-05-21", false, NOW)).toBe("thisWeek");
  });

  it("buckets a due date after this week as later", () => {
    // Monday 2026-05-25 is the first day of next week.
    expect(bucketForDueDate("2026-05-25", false, NOW)).toBe("later");
    expect(bucketForDueDate("2026-08-01", false, NOW)).toBe("later");
  });

  it("treats today as today regardless of the done flag", () => {
    expect(bucketForDueDate("2026-05-19", true, NOW)).toBe("today");
  });
});

describe("groupTasksByBucket", () => {
  const tasks: (BucketableTask & { id: string })[] = [
    { id: "a", dueDate: "2026-05-10", isDone: false }, // overdue
    { id: "b", dueDate: "2026-05-19", isDone: false }, // today
    { id: "c", dueDate: "2026-05-22", isDone: false }, // thisWeek
    { id: "d", dueDate: "2026-06-30", isDone: false }, // later
    { id: "e", dueDate: null, isDone: false }, // noDate
    { id: "f", dueDate: "2026-05-08", isDone: true }, // done -> later
  ];

  it("places each task in the correct bucket", () => {
    const groups = groupTasksByBucket(tasks, NOW);
    expect(groups.overdue.map((t) => t.id)).toEqual(["a"]);
    expect(groups.today.map((t) => t.id)).toEqual(["b"]);
    expect(groups.thisWeek.map((t) => t.id)).toEqual(["c"]);
    expect(groups.later.map((t) => t.id)).toEqual(["d", "f"]);
    expect(groups.noDate.map((t) => t.id)).toEqual(["e"]);
  });

  it("returns all five buckets even when some are empty", () => {
    const groups = groupTasksByBucket([], NOW);
    expect(Object.keys(groups).sort()).toEqual(
      [...WORK_BUCKET_ORDER].sort()
    );
    for (const key of WORK_BUCKET_ORDER) {
      expect(groups[key]).toEqual([]);
    }
  });

  it("preserves input order within a bucket", () => {
    const sameBucket: (BucketableTask & { id: string })[] = [
      { id: "x", dueDate: "2026-05-10", isDone: false },
      { id: "y", dueDate: "2026-05-12", isDone: false },
      { id: "z", dueDate: "2026-05-05", isDone: false },
    ];
    const groups = groupTasksByBucket(sameBucket, NOW);
    expect(groups.overdue.map((t) => t.id)).toEqual(["x", "y", "z"]);
  });
});

describe("WORK_BUCKET metadata", () => {
  it("has a label for every bucket in the render order", () => {
    for (const key of WORK_BUCKET_ORDER) {
      expect(WORK_BUCKET_LABELS[key]).toBeTruthy();
    }
  });
});
