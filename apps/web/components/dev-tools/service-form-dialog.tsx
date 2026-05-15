"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateService,
  useUpdateService,
  type DevService,
} from "@/hooks/dev-tools/use-services";
import {
  ENVIRONMENTS,
  SERVICE_CRITICALITIES,
  SERVICE_HEALTH_STATES,
} from "@/lib/validations/dev-tools";
import {
  CRITICALITY_LABELS,
  ENVIRONMENT_LABELS,
  HEALTH_LABELS,
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

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  service?: DevService;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  sectorId,
  service,
}: ServiceFormDialogProps) {
  const createService = useCreateService();
  const updateService = useUpdateService();
  const isEdit = !!service;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState<string>("production");
  const [criticality, setCriticality] = useState<string>("medium");
  const [health, setHealth] = useState<string>("operational");
  const [repositoryUrl, setRepositoryUrl] = useState("");

  const formKey = `${open}:${service?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(service?.name ?? "");
    setSlug(service?.slug ?? "");
    setDescription(service?.description ?? "");
    setEnvironment(service?.environment ?? "production");
    setCriticality(service?.criticality ?? "medium");
    setHealth(service?.health ?? "operational");
    setRepositoryUrl(service?.repository_url ?? "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      sectorId,
      name,
      slug,
      description: description || undefined,
      environment,
      criticality,
      health,
      repositoryUrl: repositoryUrl || "",
      ...(isEdit ? { id: service.id } : {}),
    };
    const result = isEdit
      ? await updateService.mutateAsync(payload)
      : await createService.mutateAsync(payload);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao salvar servico"
      );
      return;
    }
    toast.success(isEdit ? "Servico atualizado" : "Servico criado");
    onOpenChange(false);
  };

  const isPending = createService.isPending || updateService.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar Servico" : "Novo Servico"}</DialogTitle>
            <DialogDescription>
              Registre um servico ou sistema monitorado por este setor.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="svc-name">Nome</Label>
                <Input
                  id="svc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="svc-slug">Identificador</Label>
                <Input
                  id="svc-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="api-pagamentos"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="svc-desc">Descricao</Label>
              <Textarea
                id="svc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <Label>Criticidade</Label>
                <Select
                  value={criticality}
                  onValueChange={(v) => v && setCriticality(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CRITICALITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CRITICALITY_LABELS[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Saude</Label>
                <Select value={health} onValueChange={(v) => v && setHealth(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_HEALTH_STATES.map((h) => (
                      <SelectItem key={h} value={h}>
                        {HEALTH_LABELS[h].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="svc-repo">Repositorio (URL)</Label>
              <Input
                id="svc-repo"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/..."
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
            <Button type="submit" disabled={isPending || !name || !slug}>
              {isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar Servico"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
