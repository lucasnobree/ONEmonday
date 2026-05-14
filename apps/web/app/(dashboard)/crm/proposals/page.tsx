"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useProposals } from "@/hooks/crm/use-proposals";
import { ProposalFormDialog } from "@/components/crm/proposal-form-dialog";
import { ProposalDetailSheet } from "@/components/crm/proposal-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { exportToCSV } from "@/lib/utils/export-csv";
import { Plus, Search, FileText, Download } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Rascunho",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  sent: {
    label: "Enviada",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  viewed: {
    label: "Visualizada",
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  accepted: {
    label: "Aceita",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  rejected: {
    label: "Rejeitada",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  expired: {
    label: "Expirada",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
};

export default function ProposalsPage() {
  const { currentSector } = useCurrentSector();
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: proposals, isLoading } = useProposals(
    currentSector?.id,
    statusFilter
  );
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    null
  );

  const filtered = useMemo(() => {
    if (!proposals) return [];
    if (!search.trim()) return proposals;
    const q = search.toLowerCase();
    return proposals.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.deal_title?.toLowerCase().includes(q)
    );
  }, [proposals, search]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar as propostas.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar propostas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="viewed">Visualizada</SelectItem>
              <SelectItem value="accepted">Aceita</SelectItem>
              <SelectItem value="rejected">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToCSV(
                filtered.map((p) => ({
                  titulo: p.title,
                  deal: p.deal_title ?? "",
                  valor: p.value,
                  status: statusConfig[p.status]?.label ?? p.status,
                  expira: p.expires_at
                    ? dateFormat.format(new Date(p.expires_at))
                    : "",
                })),
                `propostas-${new Date().toISOString().split("T")[0]}`,
                [
                  { key: "titulo", label: "Titulo" },
                  { key: "deal", label: "Deal" },
                  { key: "valor", label: "Valor" },
                  { key: "status", label: "Status" },
                  { key: "expira", label: "Expira em" },
                ]
              )
            }
            disabled={!filtered.length}
          >
            <Download className="size-4 mr-1" />
            Exportar
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Proposta
          </Button>
        </div>
      </div>

      {!proposals?.length && statusFilter === "all" ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma proposta cadastrada"
          description="Crie sua primeira proposta comercial para um deal."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Proposta
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma proposta encontrada.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left text-muted-foreground">
                <th className="py-3 px-4 font-medium">Titulo</th>
                <th className="py-3 px-4 font-medium">Deal</th>
                <th className="py-3 px-4 font-medium text-right">Valor</th>
                <th className="py-3 px-4 font-medium">Expira em</th>
                <th className="py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((proposal) => {
                const sc = statusConfig[proposal.status] ?? {
                  label: proposal.status,
                  className: "",
                };
                return (
                  <tr
                    key={proposal.id}
                    className="border-t cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedProposalId(proposal.id)}
                  >
                    <td className="py-3 px-4 font-medium">{proposal.title}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {proposal.deal_title ?? "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(proposal.value)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {proposal.expires_at
                        ? dateFormat.format(new Date(proposal.expires_at))
                        : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className={sc.className}>
                        {sc.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProposalFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        sectorId={currentSector.id}
      />

      <ProposalDetailSheet
        proposalId={selectedProposalId}
        sectorId={currentSector.id}
        open={!!selectedProposalId}
        onOpenChange={(o) => !o && setSelectedProposalId(null)}
      />
    </div>
  );
}
