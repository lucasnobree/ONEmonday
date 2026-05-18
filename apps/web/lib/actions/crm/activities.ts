"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createActivitySchema,
  completeActivitySchema,
  rescheduleActivitySchema,
} from "@/lib/validations/crm";
import { enqueueCrmEvent } from "@/lib/actions/crm/crm-dispatch";
import { buildActivityDueEvent } from "@/lib/crm/crm-events";
import { revalidatePath } from "next/cache";

export async function createActivity(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createActivitySchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "crm_activity", "create")) {
    return { error: "Sem permissao" };
  }

  // A scheduled activity becomes a task: it defaults its assignee to the
  // creator unless one was picked explicitly.
  const assignedTo = parsed.data.scheduledAt
    ? parsed.data.assignedTo || user.id
    : parsed.data.assignedTo || null;

  // An assignee must belong to the activity's sector — otherwise the task
  // would land on a user who can't even see it under RLS. A global admin is
  // accepted in any sector; a sector member needs a `user_sector_roles` row.
  // The creator-default is trusted (the creator already passed the gate).
  if (assignedTo && assignedTo !== user.id) {
    const { data: assignee } = await supabase
      .from("users")
      .select("is_global_admin")
      .eq("id", assignedTo)
      .maybeSingle<{ is_global_admin: boolean }>();
    if (!assignee) {
      return { error: "Responsavel invalido" };
    }
    if (!assignee.is_global_admin) {
      const { data: membership } = await supabase
        .from("user_sector_roles")
        .select("user_id")
        .eq("user_id", assignedTo)
        .eq("sector_id", parsed.data.sectorId)
        .limit(1)
        .maybeSingle<{ user_id: string }>();
      if (!membership) {
        return { error: "Responsavel nao pertence ao setor da atividade" };
      }
    }
  }

  const { data: activity, error } = await supabase
    .from("crm_activities")
    .insert({
      sector_id: parsed.data.sectorId,
      deal_id: parsed.data.dealId || null,
      contact_id: parsed.data.contactId || null,
      company_id: parsed.data.companyId || null,
      type: parsed.data.type,
      subject: parsed.data.subject,
      description: parsed.data.description || null,
      scheduled_at: parsed.data.scheduledAt || null,
      assigned_to: assignedTo,
      duration_min: parsed.data.durationMin || null,
      performed_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // A future-dated task fans an "activity due" reminder out to Teams /
  // WhatsApp via the Phase-1 outbox.
  if (parsed.data.scheduledAt) {
    let assigneeName: string | null = null;
    if (assignedTo) {
      const { data: assignee } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", assignedTo)
        .single();
      assigneeName = assignee?.full_name ?? null;
    }
    await enqueueCrmEvent(supabase, {
      sectorId: parsed.data.sectorId,
      userId: user.id,
      event: buildActivityDueEvent({
        subject: parsed.data.subject,
        type: parsed.data.type,
        dueAt: parsed.data.scheduledAt,
        assigneeName,
      }),
    });
  }

  revalidatePath("/");
  return { data: activity };
}

/**
 * Marks a scheduled activity/task complete (or reopens it). Stamps/clears
 * `completed_at`. RLS already restricts this to the performer, the assignee,
 * or a user with `crm_activity:update`.
 */
export async function completeActivity(input: unknown) {
  const parsed = completeActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: activity } = await supabase
    .from("crm_activities")
    .select("sector_id")
    .eq("id", parsed.data.activityId)
    .single();

  if (!activity) return { error: "Atividade nao encontrada" };

  const { error } = await supabase
    .from("crm_activities")
    .update({
      completed_at: parsed.data.completed ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.activityId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

/**
 * Reschedules an open task to a new due date/time. RLS restricts this to the
 * performer, the assignee, or a `crm_activity:update` holder.
 */
export async function rescheduleActivity(input: unknown) {
  const parsed = rescheduleActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: activity } = await supabase
    .from("crm_activities")
    .select("sector_id, subject, type, assigned_to")
    .eq("id", parsed.data.activityId)
    .single();

  if (!activity) return { error: "Atividade nao encontrada" };

  const { error } = await supabase
    .from("crm_activities")
    .update({ scheduled_at: parsed.data.scheduledAt })
    .eq("id", parsed.data.activityId);

  if (error) return { error: error.message };

  // Re-fan an "activity due" reminder for the new schedule.
  let assigneeName: string | null = null;
  if (activity.assigned_to) {
    const { data: assignee } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", activity.assigned_to)
      .single();
    assigneeName = assignee?.full_name ?? null;
  }
  await enqueueCrmEvent(supabase, {
    sectorId: activity.sector_id,
    userId: user.id,
    event: buildActivityDueEvent({
      subject: activity.subject,
      type: activity.type,
      dueAt: parsed.data.scheduledAt,
      assigneeName,
    }),
  });

  revalidatePath("/");
  return { success: true };
}
