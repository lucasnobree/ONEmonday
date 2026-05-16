"use client";

import { useState } from "react";
import {
  useCreateOnboardingTemplate,
  useUpdateOnboardingTemplate,
  type OnboardingTemplate,
} from "@/hooks/hr/use-onboarding";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TemplateItemForm {
  title: string;
  description: string;
  responsibleRole: string;
  dueDaysAfterHire: number;
}

interface OnboardingTemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  template?: OnboardingTemplate;
}

export function OnboardingTemplateFormDialog({
  open,
  onOpenChange,
  sectorId,
  template,
}: OnboardingTemplateFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Keyed so the form state re-initializes whenever the dialog is
            reopened or switched between create / edit. */}
        {open && (
          <TemplateForm
            key={template?.id ?? "new"}
            sectorId={sectorId}
            template={template}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateForm({
  sectorId,
  template,
  onOpenChange,
}: {
  sectorId: string;
  template?: OnboardingTemplate;
  onOpenChange: (open: boolean) => void;
}) {
  const createTemplate = useCreateOnboardingTemplate();
  const updateTemplate = useUpdateOnboardingTemplate();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? "");
  const [position, setPosition] = useState(template?.position ?? "");
  const [items, setItems] = useState<TemplateItemForm[]>(
    (template?.items ?? []).map((i) => ({
      title: i.title,
      description: i.description ?? "",
      responsibleRole: i.responsible_role ?? "",
      dueDaysAfterHire: i.due_days_offset ?? 0,
    }))
  );

  function addItem() {
    setItems((prev) => [
      ...prev,
      { title: "", description: "", responsibleRole: "", dueDaysAfterHire: 0 },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof TemplateItemForm, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      sectorId,
      name,
      position,
      items: items.map((i) => ({
        title: i.title,
        description: i.description || undefined,
        responsibleRole: i.responsibleRole || undefined,
        dueDaysAfterHire: i.dueDaysAfterHire,
      })),
    };

    const result = template
      ? await updateTemplate.mutateAsync({ id: template.id, data: payload })
      : await createTemplate.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} template`
      );
      return;
    }

    toast.success(isEdit ? "Template atualizado" : "Template criado");
    onOpenChange(false);
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Template" : "Novo Template de Onboarding"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize o template de integração"
                : "Crie um novo template com as etapas do onboarding"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Nome</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Onboarding Desenvolvedor"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-position">Cargo alvo</Label>
              <Input
                id="template-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ex: Desenvolvedor Full Stack"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Etapas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>

              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                  Nenhuma etapa adicionada. Clique em &quot;Adicionar&quot;
                  para começar.
                </p>
              )}

              {items.map((item, index) => (
                <div
                  key={index}
                  className="border rounded-md p-3 space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      Etapa {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  <Input
                    value={item.title}
                    onChange={(e) => updateItem(index, "title", e.target.value)}
                    placeholder="Título da etapa"
                    required
                  />

                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, "description", e.target.value)
                    }
                    placeholder="Descrição (opcional)"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={item.responsibleRole}
                      onChange={(e) =>
                        updateItem(index, "responsibleRole", e.target.value)
                      }
                      placeholder="Responsável"
                    />
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        value={item.dueDaysAfterHire}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "dueDaysAfterHire",
                            parseInt(e.target.value) || 0
                          )
                        }
                        placeholder="Dias"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        dias
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
                ? isEdit
                  ? "Salvando..."
                  : "Criando..."
                : isEdit
                ? "Salvar"
                : "Criar Template"}
            </Button>
          </DialogFooter>
    </form>
  );
}
