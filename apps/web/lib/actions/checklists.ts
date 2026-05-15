"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createChecklistSchema = z.object({
  cardId: z.string().uuid(),
  title: z.string().min(1).max(200),
});

const createChecklistItemSchema = z.object({
  checklistId: z.string().uuid(),
  content: z.string().min(1).max(500),
});

/** Shape of the nested join used to resolve a checklist's owning sector. */
type ChecklistWithCard = {
  card_id: string;
  cards: { sector_id: string } | null;
};

/** Shape of the nested join used to resolve a checklist item's sector. */
type ItemWithChecklist = {
  checklist_id: string;
  card_checklists: {
    card_id: string;
    cards: { sector_id: string } | null;
  } | null;
};

export async function createChecklist(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createChecklistSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: card } = await supabase
    .from("cards")
    .select("sector_id")
    .eq("id", parsed.data.cardId)
    .single();
  if (!card) return { error: "Card nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, card.sector_id, "card_checklist", "create"))
    return { error: "Sem permissao" };

  const { data: maxPos } = await supabase
    .from("card_checklists")
    .select("position")
    .eq("card_id", parsed.data.cardId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from("card_checklists")
    .insert({
      card_id: parsed.data.cardId,
      title: parsed.data.title,
      position: (maxPos?.position ?? -1) + 1,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/");
  return { data };
}

export async function createChecklistItem(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createChecklistItemSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: checklist } = await supabase
    .from("card_checklists")
    .select("card_id, cards(sector_id)")
    .eq("id", parsed.data.checklistId)
    .single<ChecklistWithCard>();
  if (!checklist) return { error: "Checklist nao encontrada" };

  const sectorId = checklist.cards?.sector_id;
  if (!sectorId) return { error: "Card nao encontrado" };
  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "card_checklist", "update"))
    return { error: "Sem permissao" };

  const { data: maxPos } = await supabase
    .from("checklist_items")
    .select("position")
    .eq("checklist_id", parsed.data.checklistId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      checklist_id: parsed.data.checklistId,
      content: parsed.data.content,
      position: (maxPos?.position ?? -1) + 1,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/");
  return { data };
}

export async function toggleChecklistItem(
  itemId: string,
  isCompleted: boolean
) {
  const parsedId = z.string().uuid().safeParse(itemId);
  if (!parsedId.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: item } = await supabase
    .from("checklist_items")
    .select("checklist_id, card_checklists(card_id, cards(sector_id))")
    .eq("id", itemId)
    .single<ItemWithChecklist>();
  if (!item) return { error: "Item nao encontrado" };

  const sectorId = item.card_checklists?.cards?.sector_id;
  if (!sectorId) return { error: "Card nao encontrado" };
  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "card_checklist", "update"))
    return { error: "Sem permissao" };

  const { error } = await supabase
    .from("checklist_items")
    .update({
      is_completed: isCompleted,
      completed_by: isCompleted ? user.id : null,
    })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function deleteChecklist(checklistId: string) {
  const parsedId = z.string().uuid().safeParse(checklistId);
  if (!parsedId.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: checklist } = await supabase
    .from("card_checklists")
    .select("card_id, cards(sector_id)")
    .eq("id", checklistId)
    .single<ChecklistWithCard>();
  if (!checklist) return { error: "Checklist nao encontrada" };

  const sectorId = checklist.cards?.sector_id;
  if (!sectorId) return { error: "Card nao encontrado" };
  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "card_checklist", "delete"))
    return { error: "Sem permissao" };

  const { error } = await supabase
    .from("card_checklists")
    .delete()
    .eq("id", checklistId);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

/** Deletes a single checklist item. Requires card_checklist:update. */
export async function deleteChecklistItem(itemId: string) {
  const parsedId = z.string().uuid().safeParse(itemId);
  if (!parsedId.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: item } = await supabase
    .from("checklist_items")
    .select("checklist_id, card_checklists(card_id, cards(sector_id))")
    .eq("id", itemId)
    .single<ItemWithChecklist>();
  if (!item) return { error: "Item nao encontrado" };

  const sectorId = item.card_checklists?.cards?.sector_id;
  if (!sectorId) return { error: "Card nao encontrado" };
  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "card_checklist", "update"))
    return { error: "Sem permissao" };

  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}
