/**
 * Pure helpers for building contract-renewal notification content.
 *
 * Framework- and DB-free so the message wording is unit-testable in isolation
 * and shared by the in-app notification path and the outbound-dispatch path.
 */

/** Event type used in `notifications.type` / `notification_channel_routes`. */
export const RENEWAL_EVENT_TYPE = "contract_renewal";

/** A contract row, as returned by `get_contracts_needing_renewal_notice`. */
export interface RenewalCandidate {
  contract_id: string;
  sector_id: string;
  title: string;
  counterparty: string;
  owner_id: string | null;
  created_by: string;
  expiry_date: string;
  notice_period_days: number;
  days_until_expiry: number;
}

/** A channel-agnostic notification message for a renewal alert. */
export interface RenewalMessage {
  title: string;
  body: string;
  /** Deep link to the contract list. */
  url: string;
}

/**
 * Builds the human-readable renewal alert for a contract. Distinguishes a
 * contract already past its expiry date from one inside the notice window.
 */
export function buildRenewalMessage(
  candidate: Pick<
    RenewalCandidate,
    "title" | "counterparty" | "days_until_expiry"
  >
): RenewalMessage {
  const days = candidate.days_until_expiry;
  const expired = days < 0;

  const title = expired
    ? "Contrato vencido"
    : "Contrato em janela de renovação";

  const body = expired
    ? `O contrato "${candidate.title}" com ${candidate.counterparty} ` +
      `venceu há ${Math.abs(days)} dia(s). Avalie a renovação ou o ` +
      `encerramento.`
    : `O contrato "${candidate.title}" com ${candidate.counterparty} ` +
      `vence em ${days} dia(s) e entrou no período de aviso prévio. ` +
      `Decida sobre a renovação.`;

  return { title, body, url: "/legal/contracts" };
}
