"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useMatters, type Matter } from "@/hooks/legal/use-matters";
import { MatterFormDialog } from "@/components/legal/matter-form-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { Gavel } from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Matter | null>(null);

  const filtered = useMemo(() => {
    return (matters ?? []).filter((m: Matter) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      return true;
    });
  }, [matters, statusFilter]);

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
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "all")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
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
        <MatterFormDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Demandas Juridicas ({filtered.length})
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
              description="Registre a primeira solicitacao para o time juridico."
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
                    <th className="pb-2 font-medium">Titulo</th>
                    <th className="pb-2 font-medium">Tipo</th>
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
                        onClick={() => setEditing(matter)}
                      >
                        <td className="py-2 font-medium">{matter.title}</td>
                        <td className="py-2">
                          {MATTER_TYPE_LABELS[matter.matter_type] ??
                            matter.matter_type}
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

      {editing && (
        <MatterFormDialog
          key={editing.id}
          matter={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          hideTrigger
        />
      )}
    </div>
  );
}
