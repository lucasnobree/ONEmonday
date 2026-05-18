"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useJobOpenings, type JobOpening } from "@/hooks/hr/use-job-openings";
import { JobOpeningFormDialog } from "@/components/hr/job-opening-form-dialog";
import { RecruitmentBoardSheet } from "@/components/hr/recruitment-board-sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default function RecruitmentPage() {
  const { currentSector } = useCurrentSector();
  const { data: openings, isLoading } = useJobOpenings(currentSector?.id);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedOpeningTitle, setSelectedOpeningTitle] = useState("");

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver as vagas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
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
          ) : !openings || openings.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Nenhuma vaga aberta"
              description="Crie sua primeira vaga para começar o processo de recrutamento."
              action={<JobOpeningFormDialog />}
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
                  </tr>
                </thead>
                <tbody>
                  {openings.map((opening: JobOpening) => {
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
