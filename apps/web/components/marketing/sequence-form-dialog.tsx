"use client";

import { useState } from "react";
import {
  useCreateSequence,
  useUpdateSequence,
} from "@/hooks/marketing/use-sequences";
import type { Sequence } from "@/hooks/marketing/use-sequences";
import { useSegments } from "@/hooks/marketing/use-segments";
import type {
  SequenceTrigger,
  SequenceStatus,
} from "@/lib/validations/marketing";
import {
  SEQUENCE_TRIGGERS,
  SEQUENCE_STATUSES,
} from "@/lib/validations/marketing";
import {
  SEQUENCE_TRIGGER_LABELS,
  SEQUENCE_STATUS_LABELS,
} from "@/lib/marketing/labels";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const NO_SEGMENT = "__none__";

interface SequenceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  sequence?: Sequence;
}

export function SequenceFormDialog({
  open,
  onOpenChange,
  sectorId,
  sequence,
}: SequenceFormDialogProps) {
  const createSequence = useCreateSequence();
  const updateSequence = useUpdateSequence();
  const { data: segments } = useSegments(sectorId);
  const isEdit = !!sequence;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] =
    useState<SequenceTrigger>("segment_entry");
  const [status, setStatus] = useState<SequenceStatus>("draft");
  const [segmentId, setSegmentId] = useState<string>(NO_SEGMENT);

  const formKey = `${open}:${sequence?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(sequence?.name ?? "");
    setDescription(sequence?.description ?? "");
    setTriggerType(sequence?.trigger_type ?? "segment_entry");
    setStatus(sequence?.status ?? "draft");
    setSegmentId(sequence?.segment_id ?? NO_SEGMENT);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const common = {
      name,
      description: description || undefined,
      triggerType,
      status,
      segmentId: segmentId === NO_SEGMENT ? null : segmentId,
    };

    const payload = isEdit
      ? { id: sequence.id, ...common }
      : { sectorId, ...common };

    const result = isEdit
      ? await updateSequence.mutateAsync(payload)
      : await createSequence.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} sequência`
      );
      return;
    }

    toast.success(isEdit ? "Sequência atualizada" : "Sequência criada");
    onOpenChange(false);
  };

  const isPending = createSequence.isPending || updateSequence.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Sequência" : "Nova Sequência"}
            </DialogTitle>
            <DialogDescription>
              Defina um fluxo de automação simples (gatilho → passos).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sequence-name">Nome</Label>
              <Input
                id="sequence-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Boas-vindas a novos leads"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sequence-trigger">Gatilho</Label>
                <Select
                  value={triggerType}
                  onValueChange={(v) =>
                    setTriggerType(v as SequenceTrigger)
                  }
                >
                  <SelectTrigger id="sequence-trigger" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEQUENCE_TRIGGERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SEQUENCE_TRIGGER_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sequence-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as SequenceStatus)}
                >
                  <SelectTrigger id="sequence-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEQUENCE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SEQUENCE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {triggerType === "segment_entry" && (
              <div className="grid gap-2">
                <Label htmlFor="sequence-segment">Audiência do gatilho</Label>
                <Select value={segmentId} onValueChange={setSegmentId}>
                  <SelectTrigger id="sequence-segment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SEGMENT}>Sem audiência</SelectItem>
                    {(segments ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="sequence-description">Descrição</Label>
              <Textarea
                id="sequence-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Objetivo da sequência"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name}>
              {isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Sequência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
