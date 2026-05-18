"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createContractDocument } from "@/lib/actions/legal/documents";
import { cn } from "@/lib/utils";

/** Max contract file size — mirrors the `legal-documents` bucket limit (25MB). */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface ContractDocumentUploadProps {
  contractId: string;
  sectorId: string;
}

/**
 * Drag-and-drop / click uploader for contract documents. Uploads each file to
 * the private `legal-documents` Storage bucket, then records the metadata via
 * the `createContractDocument` server action.
 */
export function ContractDocumentUpload({
  contractId,
  sectorId,
}: ContractDocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const handleUpload = useCallback(
    async (files: FileList) => {
      setIsUploading(true);
      let uploaded = 0;

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name} excede 25MB`);
          continue;
        }

        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${sectorId}/${contractId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("legal-documents")
          .upload(path, file);

        if (uploadError) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const result = await createContractDocument({
          contractId,
          filePath: path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || undefined,
        });

        if (result && "error" in result && result.error) {
          // Roll back the orphaned object when the metadata write failed.
          await supabase.storage.from("legal-documents").remove([path]);
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
        queryClient.invalidateQueries({
          queryKey: ["legal-contract-documents", contractId],
        });
        toast.success(
          uploaded === 1 ? "Documento enviado" : `${uploaded} documentos enviados`
        );
      }
    },
    [contractId, sectorId, supabase, queryClient]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
      }}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      )}
    >
      <input
        type="file"
        multiple
        className="hidden"
        id={`contract-doc-upload-${contractId}`}
        accept=".pdf,.doc,.docx,.txt,image/jpeg,image/png,image/webp"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
      <label
        htmlFor={`contract-doc-upload-${contractId}`}
        className="cursor-pointer"
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isUploading
            ? "Enviando..."
            : "Arraste o arquivo do contrato ou clique para enviar"}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          PDF, Word, imagem ou texto — máx. 25MB
        </p>
      </label>
    </div>
  );
}
