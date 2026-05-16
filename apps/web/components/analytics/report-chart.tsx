"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/hooks/analytics/use-analytics-trend";
import type { ChartType } from "@/lib/validations/analytics";
import { type MetricDefinition } from "@/lib/analytics/metrics";
import { formatMetricValue } from "@/lib/analytics/kpi";

interface ReportChartProps {
  data: TrendPoint[];
  chartType: ChartType;
  metric: MetricDefinition;
}

/** Renders a saved report's trend series in its configured chart type. */
export function ReportChart({ data, chartType, metric }: ReportChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Sem dados no período
      </div>
    );
  }

  const format = (v: number) => formatMetricValue(v, metric.unit);
  // recharts types the tooltip value loosely; accept `unknown` and coerce.
  const tooltipFormatter = (value: unknown) => format(Number(value));

  // "kpi" — collapse the series to its most recent value.
  if (chartType === "kpi") {
    const latest = data[data.length - 1]?.value ?? 0;
    return (
      <div className="flex h-[220px] flex-col items-center justify-center">
        <span className="text-4xl font-bold">{format(latest)}</span>
        <span className="mt-1 text-sm text-muted-foreground">
          {data[data.length - 1]?.bucket}
        </span>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="bucket" fontSize={12} />
          <YAxis fontSize={12} width={48} />
          <Tooltip formatter={tooltipFormatter} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0ea5e9"
            strokeWidth={2}
            name={metric.label}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Default — bar chart. A legacy "pie" report also lands here: a pie of a
  // monthly time-series is misleading, so it is rendered as bars instead.
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="bucket" fontSize={12} />
        <YAxis fontSize={12} width={48} />
        <Tooltip formatter={tooltipFormatter} />
        <Bar dataKey="value" fill="#0ea5e9" name={metric.label} radius={4} />
      </BarChart>
    </ResponsiveContainer>
  );
}
