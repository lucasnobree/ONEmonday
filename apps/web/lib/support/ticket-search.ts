// Pure free-text search predicate for the Support Desk ticket queue.
// Kept free of React/Supabase so the matcher is unit testable.

/** Minimal shape the matcher needs from a ticket row. */
export interface SearchableTicket {
  id: string;
  requester_email: string | null;
  card: { title: string | null } | null;
}

/**
 * Whether a ticket matches a free-text query. Matching is case-insensitive
 * and accent-insensitive, and spans the ticket title, the requester email
 * and the ticket id (so a copied id finds its ticket). An empty query
 * matches everything.
 */
export function matchesTicketSearch(
  ticket: SearchableTicket,
  query: string
): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = [
    ticket.card?.title ?? "",
    ticket.requester_email ?? "",
    ticket.id,
  ]
    .map(normalize)
    .join(" ");
  return haystack.includes(q);
}

/** Lowercase and strip diacritics for accent-insensitive matching. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Filter a list of tickets by a free-text query. */
export function filterTicketsBySearch<T extends SearchableTicket>(
  tickets: T[],
  query: string
): T[] {
  if (!query.trim()) return tickets;
  return tickets.filter((t) => matchesTicketSearch(t, query));
}
