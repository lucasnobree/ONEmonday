"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useSelfAssessmentContext,
  type SelfAssessment,
} from "@/hooks/hr/use-performance";
import { upsertSelfAssessment } from "@/lib/actions/hr/performance";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { Target } from "lucide-react";
import { toast } from "sonner";

const SCORE_3 = [
  { value: "1", label: "Baixo" },
  { value: "2", label: "Médio" },
  { value: "3", label: "Alto" },
];

interface SelfAssessmentFlowProps {
  cycleId: string;
}

/**
 * Employee-facing self-assessment for a performance review cycle. Lets the
 * employee reflect on the same 9-box axes (desempenho / potencial / nota geral)
 * before the manager review, giving them a voice in an otherwise top-down
 * process.
 */
export function SelfAssessmentFlow({ cycleId }: SelfAssessmentFlowProps) {
  const { data, isLoading } = useSelfAssessmentContext(cycleId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="h-20 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!data?.found || !data.cycle) {
    return (
      <EmptyState
        icon={Target}
        title="Autoavaliação indisponível"
        description="O ciclo não existe ou você não é um colaborador ativo deste setor."
      />
    );
  }

  if (data.cycle.status !== "active") {
    return (
      <EmptyState
        icon={Target}
        title="Ciclo não está ativo"
        description="A autoavaliação só pode ser preenchida enquanto o ciclo de avaliação está ativo."
        action={
          <Button variant="outline" render={<Link href="/hr/performance" />}>
            Voltar para desempenho
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          Autoavaliação — {data.cycle.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reflita sobre seu desempenho neste ciclo. Suas respostas ficam
          visíveis para o seu gestor durante a avaliação.
        </p>
      </div>

      {/* Remount per assessment so useState initialisers reset the fields. */}
      <SelfAssessmentForm
        key={data.assessment?.id ?? "new"}
        cycleId={cycleId}
        assessment={data.assessment ?? null}
      />
    </div>
  );
}

interface SelfAssessmentFormProps {
  cycleId: string;
  assessment: SelfAssessment | null;
}

function SelfAssessmentForm({ cycleId, assessment }: SelfAssessmentFormProps) {
  const queryClient = useQueryClient();
  const [performance, setPerformance] = useState(
    assessment?.performance_score
      ? String(assessment.performance_score)
      : "none"
  );
  const [potential, setPotential] = useState(
    assessment?.potential_score ? String(assessment.potential_score) : "none"
  );
  const [rating, setRating] = useState(
    assessment?.overall_rating ? String(assessment.overall_rating) : "none"
  );
  const [achievements, setAchievements] = useState(
    assessment?.achievements ?? ""
  );
  const [challenges, setChallenges] = useState(assessment?.challenges ?? "");
  const [goals, setGoals] = useState(assessment?.goals ?? "");

  const submitted = assessment?.status === "submitted";

  const mutation = useMutation({
    mutationFn: (submit: boolean) =>
      upsertSelfAssessment({
        cycleId,
        performanceScore:
          performance === "none" ? undefined : Number(performance),
        potentialScore: potential === "none" ? undefined : Number(potential),
        overallRating: rating === "none" ? undefined : Number(rating),
        achievements,
        challenges,
        goals,
        submit,
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao salvar autoavaliação"
        );
        return;
      }
      toast.success("Autoavaliação salva");
      queryClient.invalidateQueries({ queryKey: ["hr-self-assessment"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {submitted ? "Autoavaliação enviada" : "Sua autoavaliação"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {submitted && (
          <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
            Você já enviou sua autoavaliação. Ainda é possível atualizá-la
            enquanto o ciclo estiver ativo.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label>Desempenho</Label>
            <Select
              value={performance}
              onValueChange={(v) => setPerformance(v ?? "none")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) =>
                    value === "none"
                      ? "—"
                      : (SCORE_3.find((s) => s.value === value)?.label ?? "—")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {SCORE_3.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Potencial</Label>
            <Select
              value={potential}
              onValueChange={(v) => setPotential(v ?? "none")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) =>
                    value === "none"
                      ? "—"
                      : (SCORE_3.find((s) => s.value === value)?.label ?? "—")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {SCORE_3.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Nota geral</Label>
            <Select value={rating} onValueChange={(v) => setRating(v ?? "none")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => (value === "none" ? "—" : String(value))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sa-achievements">Principais realizações</Label>
          <Textarea
            id="sa-achievements"
            value={achievements}
            onChange={(e) => setAchievements(e.target.value)}
            placeholder="O que você entregou ou conquistou neste ciclo?"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sa-challenges">Desafios e dificuldades</Label>
          <Textarea
            id="sa-challenges"
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            placeholder="Quais obstáculos você enfrentou?"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sa-goals">Objetivos de desenvolvimento</Label>
          <Textarea
            id="sa-goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="Onde você quer crescer no próximo ciclo?"
          />
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="ghost" render={<Link href="/hr/performance" />}>
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => mutation.mutate(false)}
              disabled={mutation.isPending}
            >
              Salvar rascunho
            </Button>
            <Button
              type="button"
              onClick={() => mutation.mutate(true)}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Salvando..." : "Enviar autoavaliação"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
