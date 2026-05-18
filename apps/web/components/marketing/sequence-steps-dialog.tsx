"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useSequenceSteps,
  useSaveSequenceSteps,
  type Sequence,
} from "@/hooks/marketing/use-sequences";
import { useEmailCampaigns } from "@/hooks/marketing/use-email-campaigns";
import type { SequenceStepType } from "@/lib/validations/marketing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/** A step being edited in the dialog. */
interface DraftStep {
  stepType: SequenceStepType;
  waitDays: number;
  emailCampaignId: string | null;
}

interface SequenceStepsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: Sequence | undefined;
}

export function SequenceStepsDialog({
  open,
  onOpenChange,
  sequence,
}: SequenceStepsDialogProps) {
  const { data: steps } = useSequenceSteps(open ? sequence?.id : undefined);
  const { data: emailCampaigns } = useEmailCampaigns(
    open ? sequence?.sector_id : undefined
  );
  const saveSteps = useSaveSequenceSteps();

  const [draft, setDraft] = useState<DraftStep[]>([]);

  const formKey = `${open}:${sequence?.id ?? "none"}:${steps?.length ?? -1}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && sequence && steps && seededKey !== formKey) {
    setSeededKey(formKey);
    setDraft(
      steps.map((s) => ({
        stepType: s.step_type,
        waitDays: s.wait_days,
        emailCampaignId: s.email_campaign_id,
      }))
    );
  }

  const updateStep = (index: number, patch: Partial<DraftStep>) => {
    setDraft((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const addStep = () => {
    setDraft((prev) => [
      ...prev,
      { stepType: "wait", waitDays: 1, emailCampaignId: null },
    ]);
  };

  const removeStep = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!sequence) return;

    // Client-side guard mirroring the schema's cross-field rules.
    for (const [i, s] of draft.entries()) {
      if (s.stepType === "wait" && s.waitDays < 1) {
        toast.error(`Passo ${i + 1}: a espera exige ao menos 1 dia`);
        return;
      }
      if (s.stepType === "send_email" && !s.emailCampaignId) {
        toast.error(`Passo ${i + 1}: selecione uma campanha de e-mail`);
        return;
      }
    }

    const result = await saveSteps.mutateAsync({
      sequenceId: sequence.id,
      steps: draft.map((s, i) => ({
        stepOrder: i,
        stepType: s.stepType,
        waitDays: s.stepType === "wait" ? s.waitDays : 0,
        emailCampaignId:
          s.stepType === "send_email" ? s.emailCampaignId : null,
      })),
    });

    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao salvar"
      );
      return;
    }

    toast.success("Passos da sequência salvos");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Passos da sequência</DialogTitle>
          <DialogDescription>
            {sequence
              ? `"${sequence.name}" — passos executados em ordem.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {draft.length === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
              Nenhum passo. Adicione um passo de espera ou de envio de e-mail.
            </p>
          ) : (
            draft.map((step, index) => (
              <div
                key={index}
                className="flex flex-wrap items-end gap-3 rounded-md border p-3"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  #{index + 1}
                </span>
                <div className="grid gap-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={step.stepType}
                    onValueChange={(v) =>
                      updateStep(index, {
                        stepType: v as SequenceStepType,
                      })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wait">Aguardar</SelectItem>
                      <SelectItem value="send_email">
                        Enviar e-mail
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {step.stepType === "wait" ? (
                  <div className="grid gap-1">
                    <Label className="text-xs">Dias de espera</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      step={1}
                      className="w-28"
                      value={step.waitDays}
                      onChange={(e) =>
                        updateStep(index, {
                          waitDays: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                ) : (
                  <div className="grid min-w-48 flex-1 gap-1">
                    <Label className="text-xs">Campanha de e-mail</Label>
                    <Select
                      value={step.emailCampaignId ?? ""}
                      onValueChange={(v) =>
                        updateStep(index, { emailCampaignId: v })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(emailCampaigns ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500"
                  onClick={() => removeStep(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={addStep}
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar passo
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveSteps.isPending}>
            {saveSteps.isPending ? "Salvando..." : "Salvar passos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
