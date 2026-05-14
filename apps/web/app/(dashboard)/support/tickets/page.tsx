"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useTickets } from "@/hooks/support/use-tickets";
import { useQueryClient } from "@tanstack/react-query";
import { resolveTicket } from "@/lib/actions/support/tickets";
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
import { CheckCircle2, Ticket } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { TicketDetailSheet } from "@/components/support/ticket-detail-sheet";

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const priorityLabels: Record<string, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

export default function TicketsPage() {
  const { currentSector } = useCurrentSector();
  const { data: tickets, isLoading } = useTickets(currentSector?.id);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!tickets) return [];
    const cats = new Set(
      tickets.map((t: any) => t.category).filter(Boolean)
    );
    return Array.from(cats) as string[];
  }, [tickets]);

  const filtered = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((t: any) => {
      if (statusFilter === "open" && t.resolved_at) return false;
      if (statusFilter === "resolved" && !t.resolved_at) return false;
      if (priorityFilter !== "all" && t.card?.priority !== priorityFilter)
        return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter)
        return false;
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, categoryFilter]);

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
  }

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver os tickets.
      </p>
    );
  }

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="ticket"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Voce nao tem permissao para acessar os tickets deste setor.
        </p>
      }
    >
      <div className="space-y-4">
        {/* Header with filters and create button */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="resolved">Resolvidos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Critica</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Categoria" />
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

          <div className="ml-auto">
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
                description="Crie seu primeiro ticket de suporte para comecar a gerenciar atendimentos."
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
                      <th className="pb-2 font-medium">Titulo</th>
                      <th className="pb-2 font-medium">Prioridade</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Categoria</th>
                      <th className="pb-2 font-medium">Canal</th>
                      <th className="pb-2 font-medium">Criado em</th>
                      <th className="pb-2 font-medium">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((ticket: any) => (
                      <tr
                        key={ticket.id}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedTicketId(ticket.card?.id || null)}
                      >
                        <td className="py-3 pr-4 font-medium">
                          {ticket.card?.title || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant="secondary"
                            className={
                              priorityColors[ticket.card?.priority] || ""
                            }
                          >
                            {priorityLabels[ticket.card?.priority] ||
                              ticket.card?.priority}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          {ticket.resolved_at ? (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            >
                              Resolvido
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Aberto</Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {ticket.category || "—"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground capitalize">
                          {ticket.channel || "—"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString(
                            "pt-BR"
                          )}
                        </td>
                        <td className="py-3">
                          {!ticket.resolved_at && (
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
                    ))}
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
