"use client";

import { useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useFinanceSummary } from "@/hooks/finance/use-finance-summary";
import { useInvoices } from "@/hooks/finance/use-invoices";
import { CashFlowChart } from "@/components/finance/cash-flow-chart";
import { formatCents } from "@/lib/finance/money";
import { formatDateOnly } from "@/lib/finance/dates";
import { effectiveInvoiceStatus } from "@/lib/finance/invoice-status";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_VARIANTS } from "@/components/finance/labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  ArrowDownCircle,
} from "lucide-react";

export default function FinanceDashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: summary, isLoading: summaryLoading } = useFinanceSummary(
    currentSector?.id
  );
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(
    currentSector?.id
  );

  // Net cash position = total paid income minus total paid expense.
  const netCashCents = useMemo(() => {
    if (!summary) return 0;
    return summary.total_income_cents - summary.total_expense_cents;
  }, [summary]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o Financeiro.
      </p>
    );
  }

  const isLoading = summaryLoading || invoicesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Receita Recebida",
      value: formatCents(summary?.total_income_cents ?? 0),
      icon: TrendingUp,
      tone: "text-emerald-500",
    },
    {
      title: "Despesa Paga",
      value: formatCents(summary?.total_expense_cents ?? 0),
      icon: TrendingDown,
      tone: "text-red-500",
    },
    {
      title: "Caixa Líquido",
      value: formatCents(netCashCents),
      icon: Wallet,
      tone: netCashCents >= 0 ? "text-emerald-500" : "text-red-500",
    },
    {
      title: "A Receber (em aberto)",
      value: formatCents(summary?.outstanding_ar_cents ?? 0),
      icon: AlertCircle,
      tone: "text-amber-500",
      hint:
        (summary?.overdue_invoice_count ?? 0) > 0
          ? `${summary?.overdue_invoice_count} fatura(s) vencida(s)`
          : undefined,
    },
    {
      title: "A Pagar (em aberto)",
      value: formatCents(summary?.outstanding_ap_cents ?? 0),
      icon: ArrowDownCircle,
      tone: "text-red-500",
    },
  ];

  const recentInvoices = (invoices ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <stat.icon className={`h-5 w-5 ${stat.tone}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-bold truncate" title={stat.value}>
                    {stat.value}
                  </p>
                  {stat.hint && (
                    <p className="text-[11px] text-amber-600 leading-tight">
                      {stat.hint}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxo de Caixa</CardTitle>
          <CardDescription>
            Entradas e saídas pagas nos últimos 6 meses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={summary?.cash_flow ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturas Recentes</CardTitle>
          <CardDescription>Últimas contas a receber registradas</CardDescription>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma fatura registrada. Crie sua primeira em Faturas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Número</th>
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Valor</th>
                    <th className="pb-2 font-medium">Vencimento</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => {
                    const status = effectiveInvoiceStatus(inv);
                    return (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">{inv.number}</td>
                        <td className="py-3 text-muted-foreground">
                          {inv.customer_name}
                        </td>
                        <td className="py-3">
                          {formatCents(inv.amount_cents, inv.currency)}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {formatDateOnly(inv.due_date)}
                        </td>
                        <td className="py-3">
                          <Badge variant={INVOICE_STATUS_VARIANTS[status]}>
                            {INVOICE_STATUS_LABELS[status]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
