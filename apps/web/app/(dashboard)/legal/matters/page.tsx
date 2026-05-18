"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useMatters, type Matter } from "@/hooks/legal/use-matters";
import { useSectorMembers } from "@/hooks/legal/use-sector-members";
import { MatterFormDialog } from "@/components/legal/matter-form-dialog";
import { MatterDetailSheet } from "@/components/legal/matter-detail-sheet";
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
import { Gavel, Search } from "lucide-react";
import { MATTER_STATUSES } from "@/lib/validations/legal";
import {
  MATTER_STATUS_LABELS,
  MATTER_TYPE_LABELS,
  MATTER_PRIORITY_LABELS,
} from "@/lib/legal/labels";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

export default function MattersPage() {
  const { currentSector } = useCurrentSector();
  const { data: matters, isLoading } = useMatters(currentSector?.id);
  const { data: members } = useSectorMembers(currentSector?.id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Matter | null>(null);

  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members ?? []) map.set(m.id, m.full_name);
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (matters ?? []).filter((m: Matter) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (term) {
        const haystack = [m.title, m.description ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [matters, statusFilter, search]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver as demandas.
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
              placeholder="Buscar por título ou descrição"
              className="w-64 pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? "all")}
          >
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue placeholder="Status">
                {(value: string) =>
                  value === "all"
                    ? "Todos os status"
                    : (MATTER_STATUS_LABELS[value]?.label ?? value)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {MATTER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {MATTER_STATUS_LABELS[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <MatterFormDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Demandas Jurídicas ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          ) : !(matters ?? []).length ? (
            <EmptyState
              icon={Gavel}
              title="Nenhuma demanda registrada"
              description="Registre a primeira solicitação para o time jurídico."
              action={<MatterFormDialog />}
            />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma demanda encontrada com os filtros selecionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Título</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Responsável</th>
                    <th className="pb-2 font-medium">Prioridade</th>
                    <th className="pb-2 font-medium">Prazo</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((matter: Matter) => {
                    const statusInfo =
                      MATTER_STATUS_LABELS[matter.status] ?? {
                        label: matter.status,
                        variant: "secondary" as const,
                      };
                    const priorityInfo =
                      MATTER_PRIORITY_LABELS[matter.priority] ?? {
                        label: matter.priority,
                        variant: "secondary" as const,
                      };
                    return (
                      <tr
                        key={matter.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelected(matter)}
                      >
                        <td className="py-2 font-medium">{matter.title}</td>
                        <td className="py-2">
                          {MATTER_TYPE_LABELS[matter.matter_type] ??
                            matter.matter_type}
                        </td>
                        <td className="py-2">
                          {matter.assigned_to
                            ? (memberNames.get(matter.assigned_to) ?? "-")
                            : "-"}
                        </td>
                        <td className="py-2">
                          <Badge variant={priorityInfo.variant}>
                            {priorityInfo.label}
                          </Badge>
                        </td>
                        <td className="py-2">
                          {matter.due_date
                            ? dateFormat.format(new Date(matter.due_date))
                            : "-"}
                        </td>
                        <td className="py-2">
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
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

      <MatterDetailSheet
        matter={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
