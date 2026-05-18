"use client";

import { useState } from "react";
import {
  useRecruitmentBoard,
  STAGE_LABELS,
  type RecruitmentCandidate,
} from "@/hooks/hr/use-recruitment-detail";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Star, Users } from "lucide-react";
import { AddCandidateDialog } from "@/components/hr/add-candidate-dialog";
import { CandidateDetailSheet } from "@/components/hr/candidate-detail-sheet";

interface RecruitmentBoardSheetProps {
  openingId: string | null;
  openingTitle: string;
  sectorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecruitmentBoardSheet({
  openingId,
  openingTitle,
  sectorId,
  open,
  onOpenChange,
}: RecruitmentBoardSheetProps) {
  const { data, isLoading } = useRecruitmentBoard(open ? openingId : null);
  const [selectedCandidate, setSelectedCandidate] =
    useState<RecruitmentCandidate | null>(null);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{openingTitle}</SheetTitle>
            <SheetDescription className="sr-only">
              Pipeline de recrutamento da vaga {openingTitle}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {data ? `${data.total} candidato(s)` : ""}
              </p>
              {openingId && (
                <AddCandidateDialog
                  jobOpeningId={openingId}
                  sectorId={sectorId}
                />
              )}
            </div>

            {isLoading ? (
              <LoadingSkeleton />
            ) : !data || data.total === 0 ? (
              <EmptyBoard />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {data.columns.map((col) => (
                  <div
                    key={col.stage}
                    className="min-w-[220px] max-w-[260px] flex-shrink-0 rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium truncate">
                        {col.label}
                      </span>
                      <Badge variant="secondary" className="ml-auto">
                        {col.candidates.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {col.candidates.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhum candidato
                        </p>
                      ) : (
                        col.candidates.map((candidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onClick={() => setSelectedCandidate(candidate)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CandidateDetailSheet
        candidate={selectedCandidate}
        open={!!selectedCandidate}
        onOpenChange={(o) => {
          if (!o) setSelectedCandidate(null);
        }}
      />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="min-w-[220px] space-y-2">
          <div className="h-6 w-28 rounded bg-muted animate-pulse" />
          <div className="h-24 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyBoard() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="h-10 w-10 text-muted-foreground/50 mb-2" />
      <p className="text-sm font-medium">Nenhum candidato</p>
      <p className="text-xs text-muted-foreground mt-1">
        Adicione o primeiro candidato para iniciar o processo seletivo.
      </p>
    </div>
  );
}

function CandidateCard({
  candidate,
  onClick,
}: {
  candidate: RecruitmentCandidate;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md border bg-background p-2.5 space-y-1.5 hover:border-primary/50 transition-colors"
    >
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
          <Mail className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{candidate.email}</span>
        </div>
      )}
      {candidate.phone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <span>{candidate.phone}</span>
        </div>
      )}
      <Badge variant="outline" className="text-[10px]">
        {STAGE_LABELS[candidate.stage] ?? candidate.stage}
      </Badge>
    </button>
  );
}
