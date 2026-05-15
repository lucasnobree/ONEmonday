/**
 * Structured closed-lost reason taxonomy for the CRM.
 *
 * A finite, enforced set of categories — best practice per win/loss research:
 * generic free text ("bad fit") yields no insight, and an unbounded list
 * produces analytic noise. The free-text `lost_reason` note still captures
 * deal-specific context alongside the category.
 */

export const LOST_REASON_CATEGORIES = [
  "price",
  "competitor",
  "timing",
  "no_budget",
  "no_decision",
  "product_fit",
  "no_response",
  "other",
] as const;

export type LostReasonCategory = (typeof LOST_REASON_CATEGORIES)[number];

/** pt-BR labels for each closed-lost category. */
export const LOST_REASON_LABELS: Record<LostReasonCategory, string> = {
  price: "Preco / Orcamento",
  competitor: "Perdido para concorrente",
  timing: "Momento inadequado",
  no_budget: "Sem verba",
  no_decision: "Sem decisao",
  product_fit: "Produto nao atende",
  no_response: "Cliente parou de responder",
  other: "Outro",
};

/** Type guard for an unknown value being a valid lost-reason category. */
export function isLostReasonCategory(
  value: unknown
): value is LostReasonCategory {
  return (
    typeof value === "string" &&
    (LOST_REASON_CATEGORIES as readonly string[]).includes(value)
  );
}

/** Safe label lookup that tolerates legacy/unknown values. */
export function lostReasonLabel(value: string | null | undefined): string {
  if (isLostReasonCategory(value)) return LOST_REASON_LABELS[value];
  return value ?? "—";
}
