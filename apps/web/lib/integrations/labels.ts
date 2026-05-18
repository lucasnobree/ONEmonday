/**
 * pt-BR display labels for Integrations module enum values.
 * Centralised so the Settings tabs render human-readable text instead of raw
 * enum slugs (`card_assigned`, `teams`). The notification event labels mirror
 * the matrix on the Settings → Geral tab so the two screens stay consistent.
 */

/** Notification event types that can route to an outbound channel. */
export const ROUTABLE_EVENT_TYPES = [
  "card_assigned",
  "card_comment",
  "card_escalated",
  "card_due_soon",
  "card_overdue",
] as const;

export type RoutableEventType = (typeof ROUTABLE_EVENT_TYPES)[number];

/** Outbound channels a notification event can be routed to. */
export const ROUTABLE_CHANNELS = ["teams", "whatsapp"] as const;

export type RoutableChannel = (typeof ROUTABLE_CHANNELS)[number];

/** pt-BR labels for routable notification events. */
export const EVENT_LABELS: Record<RoutableEventType, string> = {
  card_assigned: "Card atribuído",
  card_comment: "Comentário em card",
  card_escalated: "Card escalado",
  card_due_soon: "Card vencendo",
  card_overdue: "Card atrasado",
};

/** pt-BR labels for outbound channels. */
export const CHANNEL_LABELS: Record<RoutableChannel, string> = {
  teams: "Microsoft Teams",
  whatsapp: "WhatsApp",
};

/** Resolves an event slug to its label, falling back to the raw slug. */
export function eventLabel(slug: string): string {
  return EVENT_LABELS[slug as RoutableEventType] ?? slug;
}

/** Resolves a channel slug to its label, falling back to the raw slug. */
export function channelLabel(slug: string): string {
  return CHANNEL_LABELS[slug as RoutableChannel] ?? slug;
}
