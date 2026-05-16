"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createArticleSchema } from "@/lib/validations/support";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createKBArticle(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createArticleSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "kb_article", "create")) {
    return { error: "Sem permissão" };
  }

  const { data, error } = await supabase
    .from("kb_articles")
    .insert({
      sector_id: parsed.data.sectorId,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      tags: parsed.data.tags,
      author_id: user.id,
      is_published: parsed.data.isPublished,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/support/knowledge-base");
  return { data };
}

export async function updateKBArticle(id: string, formData: unknown) {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createArticleSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("kb_articles")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Artigo não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "kb_article", "update")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("kb_articles")
    .update({
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      tags: parsed.data.tags,
      is_published: parsed.data.isPublished,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/support/knowledge-base");
  return { success: true };
}

export async function deleteKBArticle(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: article } = await supabase
    .from("kb_articles")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!article) return { error: "Artigo não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, article.sector_id, "kb_article", "delete")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("kb_articles")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/support/knowledge-base");
  return { success: true };
}

export async function toggleKBArticlePublished(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: article } = await supabase
    .from("kb_articles")
    .select("sector_id, is_published")
    .eq("id", id)
    .single();

  if (!article) return { error: "Artigo não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, article.sector_id, "kb_article", "update")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("kb_articles")
    .update({ is_published: !article.is_published })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/support/knowledge-base");
  return { success: true, is_published: !article.is_published };
}
