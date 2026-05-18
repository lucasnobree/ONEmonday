"use client";

import { useState } from "react";
import type { Expense } from "@/hooks/finance/use-expenses";
import { useTransitionExpense } from "@/hooks/finance/use-expenses";
import { usePermissions } from "@/hooks/use-permissions";
import {
  availableTransitions,
  transitionNeedsApprovalPermission,
  type ExpenseTransition,
} from "@/lib/finance/expense-approval";
import { EXPENSE_TRANSITION_LABELS } from "./labels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

/**
 * Per-row approval-workflow menu for an expense (audit item E2). Lists the
 * transitions legal from the expense's current status; approve / reject are
 * only offered when the user holds `expense:approve`. Rejecting opens a small
 * dialog to capture a required reason.
 */
export function ExpenseApprovalMenu({ expense }: { expense: Expense }) {
  const transition = useTransitionExpense();
  const { hasPermission } = usePermissions();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const canApprove = hasPermission(expense.sector_id, "expense", "approve");

  // Filter transitions the user is allowed to trigger.
  const options = availableTransitions(expense.status).filter((t) =>
    transitionNeedsApprovalPermission(t) ? canApprove : true
  );

  if (options.length === 0) return null;

  const run = async (t: ExpenseTransition, rejectReason?: string) => {
    const result = await transition.mutateAsync({
      id: expense.id,
      transition: t,
      reason: rejectReason,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao atualizar a despesa"
      );
      return;
    }
    toast.success("Despesa atualizada");
  };

  const handleSelect = (t: ExpenseTransition) => {
    if (t === "reject") {
      setReason("");
      setRejectOpen(true);
      return;
    }
    void run(t);
  };

  const submitReject = async () => {
    if (!reason.trim()) {
      toast.error("Informe o motivo da rejeicao");
      return;
    }
    await run("reject", reason.trim());
    setRejectOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Acoes de aprovacao"
              disabled={transition.isPending}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {options.map((t) => (
            <DropdownMenuItem
              key={t}
              variant={t === "reject" || t === "void" ? "destructive" : "default"}
              onClick={() => handleSelect(t)}
            >
              {EXPENSE_TRANSITION_LABELS[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar despesa</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeicao — ele ficara registrado na despesa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="reject-reason">Motivo</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: valor acima do orcamento aprovado"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={transition.isPending || !reason.trim()}
              onClick={submitReject}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
