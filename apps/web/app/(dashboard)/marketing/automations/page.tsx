"use client";

import { useState } from "react";
import { Plus, Workflow, Play, ListOrdered, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useSequences,
  useDeleteSequence,
  useRunSequenceSteps,
  type Sequence,
} from "@/hooks/marketing/use-sequences";
import { SequenceFormDialog } from "@/components/marketing/sequence-form-dialog";
import { SequenceStepsDialog } from "@/components/marketing/sequence-steps-dialog";
import { SequenceEnrollDialog } from "@/components/marketing/sequence-enroll-dialog";
import { SequenceEnrollmentsDialog } from "@/components/marketing/sequence-enrollments-dialog";
import { MarketingError } from "@/components/marketing/marketing-error";
import {
  SEQUENCE_STATUS_LABELS,
  SEQUENCE_STATUS_VARIANTS,
  SEQUENCE_TRIGGER_LABELS,
} from "@/lib/marketing/labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export default function MarketingAutomationsPage() {
  const { currentSector } = useCurrentSector();
  const {
    data: sequences,
    isLoading,
    isError,
    refetch,
  } = useSequences(currentSector?.id);
  const deleteSequence = useDeleteSequence();
  const runSteps = useRunSequenceSteps();

  const [formOpen, setFormOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollmentsOpen, setEnrollmentsOpen] = useState(false);
  const [editing, setEditing] = useState<Sequence>();
  const [active, setActive] = useState<Sequence>();

  if (!currentSector) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um setor no menu lateral para ver as automações.
      </p>
    );
  }

  const handleDelete = async (id: string) => {
    const result = await deleteSequence.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Sequência excluída");
  };

  const handleRun = async () => {
    const result = await runSteps.mutateAsync();
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao processar"
      );
      return;
    }
    toast.success(
      `Processadas ${result.processed ?? 0} inscrições · ${result.emailsSent ?? 0} e-mail(s) · ${result.completed ?? 0} concluída(s)`
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Automações</h2>
          <p className="text-xs text-muted-foreground">
            Sequências gatilho → passo (esperar / enviar e-mail).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRun}
            disabled={runSteps.isPending}
          >
            <Play className="mr-1 h-4 w-4" />
            {runSteps.isPending ? "Processando..." : "Processar agora"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Nova Sequência
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <MarketingError subject="as automações" onRetry={() => refetch()} />
      ) : sequences && sequences.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {sequences.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Gatilho: {SEQUENCE_TRIGGER_LABELS[s.trigger_type]}
                  </p>
                </div>
                <Badge variant={SEQUENCE_STATUS_VARIANTS[s.status]}>
                  {SEQUENCE_STATUS_LABELS[s.status]}
                </Badge>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActive(s);
                      setStepsOpen(true);
                    }}
                  >
                    <ListOrdered className="mr-1 h-3.5 w-3.5" />
                    Passos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActive(s);
                      setEnrollOpen(true);
                    }}
                  >
                    <UserPlus className="mr-1 h-3.5 w-3.5" />
                    Inscrever
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActive(s);
                      setEnrollmentsOpen(true);
                    }}
                  >
                    <Users className="mr-1 h-3.5 w-3.5" />
                    Inscrições
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(s);
                      setFormOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <ConfirmDialog
                    title="Excluir sequência"
                    description={`Excluir a sequência "${s.name}"? Esta ação não pode ser desfeita.`}
                    onConfirm={() => handleDelete(s.id)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      disabled={deleteSequence.isPending}
                    >
                      Excluir
                    </Button>
                  </ConfirmDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Workflow className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma sequência de automação ainda. Crie a primeira para nutrir
            leads automaticamente.
          </p>
        </div>
      )}

      <SequenceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        sectorId={currentSector.id}
        sequence={editing}
      />
      <SequenceStepsDialog
        open={stepsOpen}
        onOpenChange={setStepsOpen}
        sequence={active}
      />
      <SequenceEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        sequence={active}
      />
      <SequenceEnrollmentsDialog
        open={enrollmentsOpen}
        onOpenChange={setEnrollmentsOpen}
        sequence={active}
      />
    </div>
  );
}
