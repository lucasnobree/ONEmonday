"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createTicketSchema,
  submitCSATSchema,
} from "@/lib/validations/support";
import {
  isSlaBreached,
  computeResponseBreachOnResolve,
} from "@/lib/support/sla";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createTicket(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createTicketSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "ticket", "create")) {
    return { error: "Sem permissão" };
  }

  // Auto-detect support board and first column if not provided
  let boardId = parsed.data.boardId;
  let columnId = parsed.data.columnId;

  if (!boardId) {
    const { data: board } = await supabase
      .from("boards")
      .select("id")
      .eq("sector_id", parsed.data.sectorId)
      .eq("board_type", "support_tickets")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!board) {
      // Create default support board with columns
      const { data: newBoard, error: boardErr } = await supabase
        .from("boards")
        .insert({
          name: "Tickets",
          sector_id: parsed.data.sectorId,
          board_type: "support_tickets",
          visibility: "sector",
          created_by: user.id,
        })
        .select()
        .single();
      if (boardErr) return { error: boardErr.message };
      boardId = newBoard.id;

      const columns = ["Aberto", "Em Andamento", "Aguardando", "Resolvido"];
      const { data: cols } = await supabase
        .from("board_columns")
        .insert(
          columns.map((name, i) => ({
            board_id: newBoard.id,
            name,
            position: i,
            is_done_column: name === "Resolvido",
          }))
        )
        .select("id")
        .order("position");
      columnId = cols?.[0]?.id || "";
    } else {
      boardId = board.id;
    }
  }

  if (!columnId) {
    const { data: firstCol } = await supabase
      .from("board_columns")
      .select("id")
      .eq("board_id", boardId)
      .order("position")
      .limit(1)
      .single();
    if (!firstCol) return { error: "Board sem colunas configuradas" };
    columnId = firstCol.id;
  }

  // Create the card first
  const { data: maxPos } = await supabase
    .from("cards")
    .select("position")
    .eq("column_id", columnId)
    .eq("is_active", true)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      column_id: columnId,
      board_id: boardId,
      sector_id: parsed.data.sectorId,
      created_by: user.id,
      position,
    })
    .select()
    .single();

  if (cardError) return { error: cardError.message };

  // Create the support ticket linked to the card
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      card_id: card.id,
      sector_id: parsed.data.sectorId,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory || null,
      channel: parsed.data.channel,
      requester_id: parsed.data.requesterId || user.id,
      requester_email: parsed.data.requesterEmail || null,
    })
    .select()
    .single();

  if (ticketError) return { error: ticketError.message };

  await supabase.from("card_activity_log").insert({
    card_id: card.id,
    user_id: user.id,
    action: "card_created",
    metadata: { title: card.title, ticket_id: ticket.id },
  });

  revalidatePath("/");
  return { data: { ...ticket, card } };
}

export async function markFirstResponse(ticketId: string) {
  const parsed = z.string().uuid().safeParse(ticketId);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("sector_id, card_id, first_response_at, sla_response_due_at")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: "Ticket não encontrado" };

  // Idempotent: the first response timestamp is only ever set once.
  if (ticket.first_response_at) {
    return { success: true, alreadyMarked: true };
  }

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, ticket.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  const now = new Date();
  // The response SLA is breached if the first reply lands after its deadline.
  const responseBreached = isSlaBreached(ticket.sla_response_due_at, now);

  const { error } = await supabase
    .from("support_tickets")
    .update({
      first_response_at: now.toISOString(),
      sla_response_breached: responseBreached,
    })
    .eq("id", ticketId);

  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: ticket.card_id,
    user_id: user.id,
    action: "status_changed",
    metadata: { title: "Primeira resposta registrada" },
  });

  revalidatePath("/");
  return { success: true };
}

export async function resolveTicket(ticketId: string) {
  const parsed = z.string().uuid().safeParse(ticketId);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select(
      "sector_id, card_id, first_response_at, sla_response_due_at, sla_resolve_due_at, sla_response_breached"
    )
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: "Ticket não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, ticket.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  // Compute SLA breach flags at resolution time so the dashboard counts
  // and SLA compliance RPC stay accurate (previously never recomputed).
  const now = new Date();
  const resolveBreached = isSlaBreached(ticket.sla_resolve_due_at, now);
  // A ticket resolved with no recorded first response also missed the
  // response SLA if a response deadline existed.
  const responseBreached = computeResponseBreachOnResolve({
    alreadyBreached: ticket.sla_response_breached,
    firstResponseAt: ticket.first_response_at,
    responseDueAt: ticket.sla_response_due_at,
    at: now,
  });

  // Mark ticket as resolved
  const { error: ticketError } = await supabase
    .from("support_tickets")
    .update({
      resolved_at: now.toISOString(),
      sla_resolve_breached: resolveBreached,
      sla_response_breached: responseBreached,
    })
    .eq("id", ticketId);

  if (ticketError) return { error: ticketError.message };

  // Move card to done column
  const { data: card } = await supabase
    .from("cards")
    .select("board_id")
    .eq("id", ticket.card_id)
    .single();

  if (card) {
    const { data: doneColumn } = await supabase
      .from("board_columns")
      .select("id")
      .eq("board_id", card.board_id)
      .eq("is_done_column", true)
      .limit(1)
      .single();

    if (doneColumn) {
      await supabase
        .from("cards")
        .update({ column_id: doneColumn.id })
        .eq("id", ticket.card_id);
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function reopenTicket(ticketId: string) {
  const parsed = z.string().uuid().safeParse(ticketId);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("sector_id, card_id, resolved_at")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: "Ticket não encontrado" };
  if (!ticket.resolved_at) return { error: "Ticket ja esta aberto" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, ticket.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  // Clear the resolution timestamp.
  const { error: ticketError } = await supabase
    .from("support_tickets")
    .update({ resolved_at: null })
    .eq("id", ticketId);

  if (ticketError) return { error: ticketError.message };

  // Move the card off the done column back to the first column.
  const { data: card } = await supabase
    .from("cards")
    .select("board_id")
    .eq("id", ticket.card_id)
    .single();

  if (card) {
    const { data: firstColumn } = await supabase
      .from("board_columns")
      .select("id")
      .eq("board_id", card.board_id)
      .eq("is_done_column", false)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstColumn) {
      await supabase
        .from("cards")
        .update({ column_id: firstColumn.id })
        .eq("id", ticket.card_id);
    }
  }

  await supabase.from("card_activity_log").insert({
    card_id: ticket.card_id,
    user_id: user.id,
    action: "status_changed",
    metadata: { title: "Ticket reaberto" },
  });

  revalidatePath("/");
  return { success: true };
}

export async function submitCSAT(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = submitCSATSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("sector_id")
    .eq("id", parsed.data.ticketId)
    .single();

  if (!ticket) return { error: "Ticket não encontrado" };

  const { error } = await supabase
    .from("support_tickets")
    .update({
      csat_rating: parsed.data.rating,
      csat_comment: parsed.data.comment || null,
    })
    .eq("id", parsed.data.ticketId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
