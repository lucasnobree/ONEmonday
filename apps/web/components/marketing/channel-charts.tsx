"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChannelBreakdown } from "@/hooks/marketing/use-marketing-summary";
import { CHANNEL_LABELS, CHANNEL_COLORS } from "@/lib/marketing/labels";
import { formatCents, fromCents } from "@/lib/finance/money";

interface ChannelChartsProps {
  data: ChannelBreakdown[];
}

/** Pie chart of marketing spend distributed across channels. */
export function SpendByChannelChart({ data }: ChannelChartsProps) {
  const chartData = data
    .filter((d) => d.spend_cents > 0)
    .map((d) => ({
      name: CHANNEL_LABELS[d.channel],
      value: fromCents(d.spend_cents),
      channel: d.channel,
    }));

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Sem gastos registrados por canal.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.channel}
              fill={CHANNEL_COLORS[entry.channel]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCents(Math.round(Number(value) * 100))}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Grouped bar chart of leads vs. conversions per channel. */
export function LeadsByChannelChart({ data }: ChannelChartsProps) {
  const chartData = data
    .filter((d) => d.leads > 0 || d.conversions > 0)
    .map((d) => ({
      channel: CHANNEL_LABELS[d.channel],
      Leads: d.leads,
      Conversoes: d.conversions,
    }));

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Sem leads ou conversoes registrados.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Conversoes" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
