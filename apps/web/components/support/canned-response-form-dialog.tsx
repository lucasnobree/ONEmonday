"use client";

import { useState } from "react";
import {
  useCreateCannedResponse,
  useUpdateCannedResponse,
} from "@/hooks/support/use-canned-responses";
import type { CannedResponse } from "@/hooks/support/use-canned-responses";
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
import { toast } from "sonner";

interface CannedResponseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  response?: CannedResponse;
}

// Inner form: remounted via `key` so useState initializers reset the
// fields between create/edit without a setState-in-effect.
function CannedResponseForm({
  onOpenChange,
  sectorId,
  response,
}: {
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  response?: CannedResponse;
}) {
  const createMutation = useCreateCannedResponse();
  const updateMutation = useUpdateCannedResponse();
  const isEdit = !!response;

  const [title, setTitle] = useState(response?.title ?? "");
  const [content, setContent] = useState(response?.content ?? "");
  const [category, setCategory] = useState(response?.category ?? "");
  const [shortcut, setShortcut] = useState(response?.shortcut ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      sectorId,
      title,
      content,
      category: category || undefined,
      shortcut: shortcut.replace(/^\//, "") || undefined,
    };

    const result = isEdit
      ? await updateMutation.mutateAsync({ id: response.id, data: payload })
      : await createMutation.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} resposta`
      );
      return;
    }

    toast.success(isEdit ? "Resposta atualizada" : "Resposta criada");
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Editar Resposta" : "Nova Resposta Pronta"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Atualize o texto da resposta padrao"
            : "Crie uma resposta reutilizavel para agilizar o atendimento"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="cr-title">Titulo</Label>
          <Input
            id="cr-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Saudacao inicial"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cr-category">Categoria</Label>
            <Input
              id="cr-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cr-shortcut">Atalho</Label>
            <Input
              id="cr-shortcut"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="Ex: /ola"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="cr-content">Conteudo</Label>
          <Textarea
            id="cr-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva o texto da resposta..."
            className="min-h-[140px] resize-none"
            required
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
        <Button type="submit" disabled={isPending || !title || !content}>
          {isPending
            ? isEdit
              ? "Salvando..."
              : "Criando..."
            : isEdit
              ? "Salvar"
              : "Criar Resposta"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CannedResponseFormDialog({
  open,
  onOpenChange,
  sectorId,
  response,
}: CannedResponseFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <CannedResponseForm
          key={response?.id ?? "new"}
          onOpenChange={onOpenChange}
          sectorId={sectorId}
          response={response}
        />
      </DialogContent>
    </Dialog>
  );
}
