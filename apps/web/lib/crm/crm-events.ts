/**
 * CRM outbound events — the seam between the CRM module and the Phase-1
 * integration layer (docs/research/migration-architecture.md §1.2e / §2.1).
 *
 * Key CRM moments (a deal won/lost, a deal changing stage, an activity coming
 * due) are turned into channel-agnostic event payloads here, then enqueued onto
 * the Phase-1 `notification_outbox` by `enqueueCrmEvent` in
 * lib/actions/crm/crm-dispatch.ts. A worker drains the outbox and delivers them
 * to Teams / WhatsApp.
 *
 * This module is pure (no DB, no I/O) so it is fully unit-testable. The
 * `eventType` strings are the keys an admin maps to channels in
 * `notification_channel_routes`.
 */

/** The CRM events that fan out to the notification outbox. */
export type CrmEventType =
  | "crm_deal_won"
  | "crm_deal_lost"
  | "crm_deal_stage_changed"
  | "crm_activity_due";

/** A built event, ready to hand to `enqueueEventDispatch`. */
export interface CrmEventPayload {
  eventType: CrmEventType;
  title: string;
  body: string;
}

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formats a deal value in BRL, tolerating null/undefined. */
function formatValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "valor nao informado";
  return currencyFmt.format(value);
}

/** Input shared by the deal-level events. */
export interface DealEventInput {
  dealTitle: string;
  value?: number | null;
  companyName?: string | null;
  ownerName?: string | null;
}

/** Built when a deal is closed as won. */
export function buildDealWonEvent(input: DealEventInput): CrmEventPayload {
  const company = input.companyName ? ` (${input.companyName})` : "";
  const owner = input.ownerName ? ` Responsavel: ${input.ownerName}.` : "";
  return {
    eventType: "crm_deal_won",
    title: "Deal ganho",
    body: `O deal "${input.dealTitle}"${company} foi ganho por ${formatValue(
      input.value
    )}.${owner}`,
  };
}

/** Built when a deal is closed as lost. */
export function buildDealLostEvent(
  input: DealEventInput & { lostReason?: string | null }
): CrmEventPayload {
  const company = input.companyName ? ` (${input.companyName})` : "";
  const reason = input.lostReason ? ` Motivo: ${input.lostReason}.` : "";
  return {
    eventType: "crm_deal_lost",
    title: "Deal perdido",
    body: `O deal "${input.dealTitle}"${company} foi marcado como perdido.${reason}`,
  };
}

/** Built when a deal moves between pipeline stages. */
export function buildDealStageChangedEvent(input: {
  dealTitle: string;
  fromStage: string | null;
  toStage: string;
  ownerName?: string | null;
}): CrmEventPayload {
  const from = input.fromStage ? `de "${input.fromStage}" ` : "";
  const owner = input.ownerName ? ` Responsavel: ${input.ownerName}.` : "";
  return {
    eventType: "crm_deal_stage_changed",
    title: "Mudanca de estagio",
    body: `O deal "${input.dealTitle}" avancou ${from}para "${input.toStage}".${owner}`,
  };
}

/** Built when a scheduled activity/task becomes due. */
export function buildActivityDueEvent(input: {
  subject: string;
  type: string;
  dueAt: string;
  assigneeName?: string | null;
}): CrmEventPayload {
  const due = new Date(input.dueAt);
  const when = Number.isNaN(due.getTime())
    ? input.dueAt
    : due.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  const who = input.assigneeName ? ` para ${input.assigneeName}` : "";
  return {
    eventType: "crm_activity_due",
    title: "Atividade pendente",
    body: `A atividade "${input.subject}"${who} esta agendada para ${when}.`,
  };
}
