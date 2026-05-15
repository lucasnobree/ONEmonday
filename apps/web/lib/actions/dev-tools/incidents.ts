"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createIncidentSchema,
  updateIncidentSchema,
} from "@/lib/validations/dev-tools";
import { resolveLifecycleTimestamps } from "@/lib/dev-tools/incident-metrics";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type IncidentInput = z.infer<typeof createIncidentSchema>;

function baseRow(data: IncidentInput) {
  return {
    service_id: data.serviceId || null,
    title: data.title,
    description: data.description || null,
    severity: data.severity,
    status: data.status,
    assigned_to: data.assignedTo || null,
  };
}

export async function createIncident(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createIncidentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "incident", "create")) {
    return { error: "Sem permissao" };
  }

  const timestamps = resolveLifecycleTimestamps(parsed.data.status, {
    acknowledged_at: null,
    resolved_at: null,
  });

  const { data: incident, error } = await supabase
    .from("dev_incidents")
    .insert({
      sector_id: parsed.data.sectorId,
      created_by: user.id,
      ...baseRow(parsed.data),
      ...timestamps,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/incidents");
  return { data: incident };
}

export async function updateIncident(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateIncidentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("dev_incidents")
    .select("sector_id, acknowledged_at, resolved_at")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Incidente nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "incident", "update")) {
    return { error: "Sem permissao" };
  }

  const timestamps = resolveLifecycleTimestamps(parsed.data.status, {
    acknowledged_at: existing.acknowledged_at,
    resolved_at: existing.resolved_at,
  });

  const { error } = await supabase
    .from("dev_incidents")
    .update({ ...baseRow(parsed.data), ...timestamps })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/incidents");
  return { success: true };
}

export async function deleteIncident(incidentId: string) {
  const idParsed = z.string().uuid().safeParse(incidentId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: existing } = await supabase
    .from("dev_incidents")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Incidente nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "incident", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("dev_incidents")
    .update({ is_active: false })
    .eq("id", idParsed.data);

  if (error) return { error: error.message };

  revalidatePath("/dev-tools");
  revalidatePath("/dev-tools/incidents");
  return { success: true };
}
