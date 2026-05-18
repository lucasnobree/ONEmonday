"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useTickets } from "@/hooks/support/use-tickets";
import { useQueryClient } from "@tanstack/react-query";
import {
  resolveTicket,
  bulkUpdateTicketStatus,
} from "@/lib/actions/support/tickets";
import { PermissionGate } from "@/components/shared/permission-gate";
import { TicketCreateDialog } from "@/components/support/ticket-create-dialog";
import {
  Card,
  CardContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  Ticket,
  Clock,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { exportToCSV } from "@/lib/utils/export-csv";
import { EmptyState } from "@/components/shared/empty-state";
import { TicketDetailSheet } from "@/components/support/ticket-detail-sheet";
import { useSlaStatus } from "@/hooks/support/use-sla-status";
import type { SlaStatusEntry } from "@/hooks/support/use-sla-status";
import {
  useSectorTags,
  useSectorTicketTags,
  TAG_COLOR_CLASSES,
} from "@/hooks/support/use-ticket-tags";
import {
  TICKET_STATUS_META,
  TICKET_STATUS_OPTIONS,
  normalizeTicketStatus,
} from "@/lib/support/status";
import {
  sortTickets,
  type TicketSortKey,
  type SortDirection,
} from "@/lib/support/ticket-sort";

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const priorityLabels: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

// base-ui's <SelectValue> renders the raw selected value when no `items`
// prop is supplied to the Root, so a value of "all" shows the literal
// string "all". These maps drive a value->label function child on each
// SelectValue so the trigger always shows a localized label.
const statusFilterLabels: Record<string, string> = {
  all: "Todos os status",
  ...Object.fromEntries(
    TICKET_STATUS_OPTIONS.map((o) => [o.value, o.label])
  ),
};

const priorityFilterLabels: Record<string, string> = {
  all: "Todas",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

function getSlaIndicator(
  ticketId: string,
  slaMap: Map<string, SlaStatusEntry>
): { color: string; label: string } | null {
  const entry = slaMap.get(ticketId);
  if (!entry) return null;
  const pct = entry.remaining_pct;
  if (pct <= 0)
    return {
      color: "bg-gray-200 text-gray-600 line-through dark:bg-gray-800 dark:text-gray-400",
      label: "SLA Violado",
    };
  if (pct < 25)
    return {
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      label: "SLA Crítico",
    };
  if (pct <= 50)
    return {
      color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      label: "SLA Alerta",
    };
  return {
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    label: "SLA OK",
  };
}

// Sortable column header — clicking toggles the sort direction.
function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: TicketSortKey;
  activeKey: TicketSortKey;
  direction: SortDirection;
  onSort: (key: TicketSortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className="pb-2 font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {active &&
          (direction === "asc" ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          ))}
      </button>
    </th>
  );
}

