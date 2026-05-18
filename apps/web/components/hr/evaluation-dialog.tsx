"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertEvaluation } from "@/lib/actions/hr/performance";
import { useEmployees, type Employee } from "@/hooks/hr/use-employees";
import {
  useEvaluationSelfAssessment,
  type Evaluation,
} from "@/hooks/hr/use-performance";
import { nineBoxCell } from "@/lib/hr/performance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

const SCORE_3 = [
  { value: "1", label: "Baixo" },
  { value: "2", label: "Médio" },
  { value: "3", label: "Alto" },
];

interface EvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId: string;
  sectorId: string;
  /** When set, edits this evaluation; otherwise creates a new one. */
  evaluation: Evaluation | null;
}

export function EvaluationDialog({
  open,
  onOpenChange,
  cycleId,
  sectorId,
  evaluation,
}: EvaluationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remount the form per evaluation so useState initialisers reset
            the fields — no setState-in-effect. */}
        <EvaluationForm
          key={evaluation?.id ?? "new"}
          cycleId={cycleId}
          sectorId={sectorId}
          evaluation={evaluation}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface EvaluationFormProps {
  cycleId: string;
  sectorId: string;
  evaluation: Evaluation | null;
  onClose: () => void;
}

function EvaluationForm({
  cycleId,
  sectorId,
  evaluation,
  onClose,
}: EvaluationFormProps) {
  const queryClient = useQueryClient();
  const { data: employees } = useEmployees(sectorId);
  const [employeeId, setEmployeeId] = useState(evaluation?.employee_id ?? "");
  const [performance, setPerformance] = useState(
    evaluation?.performance_score ? String(evaluation.performance_score) : "none"
  );
  const [potential, setPotential] = useState(
    evaluation?.potential_score ? String(evaluation.potential_score) : "none"
  );
  const [rating, setRating] = useState(
    evaluation?.overall_rating ? String(evaluation.overall_rating) : "none"
  );
  const [strengths, setStrengths] = useState(evaluation?.strengths ?? "");
  const [improvements, setImprovements] = useState(
    evaluation?.improvements ?? ""
  );
  const [comments, setComments] = useState(evaluation?.comments ?? "");

  // The employee's own self-assessment for this cycle, shown to the manager
  // as a reference while filling the evaluation (Wave 5).
  const { data: selfAssessment } = useEvaluationSelfAssessment(
    cycleId,
    employeeId || null
  );

  const mutation = useMutation({
    mutationFn: (submit: boolean) =>
      upsertEvaluation({
        cycleId,
        employeeId,
        performanceScore: performance === "none" ? undefined : Number(performance),
        potentialScore: potential === "none" ? undefined : Number(potential),
        overallRating: rating === "none" ? undefined : Number(rating),
        strengths,
        improvements,
        comments,
        submit,
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao salvar avaliação"
        );
        return;
      }
      toast.success("Avaliação salva");
      queryClient.invalidateQueries({ queryKey: ["hr-evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["hr-nine-box"] });
      queryClient.invalidateQueries({ queryKey: ["hr-review-cycles"] });
      onClose();
    },
  });

  const activeEmployees = (employees ?? []).filter(
    (e: Employee) => e.status !== "terminated"
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {evaluation ? "Editar avaliação" : "Nova avaliação"}
        </DialogTitle>
        <DialogDescription>
          Posicione o colaborador nos eixos de desempenho e potencial (9-box).
        </DialogDescription>
      </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Colaborador</Label>
            <Select
              value={employeeId}
              onValueChange={(v) => setEmployeeId(v ?? "")}
              disabled={!!evaluation}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um colaborador">
                  {(value) =>
                    activeEmployees.find((e) => e.id === value)?.full_name ??
                    "Selecione um colaborador"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selfAssessment && <SelfAssessmentSummary assessment={selfAssessment} />}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Desempenho</Label>
              <Select value={performance} onValueChange={(v) => setPerformance(v ?? "none")}>
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
              <Select value={potential} onValueChange={(v) => setPotential(v ?? "none")}>
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
            <Label htmlFor="eval-strengths">Pontos fortes</Label>
            <Textarea
              id="eval-strengths"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eval-improvements">Pontos de melhoria</Label>
            <Textarea
              id="eval-improvements"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eval-comments">Comentários</Label>
            <Textarea
              id="eval-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => mutation.mutate(false)}
            disabled={mutation.isPending || !employeeId}
          >
            Salvar rascunho
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate(true)}
            disabled={mutation.isPending || !employeeId}
          >
            {mutation.isPending ? "Salvando..." : "Concluir avaliação"}
          </Button>
        </DialogFooter>
    </>
  );
}

/**
 * Read-only summary of the employee's own self-assessment, shown inside the
 * manager evaluation form as a reference point.
 */
function SelfAssessmentSummary({
  assessment,
}: {
  assessment: {
    status: string;
    performance_score: number | null;
    potential_score: number | null;
    overall_rating: number | null;
    achievements: string | null;
    challenges: string | null;
    goals: string | null;
  };
}) {
  const cell =
    assessment.performance_score != null && assessment.potential_score != null
      ? nineBoxCell(assessment.performance_score, assessment.potential_score)
      : null;

  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <p className="font-medium">
        Autoavaliação do colaborador
        {assessment.status === "submitted" ? "" : " (rascunho)"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {assessment.overall_rating != null
          ? `Nota geral ${assessment.overall_rating}`
          : "Sem nota geral"}
        {cell ? ` · 9-box: ${cell.label}` : ""}
      </p>
      {assessment.achievements && (
        <p className="mt-2 text-xs">
          <span className="font-medium">Realizações: </span>
          {assessment.achievements}
        </p>
      )}
      {assessment.challenges && (
        <p className="mt-1 text-xs">
          <span className="font-medium">Desafios: </span>
          {assessment.challenges}
        </p>
      )}
      {assessment.goals && (
        <p className="mt-1 text-xs">
          <span className="font-medium">Objetivos: </span>
          {assessment.goals}
        </p>
      )}
    </div>
  );
}
