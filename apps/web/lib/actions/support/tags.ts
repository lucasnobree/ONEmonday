"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createTagSchema, tagAssignmentSchema } from "@/lib/validations/support";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Create a tag in a sector's tag vocabulary. If a tag with the same
// (normalized) name already exists it is returned instead of erroring.
export async function createTicketTag(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createTagSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  const { data: existing } = await supabase
    .from("ticket_tags")
    .select("id, name, color")
    .eq("sector_id", parsed.data.sectorId)
    .eq("name", parsed.data.name)
    .maybeSingle();

  if (existing) {
    return { data: existing };
  }

  const { data, error } = await supabase
    .from("ticket_tags")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      color: parsed.data.color,
      created_by: user.id,
    })
    .select("id, name, color")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/support/tickets");
  return { data };
}

export async function deleteTicketTag(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: tag } = await supabase
    .from("ticket_tags")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!tag) return { error: "Tag não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, tag.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  // ON DELETE CASCADE on support_ticket_tags removes the links too.
  const { error } = await supabase.from("ticket_tags").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/support/tickets");
  return { success: true };
}

export async function addTagToTicket(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = tagAssignmentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("sector_id")
    .eq("id", parsed.data.ticketId)
    .single();
  if (!ticket) return { error: "Ticket não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, ticket.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("support_ticket_tags")
    .upsert(
      { ticket_id: parsed.data.ticketId, tag_id: parsed.data.tagId },
      { onConflict: "ticket_id,tag_id", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };

  revalidatePath("/support/tickets");
  return { success: true };
}

export async function removeTagFromTicket(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = tagAssignmentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("sector_id")
    .eq("id", parsed.data.ticketId)
    .single();
  if (!ticket) return { error: "Ticket não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, ticket.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("support_ticket_tags")
    .delete()
    .eq("ticket_id", parsed.data.ticketId)
    .eq("tag_id", parsed.data.tagId);

  if (error) return { error: error.message };

  revalidatePath("/support/tickets");
  return { success: true };
}
