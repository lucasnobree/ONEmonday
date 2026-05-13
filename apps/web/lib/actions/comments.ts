"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createCommentSchema = z.object({
  cardId: z.string().uuid(),
  content: z.string().min(1, "Comentario obrigatorio").max(5000),
});

export async function createComment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createCommentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: card } = await supabase
    .from("cards")
    .select("sector_id")
    .eq("id", parsed.data.cardId)
    .single();
  if (!card) return { error: "Card nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, card.sector_id, "card_comment", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("card_comments")
    .insert({
      card_id: parsed.data.cardId,
      user_id: user.id,
      content: parsed.data.content,
    })
    .select("id, content, created_at, user_id, users(full_name, avatar_url)")
    .single();

  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: parsed.data.cardId,
    user_id: user.id,
    action: "comment_added",
    metadata: {},
  });

  revalidatePath("/");
  return { data };
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { error } = await supabase
    .from("card_comments")
    .update({ is_active: false })
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}
