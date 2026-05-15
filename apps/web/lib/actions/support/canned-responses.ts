"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createCannedResponseSchema } from "@/lib/validations/support";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createCannedResponse(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createCannedResponseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "canned_response", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("canned_responses")
    .insert({
      sector_id: parsed.data.sectorId,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category || null,
      shortcut: parsed.data.shortcut || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/support/canned-responses");
  return { data };
}

export async function updateCannedResponse(id: string, formData: unknown) {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createCannedResponseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("canned_responses")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Resposta nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "canned_response", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("canned_responses")
    .update({
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category || null,
      shortcut: parsed.data.shortcut || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/support/canned-responses");
  return { success: true };
}

export async function deleteCannedResponse(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: response } = await supabase
    .from("canned_responses")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!response) return { error: "Resposta nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, response.sector_id, "canned_response", "delete")) {
    return { error: "Sem permissao" };
  }

  // Soft delete to keep historical references intact.
  const { error } = await supabase
    .from("canned_responses")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/support/canned-responses");
  return { success: true };
}
