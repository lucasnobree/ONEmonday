"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitSurveyResponse } from "@/lib/actions/hr/surveys";
import { useSurveyQuestions } from "@/hooks/hr/use-surveys";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SurveyResponseDialogProps {
  surveyId: string | null;
  surveyTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SurveyResponseDialog({
  surveyId,
  surveyTitle,
  open,
  onOpenChange,
}: SurveyResponseDialogProps) {
  const queryClient = useQueryClient();
  const { data: questions } = useSurveyQuestions(open ? surveyId : null);
  const [answers, setAnswers] = useState<
    Record<string, { scoreValue?: number; textValue?: string }>
  >({});

  const mutation = useMutation({
    mutationFn: () =>
      submitSurveyResponse({
        surveyId,
        answers: Object.entries(answers).map(([questionId, a]) => ({
          questionId,
          scoreValue: a.scoreValue,
          textValue: a.textValue,
        })),
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao enviar resposta"
        );
        return;
      }
      toast.success("Resposta enviada. Obrigado!");
      queryClient.invalidateQueries({ queryKey: ["hr-surveys"] });
      queryClient.invalidateQueries({ queryKey: ["hr-survey-results"] });
      setAnswers({});
      onOpenChange(false);
    },
  });

  function setScore(questionId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: { scoreValue: value } }));
  }

  function setText(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { textValue: value } }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{surveyTitle}</DialogTitle>
          <DialogDescription>
            Sua resposta é anônima e não fica vinculada ao seu nome.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-4 max-h-[60vh] overflow-y-auto">
          {(questions ?? []).map((q) => {
            const max = q.question_type === "enps" ? 10 : 5;
            const min = q.question_type === "enps" ? 0 : 1;
            const scale = Array.from(
              { length: max - min + 1 },
              (_, i) => min + i
            );
            return (
              <div key={q.id} className="grid gap-2">
                <Label>{q.prompt}</Label>
                {q.question_type === "text" ? (
                  <Textarea
                    value={answers[q.id]?.textValue ?? ""}
                    onChange={(e) => setText(q.id, e.target.value)}
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {scale.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScore(q.id, n)}
                        className={`h-8 w-8 rounded-md border text-sm transition-colors ${
                          answers[q.id]?.scoreValue === n
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending || Object.keys(answers).length === 0
            }
          >
            {mutation.isPending ? "Enviando..." : "Enviar resposta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
