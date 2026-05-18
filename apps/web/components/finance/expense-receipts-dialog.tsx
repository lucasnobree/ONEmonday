"use client";

import { useRef, useState } from "react";
import type { Expense } from "@/hooks/finance/use-expenses";
import {
  useExpenseReceipts,
  useUploadExpenseReceipt,
  useDeleteExpenseReceipt,
  useExpenseReceiptUrl,
} from "@/hooks/finance/use-expense-receipts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { Upload, FileText, Trash2, ExternalLink } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024;

/** Human-readable file size (KB / MB). */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Receipt management for a single expense (audit item E1): upload receipt
 * images / PDFs to Supabase Storage and list / remove them.
 */
export function ExpenseReceiptsDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | undefined;
}) {
  const { data: receipts, isLoading } = useExpenseReceipts(
    open ? expense?.id : undefined
  );
  const upload = useUploadExpenseReceipt();
  const remove = useDeleteExpenseReceipt();
  const openUrl = useExpenseReceiptUrl();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!expense) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo excede 10MB");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("expenseId", expense.id);
    formData.append("file", file);
    const result = await upload.mutateAsync(formData);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao enviar comprovante"
      );
      return;
    }
    toast.success("Comprovante anexado");
  };

  const handleOpen = async (receiptId: string) => {
    const result = await openUrl.mutateAsync(receiptId);
    if (result.error || !result.data) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao abrir comprovante"
      );
      return;
    }
    window.open(result.data, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (receiptId: string) => {
    const result = await remove.mutateAsync(receiptId);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Comprovante removido");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comprovantes — {expense.vendor_name}</DialogTitle>
          <DialogDescription>
            Anexe recibos ou notas (imagem ou PDF, ate 10MB).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4 mr-1" />
            {uploading ? "Enviando..." : "Anexar comprovante"}
          </Button>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (receipts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum comprovante anexado.
            </p>
          ) : (
            <ul className="space-y-1">
              {(receipts ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{r.file_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatSize(r.file_size)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Abrir comprovante"
                      disabled={openUrl.isPending}
                      onClick={() => handleOpen(r.id)}
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                    <ConfirmDialog
                      title="Remover comprovante"
                      description={`Remover "${r.file_name}"?`}
                      onConfirm={() => handleDelete(r.id)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Remover comprovante"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </ConfirmDialog>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
