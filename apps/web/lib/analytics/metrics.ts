/**
 * Governed metric catalog for the Analytics module.
 *
 * Mirrors Looker's "define a KPI once" principle: every KPI card and saved
 * report resolves its label, unit and source module from this single typed
 * registry, so a metric never drifts between two screens.
 *
 * The `key` values here MUST stay in sync with the `metric` strings the
 * `get_analytics_trend` SQL RPC understands and with the CHECK-constrained
 * `analytics_reports` columns in migration 00050.
 */

/** Logical metric identifiers. */
export const METRIC_KEYS = [
  "cards_completed",
  "deals_won_value_cents",
  "tickets_resolved",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

/** How a metric value should be rendered. */
export type MetricUnit = "count" | "currency_cents";

export interface MetricDefinition {
  key: MetricKey;
  /** Human-facing label (pt-BR, matches the rest of the app). */
  label: string;
  /** Short description of what the metric counts. */
  description: string;
  /** Source module the metric aggregates from. */
  module: "boards" | "crm" | "support";
  unit: MetricUnit;
  /** Whether a higher value is the desired direction (drives delta colour). */
  higherIsBetter: boolean;
}

/** The single source of truth for every analytics metric. */
export const METRIC_CATALOG: Record<MetricKey, MetricDefinition> = {
  cards_completed: {
    key: "cards_completed",
    label: "Cards Concluidos",
    description: "Cards marcados como concluidos no periodo.",
    module: "boards",
    unit: "count",
    higherIsBetter: true,
  },
  deals_won_value_cents: {
    key: "deals_won_value_cents",
    label: "Valor de Negocios Ganhos",
    description: "Soma do valor dos negocios fechados no periodo.",
    module: "crm",
    unit: "currency_cents",
    higherIsBetter: true,
  },
  tickets_resolved: {
    key: "tickets_resolved",
    label: "Tickets Resolvidos",
    description: "Tickets de suporte resolvidos no periodo.",
    module: "support",
    unit: "count",
    higherIsBetter: true,
  },
};

/** All metric definitions as an array, in catalog order. */
export const METRIC_LIST: MetricDefinition[] = METRIC_KEYS.map(
  (k) => METRIC_CATALOG[k]
);

/** Type guard: is the given string a known metric key? */
export function isMetricKey(value: string): value is MetricKey {
  return (METRIC_KEYS as readonly string[]).includes(value);
}

/** Resolves a metric definition, or `undefined` for an unknown key. */
export function getMetric(key: string): MetricDefinition | undefined {
  return isMetricKey(key) ? METRIC_CATALOG[key] : undefined;
}
