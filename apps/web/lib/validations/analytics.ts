import { z } from "zod";
import { METRIC_KEYS } from "@/lib/analytics/metrics";

/**
 * Chart types a saved report can use — must mirror the `chart_type` CHECK
 * constraint in migration 00050.
 */
export const CHART_TYPES = ["bar", "line", "pie", "kpi"] as const;

/**
 * Grouping dimensions — must mirror the `group_by` CHECK constraint in
 * migration 00050.
 *
 * NOTE: `get_analytics_trend` only ever produces a monthly time-series, so
 * `group_by` has no effect on what a report renders. The report form no
 * longer exposes it (the control silently did nothing); the column keeps
 * its `month` default and the enum is retained so existing rows with any of
 * these values still validate.
 */
export const GROUP_BY_OPTIONS = [
  "day",
  "week",
  "month",
  "status",
  "priority",
] as const;

/** Metric keys, sourced from the governed catalog so the two never diverge. */
const metricSchema = z.enum(METRIC_KEYS);

/**
 * Rolling window in days a report covers. 0 means all-time; the upper bound
 * (10 years) matches the DB CHECK constraint.
 */
const dateRangeDaysSchema = z
  .number()
  .int("Periodo deve ser um numero inteiro de dias")
  .min(0, "Periodo invalido")
  .max(3650, "Periodo muito longo");

// =============================================
// Saved reports
// =============================================
export const createReportSchema = z.object({
  sectorId: z.string().uuid(),
  name: z.string().min(1, "Nome e obrigatorio").max(120),
  description: z.string().max(500).optional(),
  metric: metricSchema,
  chartType: z.enum(CHART_TYPES).default("bar"),
  groupBy: z.enum(GROUP_BY_OPTIONS).default("month"),
  dateRangeDays: dateRangeDaysSchema.default(30),
});

export const updateReportSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Nome e obrigatorio").max(120),
  description: z.string().max(500).optional(),
  metric: metricSchema,
  chartType: z.enum(CHART_TYPES),
  groupBy: z.enum(GROUP_BY_OPTIONS).default("month"),
  dateRangeDays: dateRangeDaysSchema,
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ChartType = (typeof CHART_TYPES)[number];
export type GroupBy = (typeof GROUP_BY_OPTIONS)[number];
