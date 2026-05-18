/**
 * Generic, type-safe list sorting for the CRM list views — pure logic,
 * unit-tested. Companies / Contacts / Deals lists all need the same
 * "click a header to sort" behaviour; this avoids re-implementing the
 * comparator (and the null-handling) in every page.
 */

/** Sort direction. */
export type SortDirection = "asc" | "desc";

/** A sort selection: which key, which direction. */
export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Toggles the sort state for a clicked column. Clicking the active column
 * flips direction; clicking a new column selects it ascending.
 */
export function nextSortState<K extends string>(
  current: SortState<K>,
  clickedKey: K
): SortState<K> {
  if (current.key === clickedKey) {
    return {
      key: clickedKey,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { key: clickedKey, direction: "asc" };
}

/** Compares two values of unknown type with stable null/locale handling. */
function compareValues(a: unknown, b: unknown): number {
  // Nulls / undefined sort last regardless of direction.
  const aNil = a == null || a === "";
  const bNil = b == null || b === "";
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? -1 : 1;
  }
  return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
}

/**
 * Returns a new array sorted by `sort.key`. `accessor` extracts the comparable
 * value for a row. Nulls always sink to the bottom; the direction only flips
 * the non-null ordering. Does not mutate the input.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  accessor: (row: T, key: K) => unknown
): T[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = accessor(a, sort.key);
    const bv = accessor(b, sort.key);
    const cmp = compareValues(av, bv);
    // Keep nulls at the bottom even when descending.
    const aNil = av == null || av === "";
    const bNil = bv == null || bv === "";
    if (aNil !== bNil) return cmp;
    return cmp * sign;
  });
}
