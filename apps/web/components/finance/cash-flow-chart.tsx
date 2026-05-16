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
  // The RPC always returns 6 points (one per month), so `data.length` is
  // never 0 in practice — an all-zero series must also be treated as empty,
  // otherwise the chart renders a bare axis that looks broken.
  const hasMovement = data.some(
    (p) => p.income_cents !== 0 || p.expense_cents !== 0
  );

  if (data.length === 0 || !hasMovement) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Sem movimentação registrada nos últimos 6 meses.
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
