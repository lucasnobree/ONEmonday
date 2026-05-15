"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateIncident,
  useUpdateIncident,
  type DevIncident,
} from "@/hooks/dev-tools/use-incidents";
import { useServices } from "@/hooks/dev-tools/use-services";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
} from "@/lib/validations/dev-tools";
import { SEVERITY_LABELS, INCIDENT_STATUS_LABELS } from "@/lib/dev-tools/labels";
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

const NO_SERVICE = "__none__";

interface IncidentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  incident?: DevIncident;
}

export function IncidentFormDialog({
  open,
  onOpenChange,
  sectorId,
  incident,
}: IncidentFormDialogProps) {
  const createIncident = useCreateIncident();
  const updateIncident = useUpdateIncident();
  const { data: services } = useServices(open ? sectorId : undefined);
  const isEdit = !!incident;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("sev3");
  const [status, setStatus] = useState<string>("investigating");
  const [serviceId, setServiceId] = useState<string>(NO_SERVICE);

  const formKey = `${open}:${incident?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setTitle(incident?.title ?? "");
    setDescription(incident?.description ?? "");
    setSeverity(incident?.severity ?? "sev3");
    setStatus(incident?.status ?? "investigating");
    setServiceId(incident?.service_id ?? NO_SERVICE);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      sectorId,
      title,
      description: description || undefined,
      severity,
      status,
      serviceId: serviceId === NO_SERVICE ? undefined : serviceId,
      ...(isEdit ? { id: incident.id } : {}),
    };
    const result = isEdit
      ? await updateIncident.mutateAsync(payload)
      : await createIncident.mutateAsync(payload);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao salvar incidente"
      );
      return;
    }
    toast.success(isEdit ? "Incidente atualizado" : "Incidente registrado");
    onOpenChange(false);
  };

  const isPending = createIncident.isPending || updateIncident.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Incidente" : "Novo Incidente"}
            </DialogTitle>
            <DialogDescription>
              Registre uma interrupcao ou degradacao de servico.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="inc-title">Titulo</Label>
              <Input
                id="inc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inc-desc">Descricao</Label>
              <Textarea
                id="inc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Severidade</Label>
                <Select
                  value={severity}
                  onValueChange={(v) => v && setSeverity(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SEVERITY_LABELS[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {INCIDENT_STATUS_LABELS[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Servico afetado</Label>
              <Select
                value={serviceId}
                onValueChange={(v) => v && setServiceId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SERVICE}>Nenhum</SelectItem>
                  {(services ?? []).map((svc) => (
                    <SelectItem key={svc.id} value={svc.id}>
                      {svc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={isPending || !title}>
              {isPending ? "Salvando..." : isEdit ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
