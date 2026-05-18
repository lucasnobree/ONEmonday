import type { BoardSummary } from "@/hooks/use-boards";

/** Sort modes offered by the Boards index. */
export type BoardSortKey = "recent" | "name" | "created";

/** Epoch ms of a board's last update, falling back to creation time. */
function updatedAt(b: BoardSummary): number {
  return new Date(b.updated_at ?? b.created_at).getTime();
}

/**
 * Returns a new array of boards sorted by the given key. Pure and
 * non-mutating so it is safe inside `useMemo` and easy to test.
 *  - `recent`  — most recently updated first
 *  - `name`    — case-insensitive A-Z
 *  - `created` — newest created first
 */
export function sortBoards(
  boards: BoardSummary[],
  key: BoardSortKey
): BoardSummary[] {
  const copy = [...boards];
  switch (key) {
    case "name":
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      );
    case "created":
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case "recent":
    default:
      return copy.sort((a, b) => updatedAt(b) - updatedAt(a));
  }
}

/** Case-insensitive name filter; an empty query returns every board. */
export function filterBoards(
  boards: BoardSummary[],
  query: string
): BoardSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return boards;
  return boards.filter((b) => b.name.toLowerCase().includes(q));
}