export default function TicketsPage() {
  const { currentSector } = useCurrentSector();
  const { data: tickets, isLoading } = useTickets(currentSector?.id);
  const { data: slaEntries } = useSlaStatus();
  const { data: sectorTags } = useSectorTags(currentSector?.id);
  const { data: ticketTagsMap } = useSectorTicketTags(currentSector?.id);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<TicketSortKey>("created");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const slaMap = useMemo(() => {
    const map = new Map<string, SlaStatusEntry>();
    if (slaEntries) {
      for (const entry of slaEntries) {
        map.set(entry.ticket_id, entry);
      }
    }
    return map;
  }, [slaEntries]);

  const categories = useMemo(() => {
    if (!tickets) return [];
    const cats = new Set(tickets.map((t) => t.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [tickets]);

  const filtered = useMemo(() => {
    if (!tickets) return [];
    const rows = tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.card?.priority !== priorityFilter)
        return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter)
        return false;
      if (tagFilter !== "all") {
        const tags = ticketTagsMap?.get(t.id) ?? [];
        if (!tags.some((tag) => tag.id === tagFilter)) return false;
      }
      return true;
    });
    return sortTickets(rows, sortKey, sortDir);
  }, [
    tickets,
    statusFilter,
    priorityFilter,
    categoryFilter,
    tagFilter,
    ticketTagsMap,
    sortKey,
    sortDir,
  ]);

  // Drop selections that fell out of the filtered view.
  const visibleSelectedIds = useMemo(() => {
    const visible = new Set(filtered.map((t) => t.id));
    return [...selectedIds].filter((id) => visible.has(id));
  }, [filtered, selectedIds]);

  function handleSort(key: TicketSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created" ? "desc" : "asc");
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const allVisible = filtered.every((t) => prev.has(t.id));
      if (allVisible) return new Set();
      return new Set(filtered.map((t) => t.id));
    });
  }

  async function handleResolve(ticketId: string) {
    const result = await resolveTicket(ticketId);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao resolver"
      );
      return;
    }
    toast.success("Ticket resolvido");
    queryClient.invalidateQueries({
      queryKey: ["support-tickets", currentSector?.id],
    });
    queryClient.invalidateQueries({ queryKey: ["sla-status"] });
  }

  async function handleBulkStatus(status: string) {
    if (!visibleSelectedIds.length) return;
    setBulkBusy(true);
    const result = await bulkUpdateTicketStatus({
      ticketIds: visibleSelectedIds,
      status,
    });
    setBulkBusy(false);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro na ação em lote"
      );
      return;
    }
    const updated = "updated" in result ? result.updated : 0;
    toast.success(
      `${updated} ticket${updated === 1 ? "" : "s"} atualizado${
        updated === 1 ? "" : "s"
      }`
    );
    setSelectedIds(new Set());
    queryClient.invalidateQueries({
      queryKey: ["support-tickets", currentSector?.id],
    });
    queryClient.invalidateQueries({ queryKey: ["sla-status"] });
  }

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver os tickets.
      </p>
    );
  }

  const allVisibleChecked =
    filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="ticket"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Você não tem permissão para acessar os tickets deste setor.
        </p>
      }
    >
      <div className="space-y-4">
        {/* Header with filters and create button */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? "all")}
          >
            <SelectTrigger className="w-44">
              <SelectValue>
                {(value) => statusFilterLabels[value as string] ?? "Status"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {TICKET_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v ?? "all")}
          >
            <SelectTrigger className="w-35">
              <SelectValue>
                {(value) =>
                  priorityFilterLabels[value as string] ?? "Prioridade"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v ?? "all")}
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {(value) =>
                  value === "all" || value == null
                    ? "Categoria"
                    : (value as string)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={tagFilter}
            onValueChange={(v) => setTagFilter(v ?? "all")}
          >
            <SelectTrigger className="w-35">
              <SelectValue>
                {(value) =>
                  value === "all" || value == null
                    ? "Tag"
                    : ((sectorTags ?? []).find((t) => t.id === value)?.name ??
                      "Tag")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {(sectorTags ?? []).map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(
                  filtered.map((t) => ({
                    titulo: t.card?.title ?? "",
                    prioridade: t.card?.priority
                      ? (priorityLabels[t.card.priority] ?? t.card.priority)
                      : "",
                    status:
                      TICKET_STATUS_META[normalizeTicketStatus(t.status)]
                        .label,
                    categoria: t.category ?? "",
                    responsavel:
                      (t.card?.card_assignees ?? [])
                        .map((a) => a.users?.full_name)
                        .filter(Boolean)
                        .join("; ") || "",
                    tags:
                      (ticketTagsMap?.get(t.id) ?? [])
                        .map((tag) => tag.name)
                        .join("; ") || "",
                    canal: t.channel ?? "",
                    criado_em: new Date(t.created_at).toLocaleDateString(
                      "pt-BR"
                    ),
                  })),
                  `tickets-${new Date().toISOString().split("T")[0]}`,
                  [
                    { key: "titulo", label: "Título" },
                    { key: "prioridade", label: "Prioridade" },
                    { key: "status", label: "Status" },
                    { key: "categoria", label: "Categoria" },
                    { key: "responsavel", label: "Responsável" },
                    { key: "tags", label: "Tags" },
                    { key: "canal", label: "Canal" },
                    { key: "criado_em", label: "Criado em" },
                  ]
                )
              }
              disabled={!filtered.length}
            >
              <Download className="size-4 mr-1" />
              Exportar
            </Button>
            <TicketCreateDialog
              sectorId={currentSector.id}
              boardId=""
              columnId=""
              onCreated={() =>
                queryClient.invalidateQueries({
                  queryKey: ["support-tickets", currentSector.id],
                })
              }
            />
          </div>
        </div>

        {/* Bulk action bar */}
        {visibleSelectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">
              {visibleSelectedIds.length} selecionado
              {visibleSelectedIds.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Alterar status:
              </span>
              {TICKET_STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="outline"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => handleBulkStatus(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar seleção
            </Button>
          </div>
        )}

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !tickets?.length ? (
              <EmptyState
                icon={Ticket}
                title="Nenhum ticket ainda"
                description="Crie seu primeiro ticket de suporte para começar a gerenciar atendimentos."
                action={
                  <TicketCreateDialog
                    sectorId={currentSector.id}
                    boardId=""
                    columnId=""
                    onCreated={() =>
                      queryClient.invalidateQueries({
                        queryKey: ["support-tickets", currentSector.id],
                      })
                    }
                  />
                }
              />
            ) : !filtered.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum ticket encontrado com os filtros selecionados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 w-8">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os tickets"
                          className="size-4 cursor-pointer accent-primary align-middle"
                          checked={allVisibleChecked}
                          onChange={toggleAll}
                        />
                      </th>
                      <SortHeader
                        label="Título"
                        sortKey="title"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Prioridade"
                        sortKey="priority"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Status"
                        sortKey="status"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                      <th className="pb-2 font-medium">Categoria</th>
                      <th className="pb-2 font-medium">Responsável</th>
                      <th className="pb-2 font-medium">Canal</th>
                      <th className="pb-2 font-medium">SLA</th>
                      <SortHeader
                        label="Criado em"
                        sortKey="created"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                      <th className="pb-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((ticket) => {
                      const statusMeta =
                        TICKET_STATUS_META[normalizeTicketStatus(ticket.status)];
                      return (
                        <tr
                          key={ticket.id}
                          className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            setSelectedTicketId(ticket.card?.id || null)
                          }
                        >
                          <td
                            className="py-3 pr-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ticket ${
                                ticket.card?.title ?? ""
                              }`}
                              className="size-4 cursor-pointer accent-primary align-middle"
                              checked={selectedIds.has(ticket.id)}
                              onChange={() => toggleOne(ticket.id)}
                            />
                          </td>
                          <td className="py-3 pr-4 font-medium">
                            <div className="space-y-1">
                              <span>{ticket.card?.title || "—"}</span>
                              {(() => {
                                const tags =
                                  ticketTagsMap?.get(ticket.id) ?? [];
                                if (!tags.length) return null;
                                return (
                                  <div className="flex flex-wrap gap-1">
                                    {tags.map((tag) => (
                                      <Badge
                                        key={tag.id}
                                        variant="secondary"
                                        className={`text-[10px] px-1.5 py-0 font-normal ${
                                          TAG_COLOR_CLASSES[tag.color]
                                        }`}
                                      >
                                        {tag.name}
                                      </Badge>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant="secondary"
                              className={
                                priorityColors[ticket.card?.priority ?? ""] ||
                                ""
                              }
                            >
                              {priorityLabels[ticket.card?.priority ?? ""] ||
                                ticket.card?.priority}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="secondary"
                                className={statusMeta.badgeClass}
                              >
                                {statusMeta.label}
                              </Badge>
                              {ticket.escalated_to_sector_id && (
                                <Badge
                                  variant="secondary"
                                  className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                >
                                  Escalado
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {ticket.category || "—"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {(() => {
                              const assignees =
                                ticket.card?.card_assignees ?? [];
                              if (!assignees.length) return "—";
                              const names = assignees
                                .map((a) => a.users?.full_name)
                                .filter(Boolean);
                              return names.length ? names.join(", ") : "—";
                            })()}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground capitalize">
                            {ticket.channel || "—"}
                          </td>
                          <td className="py-3 pr-4">
                            {(() => {
                              const sla = getSlaIndicator(ticket.id, slaMap);
                              if (!sla)
                                return (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                );
                              return (
                                <Badge
                                  variant="secondary"
                                  className={sla.color}
                                >
                                  <Clock className="size-3 mr-1" />
                                  {sla.label}
                                </Badge>
                              );
                            })()}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {new Date(ticket.created_at).toLocaleDateString(
                              "pt-BR"
                            )}
                          </td>
                          <td className="py-3">
                            {ticket.status !== "resolved" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolve(ticket.id);
                                }}
                                title="Resolver ticket"
                              >
                                <CheckCircle2 className="size-4" />
                              </Button>
                            )}
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
        <TicketDetailSheet
          ticketId={selectedTicketId}
          open={!!selectedTicketId}
          onOpenChange={(o) => !o && setSelectedTicketId(null)}
        />
      </div>
    </PermissionGate>
  );
}
