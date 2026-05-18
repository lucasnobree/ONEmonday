"use client";

import { useMemo, useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useJobOpenings, type JobOpening } from "@/hooks/hr/use-job-openings";
import { JobOpeningFormDialog } from "@/components/hr/job-opening-form-dialog";
import { JobOpeningStatusMenu } from "@/components/hr/job-opening-status-menu";
import { RecruitmentBoardSheet } from "@/components/hr/recruitment-board-sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Aberta", variant: "default" },
  closed: { label: "Fechada", variant: "secondary" },
  filled: { label: "Preenchida", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  full_time: "CLT",
  part_time: "Meio período",
  contractor: "PJ",
  intern: "Estagiário",
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: "Todos os status",
  open: "Abertas",
  closed: "Fechadas",
  filled: "Preenchidas",
  cancelled: "Canceladas",
};

export default function RecruitmentPage() {
  const { currentSector } = useCurrentSector();
  const { data: openings, isLoading } = useJobOpenings(currentSector?.id);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedOpeningTitle, setSelectedOpeningTitle] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredOpenings = useMemo(() => {
    if (!openings) return [];
    if (statusFilter === "all") return openings;
    return openings.filter((o) => o.status === statusFilter);
  }, [openings, statusFilter]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver as vagas.
      </p>
    );
  }

  const hasOpenings = !!openings && openings.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              {(value) =>
                STATUS_FILTER_LABELS[value as string] ?? "Todos os status"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <JobOpeningFormDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vagas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          ) : !hasOpenings ? (
            <EmptyState
              icon={Briefcase}
              title="Nenhuma vaga aberta"
              description="Crie sua primeira vaga para começar o processo de recrutamento."
              action={<JobOpeningFormDialog />}
            />
          ) : filteredOpenings.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Nenhuma vaga com esse status"
              description="Ajuste o filtro de status para ver outras vagas."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Título</th>
                    <th className="pb-2 font-medium">Departamento</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Localização</th>
                    <th className="pb-2 font-medium">Candidatos</th>
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpenings.map((opening: JobOpening) => {
                    const statusInfo = STATUS_MAP[opening.status] ?? {
                      label: opening.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <tr
                        key={opening.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedOpeningId(opening.id);
                          setSelectedOpeningTitle(opening.title);
                        }}
                      >
                        <td className="py-2 font-medium">{opening.title}</td>
                        <td className="py-2">{opening.department ?? "-"}</td>
                        <td className="py-2">
                          {EMPLOYMENT_TYPE_MAP[opening.employment_type] ??
                            opening.employment_type}
                        </td>
                        <td className="py-2">{opening.location ?? "-"}</td>
                        <td className="py-2">{opening.candidates_count}</td>
                        <td className="py-2">
                          {dateFormat.format(new Date(opening.created_at))}
                        </td>
                        <td className="py-2">
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td
                          className="py-2 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <JobOpeningStatusMenu opening={opening} />
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

      <RecruitmentBoardSheet
        openingId={selectedOpeningId}
        openingTitle={selectedOpeningTitle}
        sectorId={currentSector.id}
        open={!!selectedOpeningId}
        onOpenChange={(open) => {
          if (!open) setSelectedOpeningId(null);
        }}
      />
    </div>
  );
}
