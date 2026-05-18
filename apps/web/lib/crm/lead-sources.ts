/**
 * The shared lead-source vocabulary.
 *
 * A lead's `source` was previously a free-text field, so every typo
 * ("Site", "site", "website") became a distinct bucket and polluted the Leads
 * inbox source filter. Both the manual lead-create dialog and the capture-form
 * builder now pick from this fixed list, keeping the inbox filter clean.
 *
 * Values are kept lowercase and stable (they are persisted onto
 * `crm_leads.source`); labels are pt-BR for display.
 */

/** The canonical lead-source values. */
export const LEAD_SOURCES = [
  "manual",
  "form",
  "indicacao",
  "evento",
  "outro",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

/** pt-BR labels for each canonical source. */
const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  manual: "Manual",
  form: "Formulário",
  indicacao: "Indicação",
  evento: "Evento",
  outro: "Outro",
};

/**
 * pt-BR label for a lead source. Falls back to the raw value for legacy or
 * externally-captured sources that are not in the canonical list.
 */
export function leadSourceLabel(source: string): string {
  return LEAD_SOURCE_LABELS[source as LeadSource] ?? source;
}

/** True when `source` is one of the canonical values. */
export function isKnownLeadSource(source: string): source is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(source);
}
