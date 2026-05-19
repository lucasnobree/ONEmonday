"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
  const { scope, isLoading: scopeLoading } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const { data: forms, isLoading: formsLoading } = useLeadForms(scope);
  const setPublished = useSetLeadFormPublished();
  const deleteForm = useDeleteLeadForm();
  const isLoading = scopeLoading || formsLoading;
  // Creating a form needs a concrete target sector; under the all-sectors
  // scope fall back to the sidebar's current sector.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;

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
    const result = await deleteForm.mutateAsync(form.id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Formulário excluído");
  };

  /** Extra warning shown when deleting a form whose public URL is in use. */
  const deleteWarning = (form: LeadForm): string => {
    const base = `O formulário "${form.name}" será excluído permanentemente.`;
    if (form.is_published && form.lead_count > 0) {
      return `${base} A URL pública deixará de funcionar e os ${form.lead_count} leads já capturados continuarão na caixa de entrada.`;
    }
    if (form.is_published) {
      return `${base} A URL pública deixará de funcionar.`;
    }
    return base;
  };

  // When editing an existing form, target its own sector; for a new form use
  // the create-target sector resolved from the on-screen scope.
  const builderSectorId = editingForm?.sector_id ?? createSectorId;

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
        <div className="flex items-center gap-2">
          <SectorScopeFilter />
          <Button onClick={openCreate} disabled={!createSectorId}>
            <Plus className="size-4 mr-1" />
            Novo formulário
          </Button>
        </div>
      </div>

      {!forms?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum formulário de captura"
          description="Crie um formulário para capturar leads de inbound sem depender do RD Station."
          action={
            <Button onClick={openCreate} disabled={!createSectorId}>
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
                  <ConfirmDialog
                    title="Excluir formulário"
                    description={deleteWarning(form)}
                    onConfirm={() => handleDelete(form)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteForm.isPending}
                      aria-label={`Excluir formulário ${form.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </ConfirmDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {builderSectorId && (
        <LeadFormBuilderDialog
          open={showBuilder}
          onOpenChange={setShowBuilder}
          sectorId={builderSectorId}
          form={editingForm}
        />
      )}
    </div>
  );
}
