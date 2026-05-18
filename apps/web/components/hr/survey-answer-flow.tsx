"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useSurveyForRespondent,
  useSurveyEmployee,
} from "@/hooks/hr/use-surveys";
import { submitSurveyResponse } from "@/lib/actions/hr/surveys";
import {
  SCORE_SCALE,
  ENPS_SCALE,
  canSubmitSurvey,
  buildAnswerPayload,
  type DraftAnswer,
} from "@/lib/hr/survey-answering";
import { SurveyScaleInput } from "@/components/hr/survey-scale-input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { CheckCircle2, MessageSquareHeart, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface SurveyAnswerFlowProps {
  surveyId: string;
}

/**
 * Employee-facing flow for answering an active climate / engagement survey.
 * Reachable only through a per-survey link — never from the admin list — so the
 * anonymity promise is credible. Submission goes through a one-response-per-
 * employee guard that records participation without linking to the answers.
 */
export function SurveyAnswerFlow({ surveyId }: SurveyAnswerFlowProps) {
  const queryClient = useQueryClient();
  const { data: surveyData, isLoading: surveyLoading } =
    useSurveyForRespondent(surveyId);
  const { data: employeeCtx, isLoading: employeeLoading } =
    useSurveyEmployee(surveyId);

  const [drafts, setDrafts] = useState<Record<string, DraftAnswer>>({});
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const answers = buildAnswerPayload(
        surveyData?.questions ?? [],
        drafts
      );
      return submitSurveyResponse({
        surveyId,
        employeeId: employeeCtx?.employee_id,
        answers,
      });
    },
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
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["hr-survey-employee"] });
      queryClient.invalidateQueries({ queryKey: ["hr-survey-participation"] });
    },
  });

  if (surveyLoading || employeeLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="h-24 rounded bg-muted animate-pulse" />
        <div className="h-40 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!surveyData) {
    return (
      <EmptyState
        icon={MessageSquareHeart}
        title="Pesquisa não encontrada"
        description="A pesquisa que você procura não existe ou não está mais disponível."
      />
    );
  }

  const { survey, questions } = surveyData;

  if (survey.status !== "open") {
    return (
      <EmptyState
        icon={MessageSquareHeart}
        title="Pesquisa indisponível"
        description="Esta pesquisa não está aberta para respostas no momento."
      />
    );
  }

  if (!employeeCtx?.found) {
    return (
      <EmptyState
        icon={MessageSquareHeart}
        title="Você não pode responder esta pesquisa"
        description="Apenas colaboradores ativos do setor da pesquisa podem respondê-la."
      />
    );
  }

  if (submitted || employeeCtx.already_responded) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Resposta registrada"
        description="Você já respondeu esta pesquisa. Sua resposta é anônima e foi registrada com sucesso."
        action={
          <Button variant="outline" render={<Link href="/hr/surveys" />}>
            Voltar para pesquisas
          </Button>
        }
      />
    );
  }

  const ready = canSubmitSurvey(questions, drafts);

  function setScore(questionId: string, value: number) {
    setDrafts((prev) => ({
      ...prev,
      [questionId]: { questionId, scoreValue: value },
    }));
  }

  function setText(questionId: string, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [questionId]: { questionId, textValue: value },
    }));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{survey.title}</h2>
        {survey.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {survey.description}
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
        <p className="text-muted-foreground">
          Sua resposta é <strong>anônima</strong>. Registramos apenas que você
          participou, sem vincular sua identidade às respostas.
        </p>
      </div>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Esta pesquisa não possui perguntas.
          </CardContent>
        </Card>
      ) : (
        questions.map((q, index) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-sm font-medium leading-relaxed">
                {index + 1}. {q.prompt}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {q.question_type === "text" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor={`q-${q.id}`} className="sr-only">
                    Resposta para: {q.prompt}
                  </Label>
                  <Textarea
                    id={`q-${q.id}`}
                    value={drafts[q.id]?.textValue ?? ""}
                    onChange={(e) => setText(q.id, e.target.value)}
                    placeholder="Escreva seu comentário (opcional)"
                  />
                </div>
              ) : (
                <SurveyScaleInput
                  label={`Resposta para: ${q.prompt}`}
                  scale={q.question_type === "enps" ? ENPS_SCALE : SCORE_SCALE}
                  value={drafts[q.id]?.scoreValue}
                  onChange={(v) => setScore(q.id, v)}
                />
              )}
            </CardContent>
          </Card>
        ))
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" render={<Link href="/hr/surveys" />}>
          Cancelar
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!ready || mutation.isPending}
        >
          {mutation.isPending ? "Enviando..." : "Enviar resposta"}
        </Button>
      </div>
    </div>
  );
}
