"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["lead", "member"]).default("member"),
});

const removeMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});

/** Resolves the sectors a project belongs to. */
async function projectSectorIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("project_sectors")
    .select("sector_id")
    .eq("project_id", projectId);
  return (data ?? []).map((ps) => ps.sector_id);
}

/**
 * Adds a user to a project's roster. Membership is informational only — it
 * does NOT grant access (sector RLS still governs that). Idempotent: a
 * duplicate add updates the role.
 */
export async function addProjectMember(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = addMemberSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const sectorIds = await projectSectorIds(supabase, parsed.data.projectId);
  const perms = await getUserPermissions(user.id);
  const canManage = sectorIds.some((id) =>
    hasPermission(perms, id, "project", "update")
  );
  if (!canManage) return { error: "Sem permissao" };

  const { error } = await supabase.from("project_members").upsert(
    {
      project_id: parsed.data.projectId,
      user_id: parsed.data.userId,
      role: parsed.data.role,
      added_by: user.id,
    },
    { onConflict: "project_id,user_id" }
  );
  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

/** Removes a user from a project's roster. */
export async function removeProjectMember(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = removeMemberSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const sectorIds = await projectSectorIds(supabase, parsed.data.projectId);
  const perms = await getUserPermissions(user.id);
  const canManage = sectorIds.some((id) =>
    hasPermission(perms, id, "project", "update")
  );
  if (!canManage) return { error: "Sem permissao" };

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", parsed.data.projectId)
    .eq("user_id", parsed.data.userId);
  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
