"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useCannedResponses,
  useDeleteCannedResponse,
} from "@/hooks/support/use-canned-responses";
import type { CannedResponse } from "@/hooks/support/use-canned-responses";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CannedResponseFormDialog } from "@/components/support/canned-response-form-dialog";
import { formatShortcut } from "@/lib/support/shortcut";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  MessageSquareText,
  Copy,
  Check,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

export default function CannedResponsesPage() {
  const { currentSector } = useCurrentSector();
  const { data: responses, isLoading } = useCannedResponses(currentSector?.id);
  const deleteMutation = useDeleteCannedResponse();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<
    CannedResponse | undefined
  >(undefined);

  function handleCopy(content: string, id: string) {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copiado para a área de transferência");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCreate() {
    setEditingResponse(undefined);
    setDialogOpen(true);
  }

  function handleEdit(response: CannedResponse) {
    setEditingResponse(response);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    const result = await deleteMutation.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao excluir resposta"
      );
      return;
    }
    toast.success("Resposta excluída");
  }

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar as Respostas Prontas.
      </p>
    );
  }

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="canned_response"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Você não tem permissão para acessar as Respostas Prontas deste setor.
        </p>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Respostas reutilizáveis para agilizar o atendimento de tickets.
          </p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="size-4 mr-1" />
            Nova Resposta
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-lg" />
            ))}
          </div>
        ) : !responses?.length ? (
          <div className="py-16 text-center">
            <MessageSquareText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma resposta pronta cadastrada ainda.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {responses.map((response) => (
              <Card
                key={response.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() =>
                  setExpandedId(
                    expandedId === response.id ? null : response.id
                  )
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {response.title}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {response.shortcut && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {formatShortcut(response.shortcut)}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(response.content, response.id);
                        }}
                        title="Copiar conteúdo"
                      >
                        {copiedId === response.id ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {response.category && (
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {response.category}
                    </Badge>
                  )}
                  <p
                    className={`text-sm text-muted-foreground whitespace-pre-wrap ${
                      expandedId === response.id ? "" : "line-clamp-3"
                    }`}
                  >
                    {response.content}
                  </p>
                  {/* Actions are hidden until hover for a clean grid, but
                      remain operable for keyboard (group-focus-within) and
                      touch (pointer-coarse) users — a WCAG operability fix. */}
                  <div className="flex items-center gap-1 mt-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(response);
                      }}
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {/* span stops the click bubbling to the card's
                        expand/collapse handler */}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ConfirmDialog
                        title="Excluir resposta pronta"
                        description={`A resposta "${response.title}" será removida permanentemente. Esta ação não pode ser desfeita.`}
                        onConfirm={() => handleDelete(response.id)}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </ConfirmDialog>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CannedResponseFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingResponse(undefined);
        }}
        sectorId={currentSector.id}
        response={editingResponse}
      />
    </PermissionGate>
  );
}
