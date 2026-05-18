// Pure sorting helpers for the Support Desk ticket queue.
// Kept free of React/Supabase so the comparator is unit testable.

export type TicketSortKey = "priority" | "created" | "title" | "status";
export type SortDirection = "asc" | "desc";

// Lower number = more urgent. Used so "priority desc" puts critical first.
const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Workflow order for status sorting.
const STATUS_RANK: Record<string, number> = {
  new: 0,
  open: 1,
  pending: 2,
  on_hold: 3,
  resolved: 4,
};

/** Minimal shape the comparator needs from a ticket row. */
export interface SortableTicket {
  created_at: string;
  status: string;
  card: { title: string | null; priority: string | null } | null;
}

/**
 * Compare two tickets by the given key. Returns a number suitable for
 * Array.prototype.sort; `direction` flips the result.
 */
export function compareTickets(
  a: SortableTicket,
  b: SortableTicket,
  key: TicketSortKey,
  direction: SortDirection
): number {
  let result = 0;

  switch (key) {
    case "priority": {
      const ra = PRIORITY_RANK[a.card?.priority ?? ""] ?? 99;
      const rb = PRIORITY_RANK[b.card?.priority ?? ""] ?? 99;
      result = ra - rb;
      break;
    }
    case "status": {
      const ra = STATUS_RANK[a.status] ?? 99;
      const rb = STATUS_RANK[b.status] ?? 99;
      result = ra - rb;
      break;
    }
    case "title": {
      result = (a.card?.title ?? "").localeCompare(b.card?.title ?? "", "pt-BR");
      break;
    }
    case "created":
    default: {
      result =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      break;
    }
  }

  return direction === "asc" ? result : -result;
}

/** Return a new array of tickets sorted by the given key/direction. */
export function sortTickets<T extends SortableTicket>(
  tickets: T[],
  key: TicketSortKey,
  direction: SortDirection
): T[] {
  return [...tickets].sort((a, b) => compareTickets(a, b, key, direction));
}
