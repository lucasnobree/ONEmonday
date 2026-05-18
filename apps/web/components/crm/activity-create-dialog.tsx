"use client";

import { useState } from "react";
import { useCreateActivity } from "@/hooks/crm/use-activities";
import { useDeals } from "@/hooks/crm/use-deals";
import { useContacts } from "@/hooks/crm/use-contacts";
import { useCompanies } from "@/hooks/crm/use-companies";
import { useCrmMembers } from "@/hooks/crm/use-crm-members";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from "lucide-react";

interface ActivityCreateDialogProps {
  sectorId: string;
}

const ACTIVITY_TYPES = [
  { value: "call", label: "Ligação" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Reunião" },
  { value: "note", label: "Nota" },
  { value: "task", label: "Tarefa" },
];

interface ActivityCreateDialogPropsExtended extends ActivityCreateDialogProps {
  /** When provided, the dialog is controlled externally (no internal trigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hides the built-in "Nova Atividade" trigger button. */
  hideTrigger?: boolean;
  /** Pre-links the activity to a deal / contact / company. */
  defaultDealId?: string;
  defaultContactId?: string;
  defaultCompanyId?: string;
}

export function ActivityCreateDialog({
  sectorId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
  defaultDealId,
  defaultContactId,
  defaultCompanyId,
}: ActivityCreateDialogPropsExtended) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const createActivity = useCreateActivity();
  const { data: deals } = useDeals(sectorId);
  const { data: contacts } = useContacts(sectorId);
  const { data: companies } = useCompanies(sectorId);
  const { data: members } = useCrmMembers(sectorId);

  const [type, setType] = useState("call");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [dealId, setDealId] = useState(defaultDealId ?? "");
  const [contactId, setContactId] = useState(defaultContactId ?? "");
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [durationMin, setDurationMin] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  function resetForm() {
    setType("call");
    setSubject("");
    setDescription("");
    setDealId(defaultDealId ?? "");
    setContactId(defaultContactId ?? "");
    setCompanyId(defaultCompanyId ?? "");
    setDurationMin("");
    setFromEmail("");
    setToEmail("");
    setLocation("");
    setScheduledAt("");
    setAssignedTo("");
  }

  function buildDescription() {
    let prefix = "";
    if (type === "email" && (fromEmail || toEmail)) {
      const parts = [];
      if (fromEmail) parts.push(`De: ${fromEmail}`);
      if (toEmail) parts.push(`Para: ${toEmail}`);
      prefix = parts.join(" | ");
    } else if (type === "meeting" && location) {
      prefix = `Local: ${location}`;
    }
    if (prefix && description) return `${prefix}\n---\n${description}`;
    if (prefix) return prefix;
    return description;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const finalDescription = buildDescription();

    const result = await createActivity.mutateAsync({
      sectorId,
      type,
      subject,
      description: finalDescription || undefined,
      dealId: dealId || undefined,
      contactId: contactId || undefined,
      companyId: companyId || undefined,
      scheduledAt: scheduledAt
        ? new Date(scheduledAt).toISOString()
        : undefined,
      assignedTo: assignedTo || undefined,
      durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
    });

    if (result.error) {
      const msg =
        typeof result.error === "string"
          ? result.error
          : "Verifique os campos e tente novamente.";
      toast.error(msg);
      return;
    }

    toast.success("Atividade registrada com sucesso");
    resetForm();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus className="size-4" />
          Nova Atividade
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
            <DialogDescription>
              Registre uma atividade ou agende uma tarefa com prazo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v ?? "call")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activity-duration">Duração (min)</Label>
                <Input
                  id="activity-duration"
                  type="number"
                  min="1"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  placeholder="Ex: 30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-subject">Assunto</Label>
              <Input
                id="activity-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto da atividade"
                required
              />
            </div>

            {type === "email" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="activity-from-email">De (email)</Label>
                  <Input
                    id="activity-from-email"
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="remetente@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity-to-email">Para (email)</Label>
                  <Input
                    id="activity-to-email"
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="destinatario@email.com"
                  />
                </div>
              </div>
            )}

            {type === "meeting" && (
              <div className="space-y-2">
                <Label htmlFor="activity-location">Local</Label>
                <Input
                  id="activity-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Sala de reunião, Google Meet, etc."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="activity-description">Descrição</Label>
              <Textarea
                id="activity-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="activity-scheduled">
                  Agendar para (opcional)
                </Label>
                <Input
                  id="activity-scheduled"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Cria uma tarefa com prazo. Em branco = registro imediato.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  value={assignedTo}
                  onValueChange={(v) => setAssignedTo(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Eu (padrão)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(members || []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Deal</Label>
                <Select value={dealId} onValueChange={(v) => setDealId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    {(deals || []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.card?.title ?? d.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contato</Label>
                <Select value={contactId} onValueChange={(v) => setContactId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contacts || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companies || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createActivity.isPending || !subject}>
              {createActivity.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
