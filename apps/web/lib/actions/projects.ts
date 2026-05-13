"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createProjectSchema,
  updateProjectSchema,
} from "@/lib/validations/projects";
import { revalidatePath } from "next/cache";

export async function createProject(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createProjectSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorIds[0], "project", "create")) {
    return { error: "Sem permissao" };
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

  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status,
      start_date: parsed.data.startDate,
      target_date: parsed.data.endDate,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function deleteProject(projectId: string) {
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
