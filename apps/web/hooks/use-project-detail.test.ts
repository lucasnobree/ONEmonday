import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeProjectProgress,
  isProjectOverdue,
  type ProjectCard,
} from "./use-project-detail";

function makeCard(
  id: string,
  completed_at: string | null,
  isDoneColumn = false
): ProjectCard {
  return {
    id,
    title: id,
    priority: "medium",
    due_date: null,
    completed_at,
    board_id: "b1",
    sector_id: "s1",
    column: { name: "Col", is_done_column: isDoneColumn },
  };
}

describe("computeProjectProgress", () => {
  it("returns zeroes for a project with no cards", () => {
    expect(computeProjectProgress([])).toEqual({
      total: 0,
      done: 0,
      percent: 0,
    });
  });

  it("counts a card as done when completed_at is set", () => {
    const cards = [
      makeCard("c1", "2026-05-10T00:00:00Z"),
      makeCard("c2", null),
    ];
    expect(computeProjectProgress(cards)).toEqual({
      total: 2,
      done: 1,
      percent: 50,
    });
  });

  it("counts a card as done when it sits in a done column", () => {
    const cards = [makeCard("c1", null, true), makeCard("c2", null, false)];
    expect(computeProjectProgress(cards).done).toBe(1);
  });

  it("rounds the percentage", () => {
    const cards = [
      makeCard("c1", "x"),
      makeCard("c2", null),
      makeCard("c3", null),
    ];
    expect(computeProjectProgress(cards).percent).toBe(33);
  });
});

describe("isProjectOverdue", () => {
  afterEach(() => vi.useRealTimers());

  it("is false for a non-active project even if the date passed", () => {
    expect(isProjectOverdue("completed", "2020-01-01")).toBe(false);
  });

  it("is false when there is no target date", () => {
    expect(isProjectOverdue("active", null)).toBe(false);
  });

  it("is true when an active project's target date is in the past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
    expect(isProjectOverdue("active", "2026-05-10")).toBe(true);
  });

  it("is false when the target date is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
    expect(isProjectOverdue("active", "2026-06-01")).toBe(false);
  });
});
