import { describe, it, expect } from "vitest";
import {
  bucketActivity,
  isOpenTask,
  isOverdue,
  countOpenTasks,
} from "./activity-tasks";

// A fixed reference "now": 2026-05-18 12:00 local time.
const NOW = new Date("2026-05-18T12:00:00");

function at(iso: string) {
  return { scheduled_at: iso, completed_at: null };
}

describe("bucketActivity", () => {
  it("classes an activity with no schedule as history", () => {
    expect(
      bucketActivity({ scheduled_at: null, completed_at: null }, NOW)
    ).toBe("history");
  });

  it("classes a completed task as done regardless of its due date", () => {
    expect(
      bucketActivity(
        { scheduled_at: "2026-05-10T09:00:00", completed_at: "2026-05-11T09:00:00" },
        NOW
      )
    ).toBe("done");
  });

  it("classes a not-yet-due task as upcoming", () => {
    expect(bucketActivity(at("2026-05-20T09:00:00"), NOW)).toBe("upcoming");
  });

  it("classes a task due today as today (even earlier in the day)", () => {
    expect(bucketActivity(at("2026-05-18T08:00:00"), NOW)).toBe("today");
  });

  it("classes a past-day incomplete task as overdue", () => {
    expect(bucketActivity(at("2026-05-17T23:00:00"), NOW)).toBe("overdue");
  });

  it("treats an unparseable date as history", () => {
    expect(bucketActivity(at("not-a-date"), NOW)).toBe("history");
  });
});

describe("isOpenTask / isOverdue", () => {
  it("isOpenTask is true for overdue, today and upcoming", () => {
    expect(isOpenTask(at("2026-05-17T09:00:00"), NOW)).toBe(true);
    expect(isOpenTask(at("2026-05-18T09:00:00"), NOW)).toBe(true);
    expect(isOpenTask(at("2026-05-25T09:00:00"), NOW)).toBe(true);
  });

  it("isOpenTask is false for history and done", () => {
    expect(
      isOpenTask({ scheduled_at: null, completed_at: null }, NOW)
    ).toBe(false);
    expect(
      isOpenTask(
        { scheduled_at: "2026-05-17T09:00:00", completed_at: "2026-05-17T10:00:00" },
        NOW
      )
    ).toBe(false);
  });

  it("isOverdue is true only for a past, incomplete task", () => {
    expect(isOverdue(at("2026-05-17T09:00:00"), NOW)).toBe(true);
    expect(isOverdue(at("2026-05-18T09:00:00"), NOW)).toBe(false);
    expect(
      isOverdue(
        { scheduled_at: "2026-05-10T09:00:00", completed_at: "2026-05-11T09:00:00" },
        NOW
      )
    ).toBe(false);
  });
});

describe("countOpenTasks", () => {
  it("tallies the open buckets and ignores history/done", () => {
    const counts = countOpenTasks(
      [
        at("2026-05-15T09:00:00"), // overdue
        at("2026-05-16T09:00:00"), // overdue
        at("2026-05-18T15:00:00"), // today
        at("2026-05-22T09:00:00"), // upcoming
        { scheduled_at: null, completed_at: null }, // history
        { scheduled_at: "2026-05-10T09:00:00", completed_at: "2026-05-10T10:00:00" }, // done
      ],
      NOW
    );
    expect(counts.overdue).toBe(2);
    expect(counts.today).toBe(1);
    expect(counts.upcoming).toBe(1);
    expect(counts.openTotal).toBe(4);
  });

  it("returns all-zero counts for an empty list", () => {
    expect(countOpenTasks([], NOW)).toEqual({
      overdue: 0,
      today: 0,
      upcoming: 0,
      openTotal: 0,
    });
  });
});
