"use client";

import { useStatusHistory } from "@/hooks/legal/use-status-history";
import { useSectorMembers } from "@/hooks/legal/use-sector-members";
import { describeTransition } from "@/lib/legal/status-history";
import { formatDateTime } from "@/lib/legal/dates";
import { History } from "lucide-react";

interface StatusHistoryTimelineProps {
  entityType: "contract" | "matter";
  entityId: string;
  sectorId: string;
}

/**
 * Read-only who/when/from->to status-change timeline (Wave 4 audit C1/C4).
 * Shown on the contract and matter detail sheets. Oldest entry first.
 */
export function StatusHistoryTimeline({
  entityType,
  entityId,
  sectorId,
}: StatusHistoryTimelineProps) {
  const { data: history, isLoading } = useStatusHistory(entityType, entityId);
  const { data: members } = useSectorMembers(sectorId);

  const nameOf = (userId: string) =>
    (members ?? []).find((m) => m.id === userId)?.full_name ?? "Usuário";

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if ((history ?? []).length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhuma mudança de status registrada.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {(history ?? []).map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <History className="h-3.5 w-3.5 text-primary" />
            </span>
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-sm font-medium">
              {describeTransition(entry.from_status, entry.to_status)}
            </p>
            <p className="text-xs text-muted-foreground">
              {nameOf(entry.changed_by)} · {formatDateTime(entry.created_at)}
            </p>
            {entry.note && (
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap rounded-md bg-muted px-2 py-1">
                {entry.note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
