"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useSurveys, type Survey } from "@/hooks/hr/use-surveys";
import { updateSurveyStatus } from "@/lib/actions/hr/surveys";
import { SurveyFormDialog } from "@/components/hr/survey-form-dialog";
import { SurveyResultsSheet } from "@/components/hr/survey-results-sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { MessageSquareHeart } from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { label: "Rascunho", variant: "outline" },
  open: { label: "Aberta", variant: "default" },
  closed: { label: "Encerrada", variant: "secondary" },
};

export default function SurveysPage() {
  const { currentSector } = useCurrentSector();
  const queryClient = useQueryClient();
  const { data: surveys, isLoading } = useSurveys(currentSector?.id);
  const [resultsFor, setResultsFor] = useState<Survey | null>(null);

  const statusMutation = useMutation({
    mutationFn: (vars: { surveyId: string; status: "open" | "closed" }) =>
      updateSurveyStatus(vars),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao atualizar pesquisa"
        );
        return;
      }
      toast.success("Pesquisa atualizada");
      queryClient.invalidateQueries({ queryKey: ["hr-surveys"] });
    },
  });

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para gerenciar pesquisas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <SurveyFormDialog sectorId={currentSector.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesquisas de clima</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : !surveys || surveys.length === 0 ? (
            <EmptyState
              icon={MessageSquareHeart}
              title="Nenhuma pesquisa criada"
              description="Crie pesquisas de clima e eNPS para medir o engajamento da equipe."
              action={<SurveyFormDialog sectorId={currentSector.id} />}
            />
          ) : (
            <div className="space-y-2">
              {surveys.map((survey) => {
                const status = STATUS_MAP[survey.status] ?? STATUS_MAP.draft;
                return (
                  <div
                    key={survey.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {survey.title}
                        </span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {survey.survey_type === "enps" && (
                          <Badge variant="outline">eNPS</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {survey.question_count} pergunta(s) ·{" "}
                        {survey.response_count} resposta(s)
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {survey.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <Link
                              href={`/hr/surveys/${survey.id}/responder`}
                            />
                          }
                        >
                          Responder
                        </Button>
                      )}
                      {survey.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            statusMutation.mutate({
                              surveyId: survey.id,
                              status: "open",
                            })
                          }
                          disabled={statusMutation.isPending}
                        >
                          Abrir
                        </Button>
                      )}
                      {survey.status === "open" && (
                        <ConfirmDialog
                          title="Encerrar pesquisa"
                          description="Tem certeza que deseja encerrar esta pesquisa? Ela não poderá mais receber respostas e não será possível reabri-la."
                          onConfirm={async () => {
                            await statusMutation.mutateAsync({
                              surveyId: survey.id,
                              status: "closed",
                            });
                          }}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={statusMutation.isPending}
                          >
                            Encerrar
                          </Button>
                        </ConfirmDialog>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setResultsFor(survey)}
                      >
                        Resultados
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SurveyResultsSheet
        surveyId={resultsFor?.id ?? null}
        surveyTitle={resultsFor?.title ?? ""}
        open={!!resultsFor}
        onOpenChange={(o) => {
          if (!o) setResultsFor(null);
        }}
      />
    </div>
  );
}
