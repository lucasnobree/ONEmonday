"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createCardSchema,
  updateCardSchema,
  reorderCardsSchema,
} from "@/lib/validations/cards";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createCard(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createCardSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "card", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: maxPos } = await supabase
    .from("cards")
    .select("position")
    .eq("column_id", parsed.data.columnId)
    .eq("is_active", true)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      column_id: parsed.data.columnId,
      board_id: parsed.data.boardId,
      sector_id: parsed.data.sectorId,
      created_by: user.id,
      position,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (parsed.data.assigneeIds?.length) {
    const assignees = parsed.data.assigneeIds.map((userId) => ({
      card_id: card.id,
      user_id: userId,
    }));
    await supabase.from("card_assignees").insert(assignees);
  }

  await supabase.from("card_activity_log").insert({
    card_id: card.id,
    user_id: user.id,
    action: "card_created",
    metadata: { title: card.title },
  });

  revalidatePath("/");
  return { data: card };
}

export async function updateCard(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateCardSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: card } = await supabase
    .from("cards")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();

  if (!card) return { error: "Card nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, card.sector_id, "card", "update")) {
    return { error: "Sem permissao" };
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updateData.description = parsed.data.description;
  if (parsed.data.priority !== undefined)
    updateData.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined)
    updateData.due_date = parsed.data.dueDate;

  const { error } = await supabase
    .from("cards")
    .update(updateData)
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function deleteCard(cardId: string) {
  const parsed = z.string().uuid().safeParse(cardId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: card } = await supabase
    .from("cards")
    .select("sector_id")
    .eq("id", cardId)
    .single();

  if (!card) return { error: "Card nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, card.sector_id, "card", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("cards")
    .update({ is_active: false })
    .eq("id", cardId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function reorderCards(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = reorderCardsSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: boardSectors } = await supabase
    .from("board_sectors")
    .select("sector_id")
    .eq("board_id", parsed.data.boardId);

  const perms = await getUserPermissions(user.id);
  const canMove = boardSectors?.some((bs) =>
    hasPermission(perms, bs.sector_id, "card", "move")
  );
  if (!canMove) return { error: "Sem permissao" };

  const { data, error } = await supabase.rpc("reorder_cards", {
    p_board_id: parsed.data.boardId,
    p_column_id: parsed.data.columnId,
    p_card_positions: parsed.data.cardPositions,
    p_expected_board_updated_at: parsed.data.expectedBoardUpdatedAt,
  });

  if (error) return { error: error.message };

  const result = data as {
    success: boolean;
    error?: string;
    updated_at?: string;
  };
  if (!result.success) {
    return {
      error: result.error === "conflict" ? "conflict" : "Erro ao reordenar",
    };
  }

  return { data: { updatedAt: result.updated_at } };
}
