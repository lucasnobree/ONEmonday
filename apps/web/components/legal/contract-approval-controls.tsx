"use client";

import { useState } from "react";
import { useContractApproval } from "@/hooks/legal/use-status-history";
import {
  availableApprovalActions,
  CONTRACT_APPROVAL_LABELS,
  type ContractApprovalAction,
} from "@/lib/legal/status-history";
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
import { Send, Check, X } from "lucide-react";

interface ContractApprovalControlsProps {
  contractId: string;
  status: string;
}

const ACTION_ICON: Record<ContractApprovalAction, typeof Send> = {
  submit_for_approval: Send,
  approve: Check,
  reject: X,
};

/**
 * Lightweight contract-approval controls (Wave 4 audit C1/K2). Renders the
 * approval actions legal from the contract's current status:
 *   draft     -> "Enviar para aprovação"
 *   in_review -> "Aprovar" / "Rejeitar" (reject captures a required reason)
 * Every action is recorded in the status-change history.
 */
export function ContractApprovalControls({
  contractId,
  status,
}: ContractApprovalControlsProps) {
  const approval = useContractApproval();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const actions = availableApprovalActions(status);
  if (actions.length === 0) return null;

  const run = async (action: ContractApprovalAction, note?: string) => {
    const result = await approval.mutateAsync({
      contractId,
      action,
      note,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao atualizar o contrato"
      );
      return false;
    }
    toast.success("Contrato atualizado");
    return true;
  };

  const handleAction = (action: ContractApprovalAction) => {
    if (action === "reject") {
      setReason("");
      setRejectOpen(true);
      return;
    }
    void run(action);
  };

  const submitReject = async () => {
    if (!reason.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    const ok = await run("reject", reason.trim());
    if (ok) setRejectOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = ACTION_ICON[action];
          return (
            <Button
              key={action}
              size="sm"
              variant={action === "reject" ? "destructive" : "default"}
              disabled={approval.isPending}
              onClick={() => handleAction(action)}
            >
              <Icon className="h-4 w-4 mr-1" />
              {CONTRACT_APPROVAL_LABELS[action]}
            </Button>
          );
        })}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar contrato</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição — ele ficará registrado no histórico
              do contrato.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="contract-reject-reason">Motivo</Label>
            <Textarea
              id="contract-reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: cláusula de responsabilidade precisa de revisão"
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
              disabled={approval.isPending || !reason.trim()}
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
