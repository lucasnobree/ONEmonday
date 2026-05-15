"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useContracts, type Contract } from "@/hooks/legal/use-contracts";
import { ContractFormDialog } from "@/components/legal/contract-form-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText, Search } from "lucide-react";
import { CONTRACT_STATUSES } from "@/lib/validations/legal";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  RENEWAL_STATUS_LABELS,
  formatCurrency,
} from "@/lib/legal/labels";
import { getRenewalStatus } from "@/lib/legal/renewal";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

export default function ContractsPage() {
  const { currentSector } = useCurrentSector();
  const { data: contracts, isLoading } = useContracts(currentSector?.id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Contract | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (contracts ?? []).filter((c: Contract) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (term) {
        const haystack = [c.title, c.counterparty].join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [contracts, statusFilter, search]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver os contratos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por titulo ou contraparte"
              className="w-64 pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {CONTRACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CONTRACT_STATUS_LABELS[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ContractFormDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Contratos ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          ) : !(contracts ?? []).length ? (
            <EmptyState
              icon={FileText}
              title="Nenhum contrato cadastrado"
              description="Adicione seu primeiro contrato para acompanhar prazos e renovacoes."
              action={<ContractFormDialog />}
            />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum contrato encontrado com os filtros selecionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Titulo</th>
                    <th className="pb-2 font-medium">Contraparte</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Valor</th>
                    <th className="pb-2 font-medium">Vencimento</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Renovacao</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contract: Contract) => {
                    const statusInfo =
                      CONTRACT_STATUS_LABELS[contract.status] ?? {
                        label: contract.status,
                        variant: "secondary" as const,
                      };
                    const renewalStatus = getRenewalStatus(
                      contract.expiry_date,
                      contract.notice_period_days
                    );
                    const renewalInfo = RENEWAL_STATUS_LABELS[renewalStatus];
                    return (
                      <tr
                        key={contract.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setEditing(contract)}
                      >
                        <td className="py-2 font-medium">{contract.title}</td>
                        <td className="py-2">{contract.counterparty}</td>
                        <td className="py-2">
                          {CONTRACT_TYPE_LABELS[contract.contract_type] ??
                            contract.contract_type}
                        </td>
                        <td className="py-2">
                          {formatCurrency(
                            contract.value_amount,
                            contract.currency
                          )}
                        </td>
                        <td className="py-2">
                          {contract.expiry_date
                            ? dateFormat.format(
                                new Date(contract.expiry_date)
                              )
                            : "-"}
                        </td>
                        <td className="py-2">
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <Badge variant={renewalInfo.variant}>
                            {renewalInfo.label}
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

      {editing && (
        <ContractFormDialog
          key={editing.id}
          contract={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          hideTrigger
        />
      )}
    </div>
  );
}
