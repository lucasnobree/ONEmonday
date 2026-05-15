"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
} from "@/lib/validations/dev-tools";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Maps the parsed/validated flag form into a DB row payload. */
function toRow(data: z.infer<typeof createFeatureFlagSchema>) {
  return {
    service_id: data.serviceId || null,
    key: data.key,
    description: data.description || null,
    environment: data.environment,
    is_enabled: data.isEnabled,
    rollout_percentage: data.rolloutPercentage,
    owner_id: data.ownerId || null,
  };
}

export async function createFeatureFlag(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createFeatureFlagSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "feature_flag", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: flag, error } = await supabase
    .from("dev_feature_flags")
    .insert({
      sector_id: parsed.data.sectorId,
      created_by: user.id,
      ...toRow(parsed.data),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/feature-flags");
  return { data: flag };
}

export async function updateFeatureFlag(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateFeatureFlagSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("dev_feature_flags")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Flag nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "feature_flag", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("dev_feature_flags")
    .update(toRow(parsed.data))
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/feature-flags");
  return { success: true };
}

/** Quick on/off toggle used by the flag list switch. */
export async function toggleFeatureFlag(flagId: string, isEnabled: boolean) {
  const idParsed = z.string().uuid().safeParse(flagId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: existing } = await supabase
    .from("dev_feature_flags")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Flag nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "feature_flag", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("dev_feature_flags")
    .update({ is_enabled: isEnabled })
    .eq("id", idParsed.data);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/feature-flags");
  return { success: true };
}

export async function deleteFeatureFlag(flagId: string) {
  const idParsed = z.string().uuid().safeParse(flagId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: existing } = await supabase
    .from("dev_feature_flags")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Flag nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "feature_flag", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("dev_feature_flags")
    .update({ is_active: false })
    .eq("id", idParsed.data);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/feature-flags");
  return { success: true };
}
