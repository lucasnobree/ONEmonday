import { describe, it, expect } from "vitest";
import { sortProjects } from "./project-sort";
import type { ProjectListItem } from "@/hooks/use-projects";

function makeProject(
  id: string,
  name: string,
  created_at: string,
  cardCount: number,
  doneCount: number
): ProjectListItem {
  return {
    id,
    name,
    description: null,
    status: "active",
    start_date: null,
    target_date: null,
    created_by: "u1",
    is_active: true,
    created_at,
    updated_at: null,
    cardCount,
    doneCount,
  };
}

const projects: ProjectListItem[] = [
  makeProject("a", "Zeta", "2026-01-01", 4, 1),
  makeProject("b", "alfa", "2026-03-01", 0, 0),
  makeProject("c", "Meta", "2026-02-01", 2, 2),
];

describe("sortProjects", () => {
  it("sorts by name case-insensitively", () => {
    expect(sortProjects(projects, "name").map((p) => p.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("sorts by recency, newest created first", () => {
    expect(sortProjects(projects, "recent").map((p) => p.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("sorts by completion ratio, highest first", () => {
    // c = 100%, a = 25%, b = 0% (no cards)
    expect(sortProjects(projects, "progress").map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [...projects];
    sortProjects(input, "name");
    expect(input.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});
