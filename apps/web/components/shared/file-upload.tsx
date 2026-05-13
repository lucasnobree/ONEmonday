"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createAttachment } from "@/lib/actions/attachments";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  cardId: string;
  onUploaded?: () => void;
}

export function FileUpload({ cardId, onUploaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClient();

  const handleUpload = useCallback(
    async (files: FileList) => {
      setIsUploading(true);

      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} excede 10MB`);
          continue;
        }

        const path = `${cardId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("card-attachments")
          .upload(path, file);

        if (uploadError) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("card-attachments").getPublicUrl(path);

        await createAttachment({
          cardId,
          fileUrl: publicUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
      }

      setIsUploading(false);
      onUploaded?.();
      toast.success("Arquivo(s) enviado(s)");
    },
    [cardId, supabase, onUploaded]
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
        handleUpload(e.dataTransfer.files);
      }}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      )}
    >
      <input
        type="file"
        multiple
        className="hidden"
        id={`file-upload-${cardId}`}
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
      <label htmlFor={`file-upload-${cardId}`} className="cursor-pointer">
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isUploading
            ? "Enviando..."
            : "Arraste arquivos ou clique para enviar"}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Max 10MB por arquivo
        </p>
      </label>
    </div>
  );
}
