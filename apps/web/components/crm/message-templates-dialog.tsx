"use client";

import { useState } from "react";
import {
  useMessageTemplates,
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
  useDeleteMessageTemplate,
  type MessageTemplate,
} from "@/hooks/crm/use-message-templates";
import type { MessageTemplateChannel } from "@/lib/validations/crm";
import { TEMPLATE_VARIABLES } from "@/lib/crm/message-templates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MessageTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  /** Templates are managed one channel at a time. */
  channel: MessageTemplateChannel;
}

/**
 * Manage the sector's reusable message templates for a single channel.
 * Opened from the deal Communication panel's composer. Supports listing,
 * creating, editing and (soft) deleting templates; the body may use the
 * `{{variable}}` merge fields listed at the bottom of the editor.
 */
export function MessageTemplatesDialog({
  open,
  onOpenChange,
  sectorId,
  channel,
}: MessageTemplatesDialogProps) {
  const { data: templates } = useMessageTemplates(sectorId);
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const deleteTemplate = useDeleteMessageTemplate();

  // null = list view; "new" or a template = the editor.
  const [editing, setEditing] = useState<MessageTemplate | "new" | null>(null);

  const channelTemplates = (templates ?? []).filter(
    (t) => t.channel === channel
  );
  const isEmail = channel === "email";

  // Re-seed the editor fields when its target changes (sentinel-key pattern).
  const editKey = editing === "new" ? "new" : (editing?.id ?? "none");
  const [seededKey, setSeededKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  if (editing !== null && seededKey !== editKey) {
    setSeededKey(editKey);
    const t = editing === "new" ? null : editing;
    setName(t?.name ?? "");
    setSubject(t?.subject ?? "");
    setBody(t?.body ?? "");
  }
  if (editing === null && seededKey !== null) {
    setSeededKey(null);
  }

  const handleSave = async () => {
    const values = {
      sectorId,
      channel,
      name: name.trim(),
      subject: isEmail ? subject.trim() : "",
      body: body.trim(),
    };
    const result =
      editing === "new"
        ? await createTemplate.mutateAsync(values)
        : await updateTemplate.mutateAsync({
            id: (editing as MessageTemplate).id,
            values,
          });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao salvar template"
      );
      return;
    }
    toast.success(editing === "new" ? "Template criado" : "Template atualizado");
    setEditing(null);
  };

  const handleDelete = async (template: MessageTemplate) => {
    const result = await deleteTemplate.mutateAsync(template.id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Template excluído");
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;
  const channelLabel = isEmail ? "e-mail" : "WhatsApp";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Templates de {channelLabel}</DialogTitle>
          <DialogDescription>
            Mensagens reutilizáveis para o painel de comunicação. Use variáveis
            como {"{{contato.nome}}"} para personalizar.
          </DialogDescription>
        </DialogHeader>

        {editing === null ? (
          <div className="space-y-3">
            {channelTemplates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum template de {channelLabel} ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {channelTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.name}</p>
                      {t.subject && (
                        <p className="truncate text-xs text-muted-foreground">
                          {t.subject}
                        </p>
                      )}
                      <p className="truncate text-xs text-muted-foreground">
                        {t.body}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Editar template ${t.name}`}
                        onClick={() => setEditing(t)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <ConfirmDialog
                        title="Excluir template"
                        description={`O template "${t.name}" será excluído.`}
                        onConfirm={() => handleDelete(t)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Excluir template ${t.name}`}
                          disabled={deleteTemplate.isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setEditing("new")}
            >
              <Plus className="size-4 mr-1" />
              Novo template
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="tpl-name">Nome</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Follow-up pós-reunião"
              />
            </div>
            {isEmail && (
              <div className="grid gap-2">
                <Label htmlFor="tpl-subject">Assunto</Label>
                <Input
                  id="tpl-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Assunto do e-mail"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="tpl-body">Conteúdo</Label>
              <Textarea
                id="tpl-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva a mensagem. Use {{contato.nome}}..."
                rows={5}
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <p className="font-medium">Variáveis disponíveis</p>
              <p className="mt-1 break-words">
                {TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join("  ·  ")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditing(null)}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={isPending || !name.trim() || !body.trim()}
              >
                {isPending ? "Salvando..." : "Salvar template"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
