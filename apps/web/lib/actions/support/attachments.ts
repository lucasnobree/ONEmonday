"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createTicketAttachmentSchema } from "@/lib/validations/support";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SUPPORT_BUCKET = "support-attachments";

/**
 * Record a file already uploaded to the support-attachments storage bucket
 * against a ticket. Requires ticket:update on the ticket's sector.
 */
export async function createTicketAttachment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createTicketAttachmentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("sector_id, card_id")
    .eq("id", parsed.data.ticketId)
    .single();
  if (!ticket) return { error: "Ticket não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, ticket.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  const { data, error } = await supabase
    .from("support_ticket_attachments")
    .insert({
      ticket_id: parsed.data.ticketId,
      file_path: parsed.data.filePath,
      file_name: parsed.data.fileName,
      file_size: parsed.data.fileSize,
      mime_type: parsed.data.mimeType ?? null,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: ticket.card_id,
    user_id: user.id,
    action: "attachment_added",
    metadata: { file_name: parsed.data.fileName },
  });

  revalidatePath("/");
  return { data };
}

/**
 * Remove a ticket attachment record and its underlying storage object.
 * Requires ticket:update on the ticket's sector.
 */
export async function deleteTicketAttachment(attachmentId: string) {
  const parsedId = z.string().uuid().safeParse(attachmentId);
  if (!parsedId.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: attachment } = await supabase
    .from("support_ticket_attachments")
    .select("file_path, support_tickets(sector_id)")
    .eq("id", attachmentId)
    .single();
  if (!attachment) return { error: "Anexo não encontrado" };

  const sectorId = (
    attachment as { support_tickets?: { sector_id?: string } | null }
  ).support_tickets?.sector_id;
  if (!sectorId) return { error: "Anexo inválido" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("support_ticket_attachments")
    .delete()
    .eq("id", attachmentId);
  if (error) return { error: error.message };

  if (attachment.file_path) {
    await supabase.storage.from(SUPPORT_BUCKET).remove([attachment.file_path]);
  }

  revalidatePath("/");
  return { success: true };
}
