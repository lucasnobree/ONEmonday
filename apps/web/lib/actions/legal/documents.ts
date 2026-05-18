"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createContractDocumentSchema } from "@/lib/validations/legal";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const LEGAL_BUCKET = "legal-documents";

/**
 * Records an uploaded contract document. The file itself is uploaded to the
 * `legal-documents` Storage bucket by the client; this action persists the
 * metadata row, enforcing that the caller may write documents in the
 * contract's sector.
 */
export async function createContractDocument(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createContractDocumentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: contract } = await supabase
    .from("legal_contracts")
    .select("sector_id")
    .eq("id", parsed.data.contractId)
    .single();
  if (!contract) return { error: "Contrato não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, contract.sector_id, "contract_document", "create")
  ) {
    return { error: "Sem permissão" };
  }

  const { data, error } = await supabase
    .from("legal_contract_documents")
    .insert({
      contract_id: parsed.data.contractId,
      sector_id: contract.sector_id,
      file_path: parsed.data.filePath,
      file_name: parsed.data.fileName,
      file_size: parsed.data.fileSize,
      mime_type: parsed.data.mimeType ?? null,
      doc_label: parsed.data.docLabel || null,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/legal/contracts");
  return { data };
}

/** Soft cleanup is not used — documents are hard-deleted with their file. */
export async function deleteContractDocument(documentId: string) {
  const idParsed = z.string().uuid().safeParse(documentId);
  if (!idParsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: doc } = await supabase
    .from("legal_contract_documents")
    .select("sector_id, file_path")
    .eq("id", idParsed.data)
    .single();
  if (!doc) return { error: "Documento não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, doc.sector_id, "contract_document", "delete")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("legal_contract_documents")
    .delete()
    .eq("id", idParsed.data);
  if (error) return { error: error.message };

  if (doc.file_path) {
    await supabase.storage.from(LEGAL_BUCKET).remove([doc.file_path]);
  }

  revalidatePath("/legal/contracts");
  return { success: true };
}

/**
 * Creates a short-lived signed URL for downloading a contract document.
 * RLS on the metadata table gates the lookup; the signed URL then grants
 * time-boxed read access to the otherwise-private object.
 */
export async function getContractDocumentUrl(documentId: string) {
  const idParsed = z.string().uuid().safeParse(documentId);
  if (!idParsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: doc } = await supabase
    .from("legal_contract_documents")
    .select("file_path")
    .eq("id", idParsed.data)
    .single();
  if (!doc) return { error: "Documento não encontrado" };

  const { data, error } = await supabase.storage
    .from(LEGAL_BUCKET)
    .createSignedUrl(doc.file_path, 300);
  if (error) return { error: error.message };

  return { url: data.signedUrl };
}
