"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createProjectSchema,
  updateProjectSchema,
} from "@/lib/validations/projects";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createProject(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createProjectSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  for (const sectorId of parsed.data.sectorIds) {
    if (!hasPermission(perms, sectorId, "project", "create")) {
      return { error: "Sem permissao" };
    }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status,
      start_date: parsed.data.startDate || null,
      target_date: parsed.data.endDate || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const projectSectors = parsed.data.sectorIds.map((sectorId) => ({
    project_id: project.id,
    sector_id: sectorId,
  }));
  await supabase.from("project_sectors").insert(projectSectors);

  revalidatePath("/");
  return { data: project };
}

export async function updateProject(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateProjectSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: projectSectors } = await supabase
    .from("project_sectors")
    .select("sector_id")
    .eq("project_id", parsed.data.id);

  const perms = await getUserPermissions(user.id);
  const canUpdate = projectSectors?.some((ps) =>
    hasPermission(perms, ps.sector_id, "project", "update")
  );
  if (!canUpdate) return { error: "Sem permissao" };

  // Only write fields the caller actually supplied so a partial update never
  // clobbers an unrelated column with `undefined`.
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined)
    updateData.description = parsed.data.description || null;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.health !== undefined) updateData.health = parsed.data.health;
  if (parsed.data.statusNote !== undefined)
    updateData.status_note = parsed.data.statusNote || null;
  if (parsed.data.startDate !== undefined)
    updateData.start_date = parsed.data.startDate || null;
  if (parsed.data.endDate !== undefined)
    updateData.target_date = parsed.data.endDate || null;

  if (Object.keys(updateData).length === 0) {
    return { error: "Nenhuma alteracao informada" };
  }

  const { error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

/**
 * Links an existing card to a project (`project_cards` join row). The card
 * must belong to a sector the project is in, so a project never collects
 * cards from sectors its members cannot see. Idempotent: a duplicate link
 * is treated as success.
 */
export async function linkProjectCard(formData: unknown) {
  const parsed = z
    .object({ projectId: z.string().uuid(), cardId: z.string().uuid() })
    .safeParse(formData);
  if (!parsed.success) return { error: "Dados invalidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: projectSectors } = await supabase
    .from("project_sectors")
    .select("sector_id")
    .eq("project_id", parsed.data.projectId);

  const perms = await getUserPermissions(user.id);
  const canUpdate = projectSectors?.some((ps) =>
    hasPermission(perms, ps.sector_id, "project", "update")
  );
  if (!canUpdate) return { error: "Sem permissao" };

  const { data: card } = await supabase
    .from("cards")
    .select("sector_id")
    .eq("id", parsed.data.cardId)
    .eq("is_active", true)
    .single();
  if (!card) return { error: "Card nao encontrado" };

  const projectSectorIds = new Set(
    (projectSectors ?? []).map((ps) => ps.sector_id)
  );
  if (!projectSectorIds.has(card.sector_id)) {
    return { error: "O card pertence a um setor fora deste projeto" };
  }

  const { error } = await supabase.from("project_cards").upsert(
    { project_id: parsed.data.projectId, card_id: parsed.data.cardId },
    { onConflict: "project_id,card_id", ignoreDuplicates: true }
  );
  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

/** Removes a card from a project. */
export async function unlinkProjectCard(formData: unknown) {
  const parsed = z
    .object({ projectId: z.string().uuid(), cardId: z.string().uuid() })
    .safeParse(formData);
  if (!parsed.success) return { error: "Dados invalidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: projectSectors } = await supabase
    .from("project_sectors")
    .select("sector_id")
    .eq("project_id", parsed.data.projectId);

  const perms = await getUserPermissions(user.id);
  const canUpdate = projectSectors?.some((ps) =>
    hasPermission(perms, ps.sector_id, "project", "update")
  );
  if (!canUpdate) return { error: "Sem permissao" };

  const { error } = await supabase
    .from("project_cards")
    .delete()
    .eq("project_id", parsed.data.projectId)
    .eq("card_id", parsed.data.cardId);
  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function deleteProject(projectId: string) {
  try {
    z.string().uuid().parse(projectId);
  } catch {
    return { error: "Dados invalidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: projectSectors } = await supabase
    .from("project_sectors")
    .select("sector_id")
    .eq("project_id", projectId);

  const perms = await getUserPermissions(user.id);
  const canDelete = projectSectors?.some((ps) =>
    hasPermission(perms, ps.sector_id, "project", "delete")
  );
  if (!canDelete) return { error: "Sem permissao" };

  const { error } = await supabase
    .from("projects")
    .update({ is_active: false })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
