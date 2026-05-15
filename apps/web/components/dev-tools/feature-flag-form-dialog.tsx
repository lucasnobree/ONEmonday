"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateFeatureFlag,
  useUpdateFeatureFlag,
  type DevFeatureFlag,
} from "@/hooks/dev-tools/use-feature-flags";
import { useServices } from "@/hooks/dev-tools/use-services";
import { ENVIRONMENTS } from "@/lib/validations/dev-tools";
import { ENVIRONMENT_LABELS } from "@/lib/dev-tools/labels";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_SERVICE = "__none__";

interface FeatureFlagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  flag?: DevFeatureFlag;
}

export function FeatureFlagFormDialog({
  open,
  onOpenChange,
  sectorId,
  flag,
}: FeatureFlagFormDialogProps) {
  const createFlag = useCreateFeatureFlag();
  const updateFlag = useUpdateFeatureFlag();
  const { data: services } = useServices(open ? sectorId : undefined);
  const isEdit = !!flag;

  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState<string>("production");
  const [isEnabled, setIsEnabled] = useState(false);
  const [rollout, setRollout] = useState("0");
  const [serviceId, setServiceId] = useState<string>(NO_SERVICE);

  const formKey = `${open}:${flag?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setKey(flag?.key ?? "");
    setDescription(flag?.description ?? "");
    setEnvironment(flag?.environment ?? "production");
    setIsEnabled(flag?.is_enabled ?? false);
    setRollout(String(flag?.rollout_percentage ?? 0));
    setServiceId(flag?.service_id ?? NO_SERVICE);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      sectorId,
      key,
      description: description || undefined,
      environment,
      isEnabled,
      rolloutPercentage: Math.min(100, Math.max(0, Number(rollout) || 0)),
      serviceId: serviceId === NO_SERVICE ? undefined : serviceId,
      ...(isEdit ? { id: flag.id } : {}),
    };
    const result = isEdit
      ? await updateFlag.mutateAsync(payload)
      : await createFlag.mutateAsync(payload);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao salvar flag"
      );
      return;
    }
    toast.success(isEdit ? "Flag atualizada" : "Flag criada");
    onOpenChange(false);
  };

  const isPending = createFlag.isPending || updateFlag.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar Flag" : "Nova Feature Flag"}</DialogTitle>
            <DialogDescription>
              Controle o rollout de uma funcionalidade por ambiente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="flag-key">Chave</Label>
              <Input
                id="flag-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="novo-checkout"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="flag-desc">Descricao</Label>
              <Textarea
                id="flag-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div className="grid gap-2">
                <Label htmlFor="flag-rollout">Rollout (%)</Label>
                <Input
                  id="flag-rollout"
                  type="number"
                  min={0}
                  max={100}
                  value={rollout}
                  onChange={(e) => setRollout(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Servico</Label>
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

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Ativada</Label>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                aria-label="Ativar flag"
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
            <Button type="submit" disabled={isPending || !key}>
              {isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar Flag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
