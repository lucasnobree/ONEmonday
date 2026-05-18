"use client";

import { useState } from "react";
import {
  useCreateSegment,
  useUpdateSegment,
} from "@/hooks/marketing/use-segments";
import type { AudienceSegment } from "@/hooks/marketing/use-segments";
import {
  useSegmentContacts,
  useSaveSegmentContacts,
} from "@/hooks/marketing/use-segment-contacts";
import { parseRecipients } from "@/lib/marketing/recipients";
import type { MarketingChannel } from "@/lib/validations/marketing";
import { MARKETING_CHANNELS } from "@/lib/validations/marketing";
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
import { CHANNEL_LABELS } from "@/lib/marketing/labels";

interface SegmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  segment?: AudienceSegment;
}

export function SegmentFormDialog({
  open,
  onOpenChange,
  sectorId,
  segment,
}: SegmentFormDialogProps) {
  const createSegment = useCreateSegment();
  const updateSegment = useUpdateSegment();
  const saveContacts = useSaveSegmentContacts();
  const isEdit = !!segment;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [channel, setChannel] = useState<MarketingChannel>("email");
  const [estimatedSize, setEstimatedSize] = useState("0");
  const [contactsRaw, setContactsRaw] = useState("");

  // The segment's contact list — only loaded when editing an existing segment
  // (a not-yet-created segment cannot own contacts).
  const { data: contacts } = useSegmentContacts(
    isEdit ? segment?.id : undefined
  );

  const formKey = `${open}:${segment?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(segment?.name ?? "");
    setDescription(segment?.description ?? "");
    setChannel(segment?.channel ?? "email");
    setEstimatedSize(String(segment?.estimated_size ?? 0));
    setContactsRaw("");
  }

  // Seed the contacts textarea once the contact list resolves, keyed so an
  // operator's in-progress edits are never overwritten by a late refetch.
  const [contactsSeededKey, setContactsSeededKey] = useState<string | null>(
    null
  );
  if (open && isEdit && contacts && contactsSeededKey !== formKey) {
    setContactsSeededKey(formKey);
    setContactsRaw(
      contacts
        .map((c) => (c.name ? `${c.name} <${c.email}>` : c.email))
        .join("\n")
    );
  }

  const parsedContacts = parseRecipients(contactsRaw);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const size = Number(estimatedSize);
    if (!Number.isInteger(size) || size < 0) {
      toast.error("Tamanho deve ser um número inteiro não negativo");
      return;
    }

    const common = {
      name,
      description: description || undefined,
      channel,
      estimatedSize: size,
    };

    const payload = isEdit
      ? { id: segment.id, ...common }
      : { sectorId, ...common };

    const result = isEdit
      ? await updateSegment.mutateAsync(payload)
      : await createSegment.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} audiência`
      );
      return;
    }

    // Persist the contact list. Contacts can only be saved against an existing
    // segment id — on create the operator re-opens the segment to add them.
    if (isEdit && segment) {
      const contactResult = await saveContacts.mutateAsync({
        segmentId: segment.id,
        contacts: parsedContacts.valid,
      });
      if (contactResult.error) {
        toast.error(
          typeof contactResult.error === "string"
            ? contactResult.error
            : "Erro ao salvar contatos da audiência"
        );
        return;
      }
    }

    toast.success(isEdit ? "Audiência atualizada" : "Audiência criada");
    onOpenChange(false);
  };

  const isPending =
    createSegment.isPending ||
    updateSegment.isPending ||
    saveContacts.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Audiência" : "Nova Audiência"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize os dados da audiência"
                : "Defina um segmento de audiência reutilizável"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="segment-name">Nome</Label>
              <Input
                id="segment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Clientes ativos - SP"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="segment-channel">Canal</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as MarketingChannel)}
                >
                  <SelectTrigger id="segment-channel" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETING_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CHANNEL_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="segment-size">Tamanho estimado</Label>
                <Input
                  id="segment-size"
                  type="number"
                  min={0}
                  step={1}
                  value={estimatedSize}
                  onChange={(e) => setEstimatedSize(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="segment-description">Descrição</Label>
              <Textarea
                id="segment-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Critérios e detalhes do segmento"
              />
            </div>

            {isEdit ? (
              <div className="grid gap-2">
                <Label htmlFor="segment-contacts">Contatos</Label>
                <Textarea
                  id="segment-contacts"
                  value={contactsRaw}
                  onChange={(e) => setContactsRaw(e.target.value)}
                  placeholder={"joao@exemplo.com\nMaria <maria@exemplo.com>"}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Um contato por linha. As campanhas de e-mail associadas a esta
                  audiência são enviadas para estes contatos.{" "}
                  <span className="font-medium">
                    {parsedContacts.valid.length} válido(s)
                  </span>
                  {parsedContacts.invalid.length > 0 && (
                    <span className="text-destructive">
                      {" "}
                      · {parsedContacts.invalid.length} inválido(s)
                    </span>
                  )}
                  {parsedContacts.duplicates > 0 && (
                    <span>
                      {" "}
                      · {parsedContacts.duplicates} duplicado(s) ignorado(s)
                    </span>
                  )}
                  .
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Salve a audiência e reabra-a para adicionar contatos.
              </p>
            )}
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
                  : "Criar Audiência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
