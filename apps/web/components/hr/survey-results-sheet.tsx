"use client";

import { useSurveyResults } from "@/hooks/hr/use-surveys";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface SurveyResultsSheetProps {
  surveyId: string | null;
  surveyTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function enpsTone(enps: number): string {
  if (enps >= 50) return "text-green-600";
  if (enps >= 0) return "text-amber-600";
  return "text-red-600";
}

export function SurveyResultsSheet({
  surveyId,
  surveyTitle,
  open,
  onOpenChange,
}: SurveyResultsSheetProps) {
  const { data, isLoading } = useSurveyResults(open ? surveyId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{surveyTitle}</SheetTitle>
          <SheetDescription>Resultados agregados (anônimos)</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4">
          {isLoading ? (
            <div className="h-40 rounded bg-muted animate-pulse" />
          ) : !data ? (
            <p className="text-sm text-muted-foreground">
              Nenhum resultado disponível.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Respostas</p>
                  <p className="text-2xl font-bold">{data.response_count}</p>
                </div>
                {data.enps != null && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">eNPS</p>
                    <p
                      className={`text-2xl font-bold ${enpsTone(data.enps)}`}
                    >
                      {data.enps > 0 ? "+" : ""}
                      {data.enps}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {data.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Esta pesquisa não possui perguntas.
                  </p>
                ) : (
                  data.questions.map((q) => (
                    <div key={q.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{q.prompt}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {q.question_type === "text"
                          ? `${q.answer_count} comentário(s)`
                          : `${q.answer_count} resposta(s)` +
                            (q.average_score != null
                              ? ` · média ${q.average_score}`
                              : "")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
