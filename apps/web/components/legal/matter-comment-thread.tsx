"use client";

import { useState } from "react";
import {
  useMatterComments,
  useCreateMatterComment,
  useUpdateMatterComment,
  useDeleteMatterComment,
  type MatterComment,
} from "@/hooks/legal/use-matter-comments";
import { useCurrentUserId } from "@/hooks/legal/use-current-user-id";
import { useSectorMembers } from "@/hooks/legal/use-sector-members";
import { formatDateTime } from "@/lib/legal/dates";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { Send, Pencil, Trash2, Check, X } from "lucide-react";

interface MatterCommentThreadProps {
  matterId: string;
  sectorId: string;
}

/**
 * Comment / activity thread on a legal matter (Wave 4 audit M1). Turns a
 * static matter description into a back-and-forth between the requester and
 * the legal team. A user can edit / delete their own comments inline.
 */
export function MatterCommentThread({
  matterId,
  sectorId,
}: MatterCommentThreadProps) {
  const { data: comments, isLoading } = useMatterComments(matterId);
  const { data: members } = useSectorMembers(sectorId);
  const { data: currentUserId } = useCurrentUserId();
  const createComment = useCreateMatterComment();
  const updateComment = useUpdateMatterComment();
  const deleteComment = useDeleteMatterComment();

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const nameOf = (userId: string) =>
    (members ?? []).find((m) => m.id === userId)?.full_name ?? "Usuário";

  const handlePost = async () => {
    const body = draft.trim();
    if (!body) return;
    const result = await createComment.mutateAsync({ matterId, body });
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao enviar comentário"
      );
      return;
    }
    setDraft("");
  };

  const startEdit = (comment: MatterComment) => {
    setEditingId(comment.id);
    setEditDraft(comment.body);
  };

  const handleSaveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    const result = await updateComment.mutateAsync({ id, body });
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao editar comentário"
      );
      return;
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteComment.mutateAsync(id);
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao excluir comentário"
      );
      return;
    }
    toast.success("Comentário excluído");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva um comentário para a demanda..."
          rows={3}
          aria-label="Novo comentário"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim() || createComment.isPending}
            onClick={handlePost}
          >
            <Send className="h-4 w-4 mr-1" />
            Comentar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (comments ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhum comentário ainda. Inicie a conversa sobre esta demanda.
        </p>
      ) : (
        <ul className="space-y-3">
          {(comments ?? []).map((comment) => {
            const isOwn = comment.author_id === currentUserId;
            const isEditing = editingId === comment.id;
            const edited = comment.updated_at !== comment.created_at;
            return (
              <li key={comment.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {nameOf(comment.author_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(comment.created_at)}
                      {edited && " · editado"}
                    </p>
                  </div>
                  {isOwn && !isEditing && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Editar comentário"
                        onClick={() => startEdit(comment)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <ConfirmDialog
                        title="Excluir comentário?"
                        description="O comentário será removido permanentemente."
                        onConfirm={() => handleDelete(comment.id)}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Excluir comentário"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      aria-label="Editar comentário"
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          !editDraft.trim() || updateComment.isPending
                        }
                        onClick={() => handleSaveEdit(comment.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {comment.body}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
