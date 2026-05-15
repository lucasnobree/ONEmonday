"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createDeploymentSchema,
  updateDeploymentSchema,
} from "@/lib/validations/dev-tools";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Maps the parsed/validated deployment form into a DB row payload. */
function toRow(data: z.infer<typeof createDeploymentSchema>) {
  return {
    service_id: data.serviceId,
    version: data.version,
    environment: data.environment,
    status: data.status,
    notes: data.notes || null,
  };
}

export async function createDeployment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createDeploymentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "deployment", "create")) {
    return { error: "Sem permissao" };
  }

  // Guard: the referenced service must belong to the same sector.
  const { data: service } = await supabase
    .from("dev_services")
    .select("sector_id")
    .eq("id", parsed.data.serviceId)
    .single();
  if (!service || service.sector_id !== parsed.data.sectorId) {
    return { error: "Servico invalido para este setor" };
  }

  const { data: deployment, error } = await supabase
    .from("dev_deployments")
    .insert({
      sector_id: parsed.data.sectorId,
      deployed_by: user.id,
      ...toRow(parsed.data),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/deployments");
  return { data: deployment };
}

export async function updateDeployment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateDeploymentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("dev_deployments")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Deploy nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "deployment", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("dev_deployments")
    .update(toRow(parsed.data))
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/deployments");
  return { success: true };
}

export async function deleteDeployment(deploymentId: string) {
  const idParsed = z.string().uuid().safeParse(deploymentId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: existing } = await supabase
    .from("dev_deployments")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Deploy nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "deployment", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("dev_deployments")
    .delete()
    .eq("id", idParsed.data);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/deployments");
  return { success: true };
}
