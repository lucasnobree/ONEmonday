"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const assignSchema = z.object({
  ticketId: z.string().uuid(),
  userId: z.string().uuid(),
});

// Loads a ticket and verifies the caller may reassign it. Returns the
// card id used by the card_assignees table, or an error.
async function loadTicketForAssignment(ticketId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" as const };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("sector_id, card_id")
    .eq("id", ticketId)
    .single();
  if (!ticket) return { error: "Ticket não encontrado" as const };

  // 'assign' is not a seeded permission action; reassignment is gated on
  // 'ticket:update', consistent with the escalation action.
  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, ticket.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" as const };
  }

  return { supabase, user, ticket };
}

export async function assignTicket(formData: unknown) {
  const parsed = assignSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const loaded = await loadTicketForAssignment(parsed.data.ticketId);
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, user, ticket } = loaded;

  // The agent must belong to the ticket's sector.
  const { data: targetRole } = await supabase
    .from("user_sector_roles")
    .select("user_id")
    .eq("sector_id", ticket.sector_id)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!targetRole) {
    return { error: "Usuário não pertence ao setor do ticket" };
  }

  const { error } = await supabase
    .from("card_assignees")
    .upsert(
      { card_id: ticket.card_id, user_id: parsed.data.userId },
      { onConflict: "card_id,user_id", ignoreDuplicates: true }
    );
  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: ticket.card_id,
    user_id: user.id,
    action: "assignee_added",
    metadata: {},
  });

  revalidatePath("/support/tickets");
  return { success: true };
}

export async function unassignTicket(formData: unknown) {
  const parsed = assignSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const loaded = await loadTicketForAssignment(parsed.data.ticketId);
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, user, ticket } = loaded;

  const { error } = await supabase
    .from("card_assignees")
    .delete()
    .eq("card_id", ticket.card_id)
    .eq("user_id", parsed.data.userId);
  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: ticket.card_id,
    user_id: user.id,
    action: "assignee_removed",
    metadata: {},
  });

  revalidatePath("/support/tickets");
  return { success: true };
}
