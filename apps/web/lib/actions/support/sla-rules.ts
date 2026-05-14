"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createSLARuleSchema } from "@/lib/validations/support";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createSlaRule(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createSLARuleSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "sla_rule", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("sla_rules")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      priority: parsed.data.priority,
      category: parsed.data.category || null,
      response_time_hours: parsed.data.responseTimeHours,
      resolve_time_hours: parsed.data.resolveTimeHours,
      business_hours_only: parsed.data.businessHoursOnly,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/support/sla-rules");
  return { data };
}

export async function updateSlaRule(id: string, formData: unknown) {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createSLARuleSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("sla_rules")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Regra SLA nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "sla_rule", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("sla_rules")
    .update({
      name: parsed.data.name,
      priority: parsed.data.priority,
      category: parsed.data.category || null,
      response_time_hours: parsed.data.responseTimeHours,
      resolve_time_hours: parsed.data.resolveTimeHours,
      business_hours_only: parsed.data.businessHoursOnly,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/support/sla-rules");
  return { success: true };
}

export async function deleteSlaRule(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: rule } = await supabase
    .from("sla_rules")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!rule) return { error: "Regra SLA nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, rule.sector_id, "sla_rule", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase.from("sla_rules").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/support/sla-rules");
  return { success: true };
}

export async function toggleSlaRule(id: string, isActive: boolean) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: rule } = await supabase
    .from("sla_rules")
    .select("sector_id")
    .eq("id", id)
    .single();

  if (!rule) return { error: "Regra SLA nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, rule.sector_id, "sla_rule", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("sla_rules")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/support/sla-rules");
  return { success: true };
}
