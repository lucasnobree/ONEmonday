"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Paperclip, Download, Trash2, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createTicketAttachment } from "@/lib/actions/support/attachments";
import {
  useTicketAttachments,
  useDeleteTicketAttachment,
} from "@/hooks/support/use-ticket-attachments";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

const SUPPORT_BUCKET = "support-attachments";
const MAX_BYTES = 10 * 1024 * 1024;

/** Human-readable file size. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TicketAttachmentsProps {
  ticketId: string;
}

export function TicketAttachments({ ticketId }: TicketAttachmentsProps) {
  const { data: attachments, isLoading } = useTicketAttachments(ticketId);
  const deleteMutation = useDeleteTicketAttachment(ticketId);
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = useCallback(
    async (files: FileList) => {
      if (!files.length) return;
      setIsUploading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Não autenticado");
        setIsUploading(false);
        return;
      }

      let uploaded = 0;
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} excede 10MB`);
          continue;
        }
        const path = `${user.id}/${ticketId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from(SUPPORT_BUCKET)
          .upload(path, file);
        if (uploadError) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }
        const result = await createTicketAttachment({
          ticketId,
          filePath: path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || undefined,
        });
        if (result.error) {
          // Roll back the orphaned storage object on a metadata failure.
          await supabase.storage.from(SUPPORT_BUCKET).remove([path]);
          toast.error(
            typeof result.error === "string"
              ? result.error
              : `Erro ao registrar ${file.name}`
          );
          continue;
        }
        uploaded += 1;
      }

      setIsUploading(false);
      if (uploaded > 0) {
        toast.success(
          uploaded === 1 ? "Anexo enviado" : `${uploaded} anexos enviados`
        );
        queryClient.invalidateQueries({
          queryKey: ["ticket-attachments", ticketId],
        });
      }
    },
    [ticketId, queryClient]
  );

  async function handleDownload(filePath: string, fileName: string) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(SUPPORT_BUCKET)
      .createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download");
      return;
    }
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = fileName;
    link.rel = "noopener noreferrer";
    link.click();
  }

  async function handleDelete(id: string) {
    const result = await deleteMutation.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao remover anexo"
      );
      return;
    }
    toast.success("Anexo removido");
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleUpload(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-4 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <input
          type="file"
          multiple
          className="hidden"
          id={`ticket-attachment-${ticketId}`}
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <label
          htmlFor={`ticket-attachment-${ticketId}`}
          className="cursor-pointer"
        >
          <Upload className="mx-auto mb-1 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isUploading
              ? "Enviando..."
              : "Arraste arquivos ou clique para anexar"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Máx. 10MB por arquivo
          </p>
        </label>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando anexos...</p>
      ) : !attachments?.length ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="size-3" />
          Nenhum anexo.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{att.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(att.file_size)}
                  {att.users?.full_name ? ` · ${att.users.full_name}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Baixar anexo"
                onClick={() => handleDownload(att.file_path, att.file_name)}
              >
                <Download className="size-4" />
              </Button>
              <ConfirmDialog
                title="Remover anexo"
                description={`O anexo "${att.file_name}" será removido permanentemente.`}
                onConfirm={() => handleDelete(att.id)}
              >
                <Button variant="ghost" size="icon-sm" title="Remover anexo">
                  <Trash2 className="size-4" />
                </Button>
              </ConfirmDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
