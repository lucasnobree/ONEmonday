"use server";

/**
 * Matter comment-thread server actions (Wave 4 audit M1).
 *
 * A legal matter is a back-and-forth between the requester and the legal team;
 * these actions back the comment thread on the matter detail sheet. RLS on
 * `legal_matter_comments` (migration 00201) is the real access gate — these
 * actions add the friendly error messages and `revalidatePath`.
 */

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createMatterCommentSchema,
  updateMatterCommentSchema,
} from "@/lib/validations/legal";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createMatterComment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createMatterCommentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: matter } = await supabase
    .from("legal_matters")
    .select("sector_id")
    .eq("id", parsed.data.matterId)
    .single();
  if (!matter) return { error: "Demanda não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, matter.sector_id, "legal_matter", "update")) {
    return { error: "Sem permissão" };
  }

  const { data: comment, error } = await supabase
    .from("legal_matter_comments")
    .insert({
      matter_id: parsed.data.matterId,
      sector_id: matter.sector_id,
      body: parsed.data.body.trim(),
      author_id: user.id,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  revalidatePath("/legal/matters");
  return { data: comment };
}

export async function updateMatterComment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = updateMatterCommentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("legal_matter_comments")
    .select("author_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Comentário não encontrado" };
  if (existing.author_id !== user.id) {
    return { error: "Só o autor pode editar o comentário" };
  }

  const { error } = await supabase
    .from("legal_matter_comments")
    .update({ body: parsed.data.body.trim() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/legal/matters");
  return { success: true };
}

export async function deleteMatterComment(commentId: string) {
  const idParsed = z.string().uuid().safeParse(commentId);
  if (!idParsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: existing } = await supabase
    .from("legal_matter_comments")
    .select("author_id, sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Comentário não encontrado" };

  // The author may always delete their own comment; otherwise a moderator
  // (holding `legal_matter` delete) may remove it.
  if (existing.author_id !== user.id) {
    const perms = await getUserPermissions(user.id);
    if (!hasPermission(perms, existing.sector_id, "legal_matter", "delete")) {
      return { error: "Sem permissão" };
    }
  }

  const { error } = await supabase
    .from("legal_matter_comments")
    .delete()
    .eq("id", idParsed.data);
  if (error) return { error: error.message };

  revalidatePath("/legal/matters");
  return { success: true };
}
