/**
 * Pure array-reorder helpers for the sequence steps editor.
 * Kept side-effect free so they are trivially unit-testable and reusable.
 */

/**
 * Returns a new array with the item at `index` moved one slot towards the
 * start. Out-of-range indices and the first item are no-ops (the same array
 * reference is returned).
 */
export function moveItemUp<T>(items: readonly T[], index: number): T[] {
  if (index <= 0 || index >= items.length) return items.slice();
  const next = items.slice();
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

/**
 * Returns a new array with the item at `index` moved one slot towards the
 * end. Out-of-range indices and the last item are no-ops.
 */
export function moveItemDown<T>(items: readonly T[], index: number): T[] {
  if (index < 0 || index >= items.length - 1) return items.slice();
  const next = items.slice();
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}
