"use client";

import { Users } from "lucide-react";
import {
  useSequenceEnrollments,
  type Sequence,
} from "@/hooks/marketing/use-sequences";
import {
  SEQUENCE_ENROLLMENT_STATUS_LABELS,
  SEQUENCE_ENROLLMENT_STATUS_VARIANTS,
  type SequenceEnrollmentStatus,
} from "@/lib/marketing/labels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface SequenceEnrollmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: Sequence | undefined;
}

/** Formats an ISO timestamp as a pt-BR date-time, or a dash when absent. */
function formatRunAt(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Read-only view of who is enrolled in a sequence, the step they are on and
 * when they next run — surfacing the data behind `useSequenceEnrollments`
 * instead of leaving it visible only through a transient toast.
 */
export function SequenceEnrollmentsDialog({
  open,
  onOpenChange,
  sequence,
}: SequenceEnrollmentsDialogProps) {
  const { data: enrollments, isLoading } = useSequenceEnrollments(
    open ? sequence?.id : undefined
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inscrições da sequência</DialogTitle>
          <DialogDescription>
            {sequence
              ? `"${sequence.name}" — destinatários e progresso.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : enrollments && enrollments.length > 0 ? (
            <div className="space-y-1">
              <div className="grid grid-cols-[1.5fr_auto_auto_1fr] items-center gap-3 pb-2 text-xs font-medium text-muted-foreground">
                <span>Destinatário</span>
                <span>Passo</span>
                <span>Status</span>
                <span>Próxima execução</span>
              </div>
              <Separator />
              {enrollments.map((e) => (
                <div
                  key={e.id}
                  className="grid grid-cols-[1.5fr_auto_auto_1fr] items-center gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {e.recipient_name ?? e.recipient_email}
                    </p>
                    {e.recipient_name && (
                      <p className="truncate text-xs text-muted-foreground">
                        {e.recipient_email}
                      </p>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    #{e.current_step + 1}
                  </span>
                  <Badge
                    variant={
                      SEQUENCE_ENROLLMENT_STATUS_VARIANTS[
                        e.status as SequenceEnrollmentStatus
                      ]
                    }
                  >
                    {SEQUENCE_ENROLLMENT_STATUS_LABELS[
                      e.status as SequenceEnrollmentStatus
                    ] ?? e.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {e.status === "active" ? formatRunAt(e.next_run_at) : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-center">
              <Users className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhuma inscrição nesta sequência ainda.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
