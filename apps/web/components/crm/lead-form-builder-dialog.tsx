"use client";

import { useState } from "react";
import {
  useCreateLeadForm,
  useUpdateLeadForm,
  type LeadForm,
} from "@/hooks/crm/use-lead-forms";
import {
  LEAD_FORM_FIELD_TYPES,
  type LeadFormField,
  type LeadFormFieldType,
} from "@/lib/validations/crm";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LEAD_SOURCES, leadSourceLabel } from "@/lib/crm/lead-sources";

interface LeadFormBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  /** When set, the dialog edits this form instead of creating a new one. */
  form?: LeadForm | null;
}

const FIELD_TYPE_LABELS: Record<LeadFormFieldType, string> = {
  text: "Texto",
  email: "E-mail",
  tel: "Telefone",
  textarea: "Texto longo",
  select: "Seleção",
};

/** Derives a safe field key from a label (lowercase, ascii, underscores). */
function keyFromLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** A starter field list every new form begins with. */
const DEFAULT_FIELDS: LeadFormField[] = [
  { key: "nome", label: "Nome", type: "text", required: true },
  { key: "email", label: "E-mail", type: "email", required: true },
];

export function LeadFormBuilderDialog({
  open,
  onOpenChange,
  sectorId,
  form,
}: LeadFormBuilderDialogProps) {
  const createForm = useCreateLeadForm();
  const updateForm = useUpdateLeadForm();
  const isEditing = !!form;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("form");
  const [successMessage, setSuccessMessage] = useState(
    "Obrigado! Recebemos seu contato."
  );
  const [isPublished, setIsPublished] = useState(false);
  const [fields, setFields] = useState<LeadFormField[]>(DEFAULT_FIELDS);

  // Re-seed the dialog when it (re)opens or its target form changes, by
  // adjusting state during render with a sentinel key — the React-recommended
  // alternative to a syncing effect (matches contact-form-dialog.tsx).
  const formKey = `${open}:${form?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(form?.name ?? "");
    setDescription(form?.description ?? "");
    setSource(form?.source ?? "form");
    setSuccessMessage(
      form?.success_message ?? "Obrigado! Recebemos seu contato."
    );
    setIsPublished(form?.is_published ?? false);
    setFields(form?.fields.length ? form.fields : DEFAULT_FIELDS);
  }

  const updateField = (index: number, patch: Partial<LeadFormField>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { key: "", label: "", type: "text", required: false },
    ]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-derive any missing field keys from their label.
    const normalised = fields.map((f) => ({
      ...f,
      key: f.key.trim() || keyFromLabel(f.label),
      options:
        f.type === "select"
          ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
          : undefined,
    }));

    if (normalised.some((f) => !f.label.trim() || !f.key)) {
      toast.error("Cada campo precisa de um rótulo");
      return;
    }
    if (new Set(normalised.map((f) => f.key)).size !== normalised.length) {
      toast.error("Os campos precisam de rótulos distintos");
      return;
    }
    if (
      normalised.some(
        (f) => f.type === "select" && (f.options?.length ?? 0) === 0
      )
    ) {
      toast.error("Campos de seleção precisam de ao menos uma opção");
      return;
    }

    const payload = {
      sectorId,
      name,
      description: description || undefined,
      source: source.trim() || "form",
      successMessage,
      isPublished,
      fields: normalised,
    };

    const result = isEditing
      ? await updateForm.mutateAsync({ ...payload, id: form!.id })
      : await createForm.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao salvar formulário"
      );
      return;
    }

    toast.success(isEditing ? "Formulário atualizado" : "Formulário criado");
    onOpenChange(false);
  };

  const isPending = createForm.isPending || updateForm.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar formulário" : "Novo formulário de captura"}
            </DialogTitle>
            <DialogDescription>
              Defina os campos do formulário. Cada formulário publicado ganha
              uma URL pública de captura de leads.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="form-name">Nome</Label>
              <Input
                id="form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Contato do site"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="form-description">Descrição</Label>
              <Textarea
                id="form-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição interna do formulário"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="form-source">Origem dos leads</Label>
                <Select
                  value={source}
                  onValueChange={(v) => setSource(v ?? "form")}
                >
                  <SelectTrigger id="form-source" className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        value ? leadSourceLabel(value) : "Origem"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {/* A legacy form may carry a source outside the canonical
                        list — keep it selectable so editing does not silently
                        change it. */}
                    {!LEAD_SOURCES.includes(
                      source as (typeof LEAD_SOURCES)[number]
                    ) &&
                      source.trim() !== "" && (
                        <SelectItem value={source}>
                          {leadSourceLabel(source)}
                        </SelectItem>
                      )}
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {leadSourceLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                    aria-label="Publicar formulário"
                  />
                  <span className="text-sm text-muted-foreground">
                    {isPublished ? "Publicado" : "Rascunho"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="form-success">Mensagem de sucesso</Label>
              <Input
                id="form-success"
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Campos</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addField}
                >
                  <Plus className="size-4 mr-1" />
                  Adicionar campo
                </Button>
              </div>

              {fields.map((field, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-3 space-y-3 bg-muted/30"
                >
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      <Input
                        value={field.label}
                        onChange={(e) =>
                          updateField(index, { label: e.target.value })
                        }
                        placeholder="Rótulo do campo"
                        aria-label="Rótulo do campo"
                      />
                      <Select
                        value={field.type}
                        onValueChange={(v) =>
                          updateField(index, {
                            type: (v as LeadFormFieldType) ?? "text",
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_FORM_FIELD_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {FIELD_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeField(index)}
                      aria-label="Remover campo"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {field.type === "select" && (
                    <Input
                      value={(field.options ?? []).join(", ")}
                      onChange={(e) =>
                        updateField(index, {
                          options: e.target.value
                            .split(",")
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Opções separadas por vírgula"
                      aria-label="Opções"
                    />
                  )}

                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch
                      checked={field.required}
                      onCheckedChange={(c) =>
                        updateField(index, { required: c })
                      }
                    />
                    Obrigatório
                  </label>
                </div>
              ))}

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  Adicione ao menos um campo ao formulário.
                </p>
              )}
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
            <Button
              type="submit"
              disabled={isPending || !name || fields.length === 0}
            >
              {isPending ? "Salvando..." : "Salvar formulário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
