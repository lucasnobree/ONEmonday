"use client";

import { useMemo, useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useLeads, useLeadStats, type Lead } from "@/hooks/crm/use-leads";
import { LeadDetailSheet } from "@/components/crm/lead-detail-sheet";
import { LeadCreateDialog } from "@/components/crm/lead-create-dialog";
import {
  leadBandClass,
  leadStatusLabel,
  leadStatusVariant,
} from "@/lib/crm/lead-ui";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterSelect } from "@/components/shared/filter-select";
import { leadSourceLabel } from "@/lib/crm/lead-sources";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus, Search, Inbox } from "lucide-react";

type SortKey = "score" | "recent";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default function LeadsInboxPage() {
  const { currentSector } = useCurrentSector();
  const { data: leads, isLoading } = useLeads(currentSector?.id);
  const { data: stats } = useLeadStats(currentSector?.id);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Distinct sources present, for the filter dropdown.
  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads ?? []) set.add(l.source);
    return [...set].sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.company?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }
    if (sourceFilter !== "all") {
      result = result.filter((l) => l.source === sourceFilter);
    }
    // The list is server-sorted by score; re-sort client-side when requested.
    return [...result].sort((a, b) =>
      sort === "score"
        ? b.score - a.score ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [leads, search, statusFilter, sourceFilter, sort]);

  const hasFilter =
    search.trim() !== "" || statusFilter !== "all" || sourceFilter !== "all";

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar a caixa de entrada de leads.
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
      {/* KPI cards */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground">
                Novos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {stats.new}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground">
                Em trabalho
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {stats.working}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground">
                Qualificados
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {stats.qualified}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground">
                Descartados
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {stats.discarded}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground">
                Score médio
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {stats.avg_score}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="size-4 mr-1" />
          Novo lead
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}
          className="w-44"
          aria-label="Filtrar por status"
          options={[
            { value: "all", label: "Todos os status" },
            ...LEAD_STATUSES.map((s) => ({
              value: s,
              label: leadStatusLabel(s),
            })),
          ]}
        />
        <FilterSelect
          value={sourceFilter}
          onValueChange={setSourceFilter}
          className="w-44"
          aria-label="Filtrar por origem"
          options={[
            { value: "all", label: "Toda origem" },
            ...sourceOptions.map((s) => ({
              value: s,
              label: leadSourceLabel(s),
            })),
          ]}
        />
        <FilterSelect
          value={sort}
          onValueChange={(v) => setSort(v as SortKey)}
          className="w-44"
          aria-label="Ordenar leads"
          options={[
            { value: "score", label: "Maior score" },
            { value: "recent", label: "Mais recentes" },
          ]}
        />
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setSourceFilter("all");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {!leads?.length ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum lead na caixa de entrada"
          description="Publique um formulário de captura ou adicione um lead manualmente para começar."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="size-4 mr-1" />
              Novo lead
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum lead encontrado para os filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2.5 pl-3 font-medium">Score</th>
                <th className="py-2.5 font-medium">Lead</th>
                <th className="py-2.5 font-medium">Empresa</th>
                <th className="py-2.5 font-medium">Origem</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 pr-3 font-medium">Recebido</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="py-2.5 pl-3">
                    <Badge className={leadBandClass(lead.score)}>
                      {lead.score}
                    </Badge>
                  </td>
                  <td className="py-2.5">
                    <div className="font-medium">{lead.name}</div>
                    {lead.email && (
                      <div className="text-xs text-muted-foreground">
                        {lead.email}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {lead.company ?? "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {leadSourceLabel(lead.source)}
                  </td>
                  <td className="py-2.5">
                    <Badge variant={leadStatusVariant(lead.status)}>
                      {leadStatusLabel(lead.status)}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {dateFormat.format(new Date(lead.created_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        sectorId={currentSector.id}
      />

      <LeadDetailSheet
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(o) => !o && setSelectedLead(null)}
      />
    </div>
  );
}
