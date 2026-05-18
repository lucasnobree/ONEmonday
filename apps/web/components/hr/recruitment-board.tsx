"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useRecruitmentBoard,
  STAGE_LABELS,
  type RecruitmentCandidate,
  type RecruitmentBoardData,
} from "@/hooks/hr/use-recruitment-detail";
import { moveCandidate } from "@/lib/actions/hr/candidates";
import { AddCandidateDialog } from "@/components/hr/add-candidate-dialog";
import { CandidateDetailSheet } from "@/components/hr/candidate-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, Star, Users } from "lucide-react";
import { toast } from "sonner";

interface RecruitmentBoardProps {
  openingId: string;
  openingTitle: string;
  sectorId: string;
}

/**
 * Full-page recruitment pipeline kanban with drag-and-drop stage moves. A
 * candidate card can be dragged directly between stage columns, replacing the
 * nested-sheet → candidate-sheet → stage-Select click path the Wave 4 audit
 * flagged. The detail sheet (notes / scorecard) is still reachable on click.
 */
export function RecruitmentBoard({
  openingId,
  openingTitle,
  sectorId,
}: RecruitmentBoardProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useRecruitmentBoard(openingId);
  const [selectedCandidate, setSelectedCandidate] =
    useState<RecruitmentCandidate | null>(null);
  const [activeCandidate, setActiveCandidate] =
    useState<RecruitmentCandidate | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const moveMutation = useMutation({
    mutationFn: (vars: { candidateId: string; stage: string }) =>
      moveCandidate(vars),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao mover candidato"
        );
        queryClient.invalidateQueries({ queryKey: ["hr-recruitment-board"] });
        return;
      }
      toast.success("Estágio atualizado");
    },
  });

  function findCandidate(id: string): RecruitmentCandidate | null {
    if (!data) return null;
    for (const col of data.columns) {
      const found = col.candidates.find((c) => c.id === id);
      if (found) return found;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCandidate(findCandidate(event.active.id as string));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCandidate(null);
    if (!over || !data) return;

    const candidateId = active.id as string;
    const targetStage = over.id as string;
    const candidate = findCandidate(candidateId);
    // A drop onto the candidate's current column is a no-op.
    if (!candidate || candidate.stage === targetStage) return;

    // Optimistic move so the card jumps columns immediately.
    queryClient.setQueryData(
      ["hr-recruitment-board", openingId],
      (old: RecruitmentBoardData | null | undefined) => {
        if (!old) return old;
        return {
          ...old,
          columns: old.columns.map((col) => {
            if (col.stage === candidate.stage) {
              return {
                ...col,
                candidates: col.candidates.filter(
                  (c) => c.id !== candidateId
                ),
              };
            }
            if (col.stage === targetStage) {
              return {
                ...col,
                candidates: [
                  { ...candidate, stage: targetStage },
                  ...col.candidates,
                ],
              };
            }
            return col;
          }),
        };
      }
    );

    moveMutation.mutate({ candidateId, stage: targetStage });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Voltar para vagas"
            render={<Link href="/hr/recruitment" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{openingTitle}</h2>
            <p className="text-xs text-muted-foreground">
              {data ? `${data.total} candidato(s)` : ""}
            </p>
          </div>
        </div>
        <AddCandidateDialog jobOpeningId={openingId} sectorId={sectorId} />
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[220px] space-y-2">
              <div className="h-6 w-28 rounded bg-muted animate-pulse" />
              <div className="h-24 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : !data || data.total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium">Nenhum candidato</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione o primeiro candidato para iniciar o processo seletivo.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.columns.map((col) => (
              <StageColumn
                key={col.stage}
                stage={col.stage}
                label={col.label}
                candidates={col.candidates}
                onCandidateClick={setSelectedCandidate}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeCandidate ? (
              <div className="rotate-2 scale-105 shadow-xl">
                <CandidateCardView candidate={activeCandidate} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <CandidateDetailSheet
        candidate={selectedCandidate}
        open={!!selectedCandidate}
        onOpenChange={(o) => {
          if (!o) setSelectedCandidate(null);
        }}
      />
    </div>
  );
}

function StageColumn({
  stage,
  label,
  candidates,
  onCandidateClick,
}: {
  stage: string;
  label: string;
  candidates: RecruitmentCandidate[];
  onCandidateClick: (candidate: RecruitmentCandidate) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-w-[240px] max-w-[280px] flex-shrink-0 rounded-lg border bg-muted/30 p-3 transition-colors",
        isOver && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium truncate">{label}</span>
        <Badge variant="secondary" className="ml-auto">
          {candidates.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum candidato
          </p>
        ) : (
          candidates.map((candidate) => (
            <DraggableCandidate
              key={candidate.id}
              candidate={candidate}
              onClick={() => onCandidateClick(candidate)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCandidate({
  candidate,
  onClick,
}: {
  candidate: RecruitmentCandidate;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: candidate.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <CandidateCardView candidate={candidate} />
    </div>
  );
}

function CandidateCardView({
  candidate,
}: {
  candidate: RecruitmentCandidate;
}) {
  return (
    <div className="rounded-md border bg-background p-2.5 space-y-1.5 hover:border-primary/50 transition-colors">
      <div className="flex items-center justify-between gap-1">
        <p className="text-sm font-medium leading-tight">
          {candidate.full_name}
        </p>
        {candidate.rating != null && (
          <span className="flex items-center gap-0.5 text-xs text-amber-600">
            <Star className="h-3 w-3 fill-current" />
            {candidate.rating}
          </span>
        )}
      </div>
      {candidate.email && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{candidate.email}</span>
        </div>
      )}
      {candidate.phone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          <span>{candidate.phone}</span>
        </div>
      )}
      <Badge variant="outline" className="text-[10px]">
        {STAGE_LABELS[candidate.stage] ?? candidate.stage}
      </Badge>
    </div>
  );
}
