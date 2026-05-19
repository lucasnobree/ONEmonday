/**
 * Pure helpers for the sidebar tree's expand/collapse state.
 *
 * The set of expanded node ids is persisted to `localStorage` so the tree
 * keeps its shape across reloads. These functions are kept free of React so
 * they can be unit-tested directly; the {@link useTreeExpansion} hook wires
 * them to component state.
 */

export const EXPANSION_STORAGE_KEY = "onemonday-sidebar-expanded";

/**
 * Parses the persisted expanded-id list from a raw localStorage string.
 * Tolerates absent or corrupt values by returning an empty set.
 */
export function parseExpandedState(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === "string"));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

/** Serialises an expanded-id set for persistence (sorted for stable output). */
export function serializeExpandedState(expanded: Set<string>): string {
  return JSON.stringify([...expanded].sort());
}

/** Returns a new set with `id` toggled in/out of `expanded`. */
export function toggleExpanded(
  expanded: Set<string>,
  id: string
): Set<string> {
  const next = new Set(expanded);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Returns a set guaranteeing every id in `ids` is expanded, without
 * collapsing anything already open. Returns the *same* reference when no
 * change is needed, so callers can skip redundant state updates.
 */
export function ensureExpanded(
  expanded: Set<string>,
  ids: (string | null | undefined)[]
): Set<string> {
  const toAdd = ids.filter(
    (id): id is string => typeof id === "string" && !expanded.has(id)
  );
  if (toAdd.length === 0) return expanded;
  const next = new Set(expanded);
  for (const id of toAdd) next.add(id);
  return next;
}
