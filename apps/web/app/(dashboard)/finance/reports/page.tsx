"use client";

import { useMemo, useState } from "react";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { isAllSectors } from "@/lib/navigation/sector-scope";
import { useFinanceDre } from "@/hooks/finance/use-finance-dre";
import { useFinanceAging } from "@/hooks/finance/use-finance-aging";
import { useInvoices } from "@/hooks/finance/use-invoices";
import { useExpenses } from "@/hooks/finance/use-expenses";
import { buildDre } from "@/lib/finance/dre";
import type { AgingItem } from "@/lib/finance/aging";
import {
  buildAccountingExport,
  accountingExportNetCents,
} from "@/lib/finance/accounting-export";
import { formatCents } from "@/lib/finance/money";
import { todayDateOnly, shiftMonthKey, currentMonthKey } from "@/lib/finance/dates";
import { CATEGORY_LABELS } from "@/components/finance/labels";
import { AgingTable } from "@/components/finance/aging-table";
import { exportToCSV } from "@/lib/utils/export-csv";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download } from "lucide-react";

/** First day of the current month, as a date-only string. */
function monthStart(): string {
  return `${currentMonthKey()}-01`;
}

export default function FinanceReportsPage() {
  const { scope } = useSectorScope();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayDateOnly);

  const { data: drePayload, isLoading: dreLoading } = useFinanceDre(
    scope,
    from,
    to
  );
  const { data: aging, isLoading: agingLoading } = useFinanceAging(scope);
  const { data: invoices } = useInvoices(scope);
  const { data: expenses } = useExpenses(scope);
  // The DRE and aging RPCs are single-sector by contract; under the
  // all-sectors scope they resolve to null and the report shows a hint.
  const allSectors = isAllSectors(scope);

  const dre = useMemo(
    () => (drePayload ? buildDre(drePayload) : null),
    [drePayload]
  );

  const receivableItems: AgingItem[] = useMemo(
    () =>
      (aging?.receivables ?? []).map((r) => ({
        partyName: r.party_name,
        amountCents: r.amount_cents,
        daysOverdue: r.days_overdue,
      })),
    [aging]
  );

  const payableItems: AgingItem[] = useMemo(
    () =>
      (aging?.payables ?? []).map((p) => ({
        partyName: p.party_name,
        amountCents: p.amount_cents,
        daysOverdue: p.days_overdue,
      })),
    [aging]
  );

  const exportRows = useMemo(
    () => buildAccountingExport(invoices ?? [], expenses ?? [], from, to),
    [invoices, expenses, from, to]
  );

  const handleAccountantExport = () => {
    if (exportRows.length === 0) {
      toast.error("Nenhum lançamento pago no período");
      return;
    }
    exportToCSV(
      exportRows as unknown as Record<string, unknown>[],
      `lancamentos-contabeis-${from}_a_${to}`,
      [
        { key: "date", label: "Data" },
        { key: "type", label: "Tipo" },
        { key: "category", label: "Categoria" },
        { key: "party", label: "Parte" },
        { key: "description", label: "Descrição" },
        { key: "amount", label: "Valor" },
        { key: "currency", label: "Moeda" },
      ]
    );
    toast.success(`${exportRows.length} lançamento(s) exportado(s)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <SectorScopeFilter />
      </div>

      {/* Period selector */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="report-from">De</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to">Até</Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(`${shiftMonthKey(currentMonthKey(), -1)}-01`);
              setTo(monthStart());
            }}
          >
            Mês anterior
          </Button>
        </CardContent>
      </Card>

      {/* Management DRE / P&L */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">DRE Gerencial</CardTitle>
          <CardDescription>
            Demonstrativo de resultado para gestão interna (regime de caixa).
            Não substitui a DRE oficial nem o SPED — esses permanecem com o
            contador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allSectors ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Selecione um setor específico para ver a DRE gerencial.
            </p>
          ) : dreLoading || !dre ? (
            <div className="h-40 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Receita</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {formatCents(dre.revenueCents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Despesas</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatCents(dre.expenseTotalCents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Resultado</p>
                  <p
                    className={`text-lg font-bold ${
                      dre.netResultCents >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCents(dre.netResultCents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Margem</p>
                  <p className="text-lg font-bold">{dre.marginPercent}%</p>
                </div>
              </div>

              {dre.expenseLines.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2 font-medium">Categoria</th>
                        <th className="p-2 font-medium text-right">Valor</th>
                        <th className="p-2 font-medium text-right">% Desp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dre.expenseLines.map((line) => (
                        <tr
                          key={line.category}
                          className="border-b last:border-0"
                        >
                          <td className="p-2">
                            {CATEGORY_LABELS[line.category]}
                          </td>
                          <td className="p-2 text-right">
                            {formatCents(line.amountCents)}
                          </td>
                          <td className="p-2 text-right text-muted-foreground">
                            {line.sharePercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AR / AP aging — always reflects the current position, not the
          De/Até period above (the aging RPC takes no date argument). */}
      <AgingTable
        title="Aging de Recebíveis (Contas a Receber)"
        items={receivableItems}
        emptyLabel={
          allSectors
            ? "Selecione um setor específico para ver o aging."
            : "Nenhuma fatura em aberto."
        }
        isLoading={agingLoading}
        caption="Posição atual — não considera o período selecionado acima."
      />
      <AgingTable
        title="Aging de Pagáveis (Contas a Pagar)"
        items={payableItems}
        emptyLabel={
          allSectors
            ? "Selecione um setor específico para ver o aging."
            : "Nenhuma despesa em aberto."
        }
        isLoading={agingLoading}
        caption="Posição atual — não considera o período selecionado acima."
      />

      {/* Accountant export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exportação para o Contador</CardTitle>
          <CardDescription>
            Lançamentos pagos no período, categorizados, em CSV — para o
            contador importar. O SPED/ECD/ECF e os livros oficiais continuam
            sendo responsabilidade do contador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Button onClick={handleAccountantExport}>
            <Download className="size-4 mr-1" />
            Exportar lançamentos ({exportRows.length})
          </Button>
          {exportRows.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Resultado líquido no período:{" "}
              <span className="font-semibold">
                {formatCents(accountingExportNetCents(exportRows))}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
