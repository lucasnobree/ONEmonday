"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useLeadForms,
  useSetLeadFormPublished,
  useDeleteLeadForm,
  type LeadForm,
} from "@/hooks/crm/use-lead-forms";
import { LeadFormBuilderDialog } from "@/components/crm/lead-form-builder-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Plus,
  ClipboardList,
  Copy,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

/** Builds the absolute public capture URL for a form token. */
function publicFormUrl(token: string): string {
  if (typeof window === "undefined") return `/f/${token}`;
  return `${window.location.origin}/f/${token}`;
}

export default function LeadFormsPage() {
  const { currentSector } = useCurrentSector();
  const { data: forms, isLoading } = useLeadForms(currentSector?.id);
  const setPublished = useSetLeadFormPublished();
  const deleteForm = useDeleteLeadForm();

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<LeadForm | null>(null);

  const openCreate = () => {
    setEditingForm(null);
    setShowBuilder(true);
  };

  const openEdit = (form: LeadForm) => {
    setEditingForm(form);
    setShowBuilder(true);
  };

  const copyUrl = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicFormUrl(token));
      toast.success("URL pública copiada");
    } catch {
      toast.error("Não foi possível copiar a URL");
    }
  };

  const handleTogglePublished = async (form: LeadForm) => {
    const result = await setPublished.mutateAsync({
      id: form.id,
      published: !form.is_published,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao publicar"
      );
      return;
    }
    toast.success(form.is_published ? "Formulário despublicado" : "Formulário publicado");
  };

  const handleDelete = async (form: LeadForm) => {
    if (!confirm(`Excluir o formulário "${form.name}"?`)) return;
    const result = await deleteForm.mutateAsync(form.id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Formulário excluído");
  };

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para gerenciar formulários de captura.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Formulários de captura de leads. Cada formulário publicado expõe uma
          URL pública que cria leads automaticamente.
        </p>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-1" />
          Novo formulário
        </Button>
      </div>

      {!forms?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum formulário de captura"
          description="Crie um formulário para capturar leads de inbound sem depender do RD Station."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4 mr-1" />
              Novo formulário
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{form.name}</CardTitle>
                  <Badge variant={form.is_published ? "default" : "secondary"}>
                    {form.is_published ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>
                {form.description && (
                  <p className="text-sm text-muted-foreground">
                    {form.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{form.fields.length} campos</span>
                  <span>·</span>
                  <span>{form.lead_count} leads</span>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_published}
                    onCheckedChange={() => handleTogglePublished(form)}
                    disabled={setPublished.isPending}
                    aria-label="Publicar formulário"
                  />
                  <span className="text-muted-foreground">
                    {form.is_published
                      ? "Aceitando submissões"
                      : "Submissões desativadas"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyUrl(form.public_token)}
                  >
                    <Copy className="size-3.5 mr-1" />
                    Copiar URL
                  </Button>
                  {form.is_published && (
                    <a
                      href={publicFormUrl(form.public_token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                    >
                      <ExternalLink className="size-3.5" />
                      Abrir
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(form)}
                  >
                    <Pencil className="size-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(form)}
                    disabled={deleteForm.isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LeadFormBuilderDialog
        open={showBuilder}
        onOpenChange={setShowBuilder}
        sectorId={currentSector.id}
        form={editingForm}
      />
    </div>
  );
}
