"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/hooks/analytics/use-analytics-trend";
import type { ChartType } from "@/lib/validations/analytics";
import { type MetricDefinition } from "@/lib/analytics/metrics";
import { formatMetricValue } from "@/lib/analytics/kpi";

const PIE_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

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
        Sem dados no periodo
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

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="bucket" outerRadius={80}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={tooltipFormatter} />
        </PieChart>
      </ResponsiveContainer>
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
