/**
 * Pure helpers for board column ordering.
 *
 * Column reorder uses discrete "move left / move right" steps. `moveColumn`
 * produces the new full id ordering a step would yield, which the
 * `reorder_board_columns` RPC consumes. Kept pure so it is unit-testable
 * independent of the Kanban UI.
 */

/**
 * Returns the column-id list after moving `columnId` by `direction`
 * (-1 = left/earlier, +1 = right/later). Returns `null` when the move is a
 * no-op: the column is missing, or it is already at the relevant edge.
 */
export function moveColumn(
  orderedIds: string[],
  columnId: string,
  direction: -1 | 1
): string[] | null {
  const from = orderedIds.indexOf(columnId);
  if (from === -1) return null;

  const to = from + direction;
  if (to < 0 || to >= orderedIds.length) return null;

  const next = [...orderedIds];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
