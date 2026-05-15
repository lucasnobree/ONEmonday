"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createAttachmentSchema = z.object({
  cardId: z.string().uuid(),
  fileUrl: z.string().min(1),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
});

export async function createAttachment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createAttachmentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: card } = await supabase
    .from("cards")
    .select("sector_id")
    .eq("id", parsed.data.cardId)
    .single();
  if (!card) return { error: "Card nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, card.sector_id, "card_attachment", "create"))
    return { error: "Sem permissao" };

  const { data, error } = await supabase
    .from("card_attachments")
    .insert({
      card_id: parsed.data.cardId,
      file_url: parsed.data.fileUrl,
      file_name: parsed.data.fileName,
      file_size: parsed.data.fileSize,
      mime_type: parsed.data.mimeType,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: parsed.data.cardId,
    user_id: user.id,
    action: "attachment_added",
    metadata: { file_name: parsed.data.fileName },
  });

  revalidatePath("/");
  return { data };
}

export async function deleteAttachment(attachmentId: string) {
  const parsedId = z.string().uuid().safeParse(attachmentId);
  if (!parsedId.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: attachment } = await supabase
    .from("card_attachments")
    .select("file_url, card_id, cards(sector_id)")
    .eq("id", attachmentId)
    .single();
  if (!attachment) return { error: "Anexo nao encontrado" };

  const sectorId = (attachment as { cards?: { sector_id?: string } | null })
    .cards?.sector_id;
  if (!sectorId) return { error: "Anexo invalido" };
  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "card_attachment", "delete"))
    return { error: "Sem permissao" };

  const { error } = await supabase
    .from("card_attachments")
    .delete()
    .eq("id", attachmentId);
  if (error) return { error: error.message };

  if (attachment.file_url) {
    await supabase.storage
      .from("card-attachments")
      .remove([attachment.file_url]);
  }

  revalidatePath("/");
  return { success: true };
}
