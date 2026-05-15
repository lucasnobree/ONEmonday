"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createClauseSchema,
  updateClauseSchema,
} from "@/lib/validations/legal";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createClause(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createClauseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "clause", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: clause, error } = await supabase
    .from("legal_clauses")
    .insert({
      sector_id: parsed.data.sectorId,
      title: parsed.data.title,
      category: parsed.data.category,
      body: parsed.data.body,
      is_approved: parsed.data.isApproved,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/legal/clauses");
  return { data: clause };
}

export async function updateClause(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateClauseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("legal_clauses")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Clausula nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "clause", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("legal_clauses")
    .update({
      title: parsed.data.title,
      category: parsed.data.category,
      body: parsed.data.body,
      is_approved: parsed.data.isApproved,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/legal/clauses");
  return { success: true };
}

export async function deleteClause(clauseId: string) {
  const idParsed = z.string().uuid().safeParse(clauseId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: existing } = await supabase
    .from("legal_clauses")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Clausula nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "clause", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("legal_clauses")
    .update({ is_active: false })
    .eq("id", idParsed.data);

  if (error) return { error: error.message };

  revalidatePath("/legal/clauses");
  return { success: true };
}
