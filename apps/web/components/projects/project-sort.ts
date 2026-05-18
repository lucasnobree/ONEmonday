import type { ProjectListItem } from "@/hooks/use-projects";

/** Sort modes offered by the Projects index. */
export type ProjectSortKey = "recent" | "name" | "progress";

/** Completion ratio 0-1 of a project; 0 when it has no linked cards. */
function progressRatio(p: ProjectListItem): number {
  return p.cardCount === 0 ? 0 : p.doneCount / p.cardCount;
}

/**
 * Returns a new array of projects sorted by the given key. Pure and
 * non-mutating so it is safe inside a `useMemo` and trivial to test.
 *  - `recent`   — newest `created_at` first
 *  - `name`     — case-insensitive A-Z
 *  - `progress` — highest completion ratio first
 */
export function sortProjects(
  projects: ProjectListItem[],
  key: ProjectSortKey
): ProjectListItem[] {
  const copy = [...projects];
  switch (key) {
    case "name":
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      );
    case "progress":
      return copy.sort((a, b) => progressRatio(b) - progressRatio(a));
    case "recent":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }
}
