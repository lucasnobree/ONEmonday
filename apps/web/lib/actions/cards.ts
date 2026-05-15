"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createCardSchema,
  updateCardSchema,
  reorderCardsSchema,
  setCardTagsSchema,
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

  // Fast-path WIP-limit check for a friendly message in the common case.
  // The race-free guarantee is the `enforce_card_wip_limit` BEFORE INSERT
  // trigger (migration 00017); this check just avoids the raw DB error.
  const { data: column } = await supabase
    .from("board_columns")
    .select("wip_limit")
    .eq("id", parsed.data.columnId)
    .single();

  if (column?.wip_limit != null) {
    const { count } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("column_id", parsed.data.columnId)
      .eq("is_active", true);
    if ((count ?? 0) >= column.wip_limit) {
      return {
        error: `Limite de ${column.wip_limit} cards atingido nesta coluna`,
      };
    }
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

  if (error) {
    // The WIP-limit trigger fires when a concurrent insert won the race.
    if (error.message.includes("WIP_LIMIT_EXCEEDED")) {
      return { error: "Limite de cards desta coluna atingido" };
    }
    return { error: error.message };
  }

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
    .select("sector_id, title")
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
    updateData.description = parsed.data.description || null;
  if (parsed.data.priority !== undefined)
    updateData.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined)
    updateData.due_date = parsed.data.dueDate || null;

  if (Object.keys(updateData).length === 0) {
    return { error: "Nenhuma alteracao informada" };
  }

  const { error } = await supabase
    .from("cards")
    .update(updateData)
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: parsed.data.id,
    user_id: user.id,
    action: "card_updated",
    metadata: { fields: Object.keys(updateData) },
  });

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

/**
 * Replaces the full set of tags on a card. Tags must belong to the card's
 * sector (or be global, sector_id NULL); any tag failing that check is
 * rejected so a caller cannot attach another sector's tags.
 */
export async function setCardTags(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = setCardTagsSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: card } = await supabase
    .from("cards")
    .select("sector_id")
    .eq("id", parsed.data.cardId)
    .single();
  if (!card) return { error: "Card nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, card.sector_id, "card", "update")) {
    return { error: "Sem permissao" };
  }

  if (parsed.data.tagIds.length > 0) {
    const { data: validTags } = await supabase
      .from("tags")
      .select("id")
      .in("id", parsed.data.tagIds)
      .eq("is_active", true)
      .or(`sector_id.eq.${card.sector_id},sector_id.is.null`);

    const validIds = new Set((validTags ?? []).map((t) => t.id));
    if (validIds.size !== parsed.data.tagIds.length) {
      return { error: "Tag invalida para este setor" };
    }
  }

  // Replace the set: clear then re-insert.
  const { error: delError } = await supabase
    .from("card_tags")
    .delete()
    .eq("card_id", parsed.data.cardId);
  if (delError) return { error: delError.message };

  if (parsed.data.tagIds.length > 0) {
    const rows = parsed.data.tagIds.map((tagId) => ({
      card_id: parsed.data.cardId,
      tag_id: tagId,
    }));
    const { error: insError } = await supabase.from("card_tags").insert(rows);
    if (insError) return { error: insError.message };
  }

  revalidatePath("/");
  return { success: true };
}
