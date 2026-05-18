"use server";

/**
 * Expense receipt server actions — upload and delete receipt files.
 *
 * A receipt is an image/PDF stored in the private `finance-receipts` Supabase
 * Storage bucket, with its metadata recorded in `finance_expense_receipts`.
 * Both the upload and delete paths re-check `expense:update` server-side.
 */
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RECEIPT_BUCKET = "finance-receipts";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export async function uploadExpenseReceipt(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const expenseId = formData.get("expenseId");
  const file = formData.get("file");

  if (typeof expenseId !== "string" || !(file instanceof File)) {
    return { error: "Dados incompletos" };
  }
  if (!z.string().uuid().safeParse(expenseId).success) {
    return { error: "ID invalido" };
  }
  if (file.size === 0) return { error: "Arquivo vazio" };
  if (file.size > MAX_RECEIPT_BYTES) {
    return { error: "Arquivo excede 10MB" };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { error: "Tipo de arquivo nao suportado (use imagem ou PDF)" };
  }

  const { data: expense } = await supabase
    .from("finance_expenses")
    .select("sector_id")
    .eq("id", expenseId)
    .eq("is_active", true)
    .single();
  if (!expense) return { error: "Despesa nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, expense.sector_id, "expense", "update")) {
    return { error: "Sem permissao" };
  }

  // Strip path separators from the file name before composing the storage key.
  const safeName = file.name.replace(/[/\\]/g, "_");
  const path = `${expense.sector_id}/${expenseId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  // The bucket is private — store the object path, not a (broken) public URL.
  // Downloads are served via short-lived signed URLs (getExpenseReceiptUrl).
  const { data: receipt, error: insertError } = await supabase
    .from("finance_expense_receipts")
    .insert({
      expense_id: expenseId,
      sector_id: expense.sector_id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    // Roll back the orphaned upload so storage and metadata stay consistent.
    await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
    return { error: insertError.message };
  }

  revalidatePath("/finance");
  return { data: receipt };
}

export async function deleteExpenseReceipt(receiptId: string) {
  const parsed = z.string().uuid().safeParse(receiptId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: receipt } = await supabase
    .from("finance_expense_receipts")
    .select("id, file_path, sector_id")
    .eq("id", receiptId)
    .single();
  if (!receipt) return { error: "Comprovante nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, receipt.sector_id, "expense", "update")) {
    return { error: "Sem permissao" };
  }

  await supabase.storage.from(RECEIPT_BUCKET).remove([receipt.file_path]);

  const { error } = await supabase
    .from("finance_expense_receipts")
    .delete()
    .eq("id", receiptId);

  if (error) return { error: error.message };

  revalidatePath("/finance");
  return { success: true };
}

/**
 * Mint a short-lived signed URL for a receipt. The bucket is private, so the
 * UI fetches a fresh URL on demand instead of storing a permanent link.
 */
export async function getExpenseReceiptUrl(receiptId: string) {
  const parsed = z.string().uuid().safeParse(receiptId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: receipt } = await supabase
    .from("finance_expense_receipts")
    .select("file_path, sector_id")
    .eq("id", receiptId)
    .single();
  if (!receipt) return { error: "Comprovante nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, receipt.sector_id, "expense", "read")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(receipt.file_path, 60);
  if (error || !data) return { error: "Nao foi possivel abrir o comprovante" };

  return { data: data.signedUrl };
}
