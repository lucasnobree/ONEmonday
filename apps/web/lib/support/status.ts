// Shared presentation metadata for the multi-state ticket status.
// Pure module (no React/Supabase) so it can be reused and unit tested.

import type { TicketStatus } from "@/lib/support/sla";
import { TICKET_STATUSES } from "@/lib/support/sla";

export interface TicketStatusMeta {
  value: TicketStatus;
  /** pt-BR label shown in badges, selects and filters. */
  label: string;
  /** Tailwind classes for the status badge (light + dark). */
  badgeClass: string;
}

export const TICKET_STATUS_META: Record<TicketStatus, TicketStatusMeta> = {
  new: {
    value: "new",
    label: "Novo",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  open: {
    value: "open",
    label: "Aberto",
    badgeClass: "",
  },
  pending: {
    value: "pending",
    label: "Pendente",
    badgeClass:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  on_hold: {
    value: "on_hold",
    label: "Em espera",
    badgeClass:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  resolved: {
    value: "resolved",
    label: "Resolvido",
    badgeClass:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

/** Ordered list for selects/filters. */
export const TICKET_STATUS_OPTIONS: TicketStatusMeta[] = TICKET_STATUSES.map(
  (s) => TICKET_STATUS_META[s]
);

/** Narrow an arbitrary string to a known TicketStatus, defaulting to "new". */
export function normalizeTicketStatus(value: string | null | undefined): TicketStatus {
  if (value && (TICKET_STATUSES as readonly string[]).includes(value)) {
    return value as TicketStatus;
  }
  return "new";
}
