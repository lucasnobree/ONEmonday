"use client";

import { useMemo, useRef, useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useBankTransactions,
  useImportOfx,
  useReconcileTransaction,
  useUnreconcileTransaction,
  type BankTransactionRow,
} from "@/hooks/finance/use-bank-transactions";
import { useInvoices } from "@/hooks/finance/use-invoices";
import { useExpenses } from "@/hooks/finance/use-expenses";
import {
  suggestReconciliation,
  autoMatchableCount,
  type ReconcileCandidate,
} from "@/lib/finance/reconciliation";
import { formatCents } from "@/lib/finance/money";
import { formatDateOnly } from "@/lib/finance/dates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { Upload, Landmark, Link2, Link2Off } from "lucide-react";

export default function FinanceReconciliationPage() {
  const { currentSector } = useCurrentSector();
  const sectorId = currentSector?.id;

  const { data: transactions, isLoading } = useBankTransactions(sectorId);
  const { data: invoices } = useInvoices(sectorId);
  const { data: expenses } = useExpenses(sectorId);
  const importOfx = useImportOfx();
  const reconcile = useReconcileTransaction();
  const unreconcile = useUnreconcileTransaction();

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Per-transaction manual selection — keyed by transaction id.
  const [picked, setPicked] = useState<Record<string, string>>({});

  // Open candidates: sent/overdue invoices and pending expenses.
  const candidates: ReconcileCandidate[] = useMemo(() => {
    const inv: ReconcileCandidate[] = (invoices ?? [])
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .map((i) => ({
        id: i.id,
        kind: "invoice" as const,
        amountCents: i.amount_cents,
        referenceDate: i.due_date,
        partyName: i.customer_name,
      }));
    const exp: ReconcileCandidate[] = (expenses ?? [])
      .filter((e) => e.status === "pending")
      .map((e) => ({
        id: e.id,
        kind: "expense" as const,
        amountCents: e.amount_cents,
        referenceDate: e.expense_date,
        partyName: e.vendor_name,
      }));
    return [...inv, ...exp];
  }, [invoices, expenses]);

  const unmatched = useMemo(
    () => (transactions ?? []).filter((t) => t.match_status === "unmatched"),
    [transactions]
  );
  const matched = useMemo(
    () => (transactions ?? []).filter((t) => t.match_status === "matched"),
    [transactions]
  );

  // Suggestion per unmatched transaction. The matcher works on the generic
  // BankTransaction shape — map DB rows into it, keying by the row `id` so the
  // suggestion lookup below can use it directly.
  const suggestions = useMemo(
    () =>
      suggestReconciliation(
        unmatched.map((t) => ({
          externalId: t.id,
          direction: t.direction,
          amountCents: t.amount_cents,
          currency: t.currency,
          postedDate: t.posted_date,
          description: t.description ?? "",
        })),
        candidates
      ),
    [unmatched, candidates]
  );
  const suggestionByTx = useMemo(() => {
    const map = new Map<string, ReturnType<typeof suggestReconciliation>[number]>();
    suggestions.forEach((s) => map.set(s.transactionExternalId, s));
    return map;
  }, [suggestions]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar a conciliação bancária.
      </p>
    );
  }

  const handleFile = async (file: File) => {
    const content = await file.text();
    const result = await importOfx.mutateAsync({
      sectorId: currentSector.id,
      ofxContent: content,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao importar OFX"
      );
      return;
    }
    const data = result.data;
    toast.success(
      `${data?.imported ?? 0} importada(s), ${data?.skipped ?? 0} já existente(s)`
    );
  };

  const candidateLabel = (c: ReconcileCandidate) =>
    `${c.kind === "invoice" ? "Fatura" : "Despesa"} · ${c.partyName} · ${formatCents(
      c.amountCents
    )}`;

  const doReconcile = async (
    tx: BankTransactionRow,
    candidate: ReconcileCandidate
  ) => {
    const result = await reconcile.mutateAsync({
      transactionId: tx.id,
      invoiceId: candidate.kind === "invoice" ? candidate.id : undefined,
      expenseId: candidate.kind === "expense" ? candidate.id : undefined,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao conciliar"
      );
      return;
    }
    toast.success("Transação conciliada");
  };

  return (
    <div className="space-y-6">
      {/* Import controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar extrato</CardTitle>
          <CardDescription>
            Importe um arquivo OFX do banco. A sincronização automática via
            Open Finance (Pluggy) fica disponível quando o agregador estiver
            configurado nas integrações.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importOfx.isPending}
          >
            <Upload className="size-4 mr-1" />
            {importOfx.isPending ? "Importando..." : "Importar OFX"}
          </Button>
          {unmatched.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {autoMatchableCount(suggestions)} de {unmatched.length} com
              sugestão de correspondência exata.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Unmatched transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Transações não conciliadas ({unmatched.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : unmatched.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Nada para conciliar"
              description="Importe um extrato OFX para começar a conciliação."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2 font-medium">Data</th>
                    <th className="p-2 font-medium">Descrição</th>
                    <th className="p-2 font-medium">Tipo</th>
                    <th className="p-2 font-medium text-right">Valor</th>
                    <th className="p-2 font-medium">Conciliar com</th>
                    <th className="p-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.map((tx) => {
                    const suggestion = suggestionByTx.get(tx.id);
                    const options = suggestion?.candidates ?? [];
                    const selectedId =
                      picked[tx.id] ??
                      (suggestion?.confidence === "high"
                        ? options[0]?.id
                        : undefined);
                    const selected = options.find(
                      (o) => o.id === selectedId
                    );
                    return (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="p-2 text-muted-foreground">
                          {formatDateOnly(tx.posted_date)}
                        </td>
                        <td className="p-2">{tx.description || "—"}</td>
                        <td className="p-2">
                          <Badge
                            variant={
                              tx.direction === "credit"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {tx.direction === "credit"
                              ? "Entrada"
                              : "Saída"}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-medium">
                          {formatCents(tx.amount_cents)}
                        </td>
                        <td className="p-2">
                          {options.length === 0 ? (
                            <span className="text-muted-foreground">
                              Sem correspondência
                            </span>
                          ) : (
                            <Select
                              value={selectedId}
                              onValueChange={(v: string | null) => {
                                if (!v) return;
                                setPicked(
                                  (p): Record<string, string> => ({
                                    ...p,
                                    [tx.id]: v,
                                  })
                                );
                              }}
                            >
                              <SelectTrigger className="w-64">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {options.map((o) => (
                                  <SelectItem key={o.id} value={o.id}>
                                    {candidateLabel(o)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!selected || reconcile.isPending}
                            onClick={() =>
                              selected && doReconcile(tx, selected)
                            }
                          >
                            <Link2 className="size-4 mr-1" />
                            Conciliar
                          </Button>
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

      {/* Matched transactions */}
      {matched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Transações conciliadas ({matched.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2 font-medium">Data</th>
                    <th className="p-2 font-medium">Descrição</th>
                    <th className="p-2 font-medium text-right">Valor</th>
                    <th className="p-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="p-2 text-muted-foreground">
                        {formatDateOnly(tx.posted_date)}
                      </td>
                      <td className="p-2">{tx.description || "—"}</td>
                      <td className="p-2 text-right font-medium">
                        {formatCents(tx.amount_cents)}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={unreconcile.isPending}
                          onClick={async () => {
                            const result =
                              await unreconcile.mutateAsync(tx.id);
                            if (result.error) {
                              toast.error(
                                typeof result.error === "string"
                                  ? result.error
                                  : "Erro"
                              );
                            } else {
                              toast.success("Conciliação desfeita");
                            }
                          }}
                        >
                          <Link2Off className="size-4 mr-1" />
                          Desfazer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
