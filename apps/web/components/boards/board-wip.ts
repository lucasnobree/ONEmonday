/**
 * WIP-limit helpers for the Kanban board.
 *
 * A column may carry an optional `wip_limit`. These pure functions decide
 * whether adding one more card would breach that limit, so both the
 * card-create and the cross-column drag paths can enforce it consistently.
 */

/** A column shape with just the fields the WIP check needs. */
export interface WipColumnLike {
  wip_limit: number | null;
  cardCount: number;
}

/**
 * Whether a column is at or above its WIP limit (i.e. already full).
 * Columns without a limit are never considered full.
 */
export function isWipLimitReached(column: WipColumnLike): boolean {
  return column.wip_limit != null && column.cardCount >= column.wip_limit;
}

/**
 * Whether adding one more card to a column would exceed its WIP limit.
 * Equivalent to {@link isWipLimitReached} for the next-card decision, but
 * named for the create/move call sites that ask "can I add a card here?".
 */
export function wouldExceedWipLimit(column: WipColumnLike): boolean {
  return isWipLimitReached(column);
}

/** User-facing toast message for a blocked WIP breach. */
export function wipLimitMessage(limit: number): string {
  return `Coluna no limite de ${limit} card${limit === 1 ? "" : "s"}.`;
}
