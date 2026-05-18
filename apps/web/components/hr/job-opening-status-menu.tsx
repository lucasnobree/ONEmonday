"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JobOpening } from "@/hooks/hr/use-job-openings";
import { updateJobOpeningStatus } from "@/lib/actions/hr/job-openings";
import {
  allowedStatusTransitions,
  type JobOpeningStatus,
} from "@/lib/hr/recruitment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

/** pt-BR labels for the action that moves a vaga into each status. */
const STATUS_ACTION_LABELS: Record<JobOpeningStatus, string> = {
  open: "Reabrir vaga",
  closed: "Fechar vaga",
  filled: "Marcar como preenchida",
  cancelled: "Cancelar vaga",
};

/**
 * Per-row status menu for a job opening (vaga). Lists only the transitions
 * legal from the vaga's current status — an open vaga can be closed/filled/
 * cancelled, a closed one reopened — so HR can manage the openings list
 * without leaving the page.
 */
export function JobOpeningStatusMenu({ opening }: { opening: JobOpening }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (status: JobOpeningStatus) =>
      updateJobOpeningStatus(opening.id, status),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao atualizar a vaga"
        );
        return;
      }
      toast.success("Vaga atualizada");
      queryClient.invalidateQueries({ queryKey: ["hr-job-openings"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
    },
  });

  const options = allowedStatusTransitions(opening.status);
  if (options.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Ações da vaga"
            disabled={mutation.isPending}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((status) => (
          <DropdownMenuItem
            key={status}
            variant={status === "cancelled" ? "destructive" : "default"}
            onClick={() => mutation.mutate(status)}
          >
            {STATUS_ACTION_LABELS[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
