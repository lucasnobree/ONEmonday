"use client";

import {
  useRecruitmentBoard,
  type RecruitmentCandidate,
  type RecruitmentColumn,
} from "@/hooks/hr/use-recruitment-detail";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, StickyNote, Users } from "lucide-react";

interface RecruitmentBoardSheetProps {
  openingId: string | null;
  openingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecruitmentBoardSheet({
  openingId,
  openingTitle,
  open,
  onOpenChange,
}: RecruitmentBoardSheetProps) {
  const { data, isLoading } = useRecruitmentBoard(open ? openingId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{openingTitle}</SheetTitle>
          <SheetDescription className="sr-only">
            Quadro de recrutamento da vaga {openingTitle}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          {isLoading ? (
            <LoadingSkeleton />
          ) : !data ? (
            <EmptyBoard />
          ) : (
            <ColumnsView columns={data.columns} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="min-w-[220px] space-y-2">
          <div className="h-6 w-28 rounded bg-muted animate-pulse" />
          <div className="h-24 rounded bg-muted animate-pulse" />
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
      <p className="text-sm font-medium">Nenhum quadro configurado</p>
      <p className="text-xs text-muted-foreground mt-1">
        Nenhum quadro de recrutamento configurado para esta vaga.
      </p>
    </div>
  );
}

function ColumnsView({ columns }: { columns: RecruitmentColumn[] }) {
  if (columns.length === 0) {
    return <EmptyBoard />;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={col.id}
          className="min-w-[220px] max-w-[260px] flex-shrink-0 rounded-lg border bg-muted/30 p-3"
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: col.color ?? "#6b7280" }}
            />
            <span className="text-sm font-medium truncate">{col.name}</span>
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
                <CandidateCard key={candidate.id} candidate={candidate} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: RecruitmentCandidate }) {
  return (
    <div className="rounded-md border bg-background p-2.5 space-y-1.5">
      <p className="text-sm font-medium leading-tight">{candidate.full_name}</p>

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

      {candidate.notes && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <StickyNote className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2">{candidate.notes}</span>
        </div>
      )}
    </div>
  );
}
