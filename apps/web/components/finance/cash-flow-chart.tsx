"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CashFlowPoint } from "@/hooks/finance/use-finance-summary";
import { formatCents, fromCents } from "@/lib/finance/money";

interface CashFlowChartProps {
  data: CashFlowPoint[];
}

/**
 * 6-month inflow vs. outflow bar chart. Amounts arrive as integer cents and
 * are converted to major units only for axis ticks / tooltip display.
 */
export function CashFlowChart({ data }: CashFlowChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Sem dados de fluxo de caixa.
      </p>
    );
  }

  const chartData = data.map((p) => ({
    month: p.month,
    Entradas: fromCents(p.income_cents),
    Saidas: fromCents(p.expense_cents),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) =>
            new Intl.NumberFormat("pt-BR", {
              notation: "compact",
            }).format(v)
          }
        />
        <Tooltip
          formatter={(value) => formatCents(Math.round(Number(value) * 100))}
        />
        <Legend />
        <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
