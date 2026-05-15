"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createServiceSchema,
  updateServiceSchema,
} from "@/lib/validations/dev-tools";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Maps the parsed/validated service form into a DB row payload. */
function toRow(data: z.infer<typeof createServiceSchema>) {
  return {
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    environment: data.environment,
    criticality: data.criticality,
    health: data.health,
    repository_url: data.repositoryUrl || null,
  };
}

export async function createService(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createServiceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "service", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: service, error } = await supabase
    .from("dev_services")
    .insert({
      sector_id: parsed.data.sectorId,
      created_by: user.id,
      ...toRow(parsed.data),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/services");
  return { data: service };
}

export async function updateService(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateServiceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("dev_services")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Servico nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "service", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("dev_services")
    .update(toRow(parsed.data))
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/services");
  return { success: true };
}

export async function deleteService(serviceId: string) {
  const idParsed = z.string().uuid().safeParse(serviceId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: existing } = await supabase
    .from("dev_services")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Servico nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "service", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("dev_services")
    .update({ is_active: false })
    .eq("id", idParsed.data);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/services");
  return { success: true };
}
