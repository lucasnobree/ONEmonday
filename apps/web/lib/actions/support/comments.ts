"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addCommentSchema = z.object({
  cardId: z.string().uuid(),
  content: z.string().min(1, "Comentario obrigatorio").max(5000),
});

export async function addTicketComment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = addCommentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: card } = await supabase
    .from("cards")
    .select("sector_id")
    .eq("id", parsed.data.cardId)
    .single();
  if (!card) return { error: "Card não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, card.sector_id, "card_comment", "create")) {
    return { error: "Sem permissão" };
  }

  const { data, error } = await supabase
    .from("card_comments")
    .insert({
      card_id: parsed.data.cardId,
      user_id: user.id,
      content: parsed.data.content,
    })
    .select("id, content, created_at, user_id, users(full_name)")
    .single();

  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: parsed.data.cardId,
    user_id: user.id,
    action: "comment_added",
    metadata: {},
  });

  // Auto-record the first agent response: stamp first_response_at and
  // compute the response SLA breach flag the first time someone replies.
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, first_response_at, sla_response_due_at")
    .eq("card_id", parsed.data.cardId)
    .maybeSingle();

  if (ticket && !ticket.first_response_at) {
    const now = new Date();
    const responseBreached = ticket.sla_response_due_at
      ? now > new Date(ticket.sla_response_due_at)
      : false;
    await supabase
      .from("support_tickets")
      .update({
        first_response_at: now.toISOString(),
        sla_response_breached: responseBreached,
      })
      .eq("id", ticket.id);
  }

  revalidatePath("/");
  return { data };
}
