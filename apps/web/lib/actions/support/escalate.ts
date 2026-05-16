"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const escalateSchema = z.object({
  ticketId: z.string().uuid(),
  toSectorId: z.string().uuid(),
  reason: z.string().min(1, "Motivo e obrigatorio"),
});

export async function escalateTicket(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = escalateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

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

  const { error: updateError } = await supabase
    .from("support_tickets")
    .update({
      escalated_to_sector_id: parsed.data.toSectorId,
      escalated_at: new Date().toISOString(),
      escalated_by: user.id,
      escalation_reason: parsed.data.reason,
    })
    .eq("id", parsed.data.ticketId);

  if (updateError) return { error: updateError.message };

  const { error: logError } = await supabase
    .from("ticket_escalation_log")
    .insert({
      ticket_id: parsed.data.ticketId,
      from_sector_id: ticket.sector_id,
      to_sector_id: parsed.data.toSectorId,
      escalated_by: user.id,
      reason: parsed.data.reason,
    });

  if (logError) return { error: logError.message };

  revalidatePath("/support/tickets");
  revalidatePath("/support");
  return { success: true };
}
