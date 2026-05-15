"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateDeployment,
  useUpdateDeployment,
  type DevDeployment,
} from "@/hooks/dev-tools/use-deployments";
import { useServices } from "@/hooks/dev-tools/use-services";
import { ENVIRONMENTS, DEPLOYMENT_STATUSES } from "@/lib/validations/dev-tools";
import {
  ENVIRONMENT_LABELS,
  DEPLOYMENT_STATUS_LABELS,
} from "@/lib/dev-tools/labels";
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

interface DeploymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  deployment?: DevDeployment;
}

export function DeploymentFormDialog({
  open,
  onOpenChange,
  sectorId,
  deployment,
}: DeploymentFormDialogProps) {
  const createDeployment = useCreateDeployment();
  const updateDeployment = useUpdateDeployment();
  const { data: services } = useServices(open ? sectorId : undefined);
  const isEdit = !!deployment;

  const [serviceId, setServiceId] = useState<string>("");
  const [version, setVersion] = useState("");
  const [environment, setEnvironment] = useState<string>("production");
  const [status, setStatus] = useState<string>("succeeded");
  const [notes, setNotes] = useState("");

  const formKey = `${open}:${deployment?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setServiceId(deployment?.service_id ?? "");
    setVersion(deployment?.version ?? "");
    setEnvironment(deployment?.environment ?? "production");
    setStatus(deployment?.status ?? "succeeded");
    setNotes(deployment?.notes ?? "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) {
      toast.error("Selecione o servico");
      return;
    }
    const payload = {
      sectorId,
      serviceId,
      version,
      environment,
      status,
      notes: notes || undefined,
      ...(isEdit ? { id: deployment.id } : {}),
    };
    const result = isEdit
      ? await updateDeployment.mutateAsync(payload)
      : await createDeployment.mutateAsync(payload);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao salvar deploy"
      );
      return;
    }
    toast.success(isEdit ? "Deploy atualizado" : "Deploy registrado");
    onOpenChange(false);
  };

  const isPending = createDeployment.isPending || updateDeployment.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar Deploy" : "Novo Deploy"}</DialogTitle>
            <DialogDescription>
              Registre uma publicacao de versao de um servico.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Servico</Label>
              <Select
                value={serviceId}
                onValueChange={(v) => v && setServiceId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(services ?? []).map((svc) => (
                    <SelectItem key={svc.id} value={svc.id}>
                      {svc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dep-version">Versao</Label>
                <Input
                  id="dep-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="v1.4.0"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Ambiente</Label>
                <Select
                  value={environment}
                  onValueChange={(v) => v && setEnvironment(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map((env) => (
                      <SelectItem key={env} value={env}>
                        {ENVIRONMENT_LABELS[env]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPLOYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {DEPLOYMENT_STATUS_LABELS[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dep-notes">Notas</Label>
              <Textarea
                id="dep-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
            <Button type="submit" disabled={isPending || !version}>
              {isPending ? "Salvando..." : isEdit ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
