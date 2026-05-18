"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createMatterSchema,
  updateMatterSchema,
} from "@/lib/validations/legal";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Statuses that count as terminal — used to stamp `resolved_at`. */
const TERMINAL_STATUSES = new Set(["resolved", "closed"]);

export async function createMatter(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createMatterSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "legal_matter", "create")) {
    return { error: "Sem permissão" };
  }

  const { data: matter, error } = await supabase
    .from("legal_matters")
    .insert({
      sector_id: parsed.data.sectorId,
      contract_id: parsed.data.contractId || null,
      title: parsed.data.title,
      matter_type: parsed.data.matterType,
      priority: parsed.data.priority,
      status: parsed.data.status,
      description: parsed.data.description || null,
      requested_by: user.id,
      assigned_to: parsed.data.assignedTo || null,
      due_date: parsed.data.dueDate || null,
      resolved_at: TERMINAL_STATUSES.has(parsed.data.status)
        ? new Date().toISOString()
        : null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Seed the status history with the creation entry (from_status NULL).
  await supabase.from("legal_status_history").insert({
    entity_type: "matter",
    entity_id: matter.id,
    sector_id: parsed.data.sectorId,
    from_status: null,
    to_status: matter.status,
    changed_by: user.id,
  });

  revalidatePath("/legal");
  revalidatePath("/legal/matters");
  return { data: matter };
}

export async function updateMatter(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = updateMatterSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("legal_matters")
    .select("sector_id, resolved_at, status")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Demanda não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "legal_matter", "update")) {
    return { error: "Sem permissão" };
  }

  const isTerminal = TERMINAL_STATUSES.has(parsed.data.status);
  // Stamp resolved_at the first time the matter reaches a terminal status;
  // clear it if it is re-opened.
  const resolvedAt = isTerminal
    ? existing.resolved_at ?? new Date().toISOString()
    : null;

  const { error } = await supabase
    .from("legal_matters")
    .update({
      contract_id: parsed.data.contractId || null,
      title: parsed.data.title,
      matter_type: parsed.data.matterType,
      priority: parsed.data.priority,
      status: parsed.data.status,
      description: parsed.data.description || null,
      assigned_to: parsed.data.assignedTo || null,
      due_date: parsed.data.dueDate || null,
      resolved_at: resolvedAt,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  // Record a status-history entry when the edit changed the status (audit C1).
  if (existing.status !== parsed.data.status) {
    await supabase.from("legal_status_history").insert({
      entity_type: "matter",
      entity_id: parsed.data.id,
      sector_id: existing.sector_id,
      from_status: existing.status,
      to_status: parsed.data.status,
      changed_by: user.id,
    });
  }

  revalidatePath("/legal");
  revalidatePath("/legal/matters");
  return { success: true };
}

export async function deleteMatter(matterId: string) {
  const idParsed = z.string().uuid().safeParse(matterId);
  if (!idParsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: existing } = await supabase
    .from("legal_matters")
    .select("sector_id")
    .eq("id", idParsed.data)
    .single();
  if (!existing) return { error: "Demanda não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "legal_matter", "delete")) {
    return { error: "Sem permissão" };
  }

  const { error } = await supabase
    .from("legal_matters")
    .update({ is_active: false })
    .eq("id", idParsed.data);

  if (error) return { error: error.message };

  revalidatePath("/legal");
  revalidatePath("/legal/matters");
  return { success: true };
}
