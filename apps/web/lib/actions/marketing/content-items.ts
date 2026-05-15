"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createContentItemSchema,
  updateContentItemSchema,
} from "@/lib/validations/marketing";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createContentItem(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createContentItemSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "content_item", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("marketing_content_items")
    .insert({
      sector_id: parsed.data.sectorId,
      campaign_id: parsed.data.campaignId || null,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      channel: parsed.data.channel,
      status: parsed.data.status,
      scheduled_date: parsed.data.scheduledDate,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { data };
}

export async function updateContentItem(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateContentItemSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("marketing_content_items")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Conteudo nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "content_item", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_content_items")
    .update({
      campaign_id: parsed.data.campaignId || null,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      channel: parsed.data.channel,
      status: parsed.data.status,
      scheduled_date: parsed.data.scheduledDate,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { success: true };
}

export async function deleteContentItem(itemId: string) {
  const parsed = z.string().uuid().safeParse(itemId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: item } = await supabase
    .from("marketing_content_items")
    .select("sector_id")
    .eq("id", itemId)
    .single();
  if (!item) return { error: "Conteudo nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, item.sector_id, "content_item", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_content_items")
    .update({ is_active: false })
    .eq("id", itemId);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { success: true };
}
