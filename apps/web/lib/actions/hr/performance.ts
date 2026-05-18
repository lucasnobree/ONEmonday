"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createReviewCycleSchema,
  updateReviewCycleStatusSchema,
  upsertEvaluationSchema,
  createDevelopmentPlanSchema,
  addDevelopmentActionSchema,
  toggleDevelopmentActionSchema,
} from "@/lib/validations/hr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Review cycles
// ---------------------------------------------------------------------------

export async function createReviewCycle(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createReviewCycleSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  if (parsed.data.endDate < parsed.data.startDate) {
    return { error: "A data de fim deve ser posterior à data de início" };
  }

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "performance", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: cycle, error } = await supabase
    .from("hr_review_cycles")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/performance");
  return { data: cycle };
}

export async function updateReviewCycleStatus(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateReviewCycleStatusSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: cycle } = await supabase
    .from("hr_review_cycles")
    .select("sector_id")
    .eq("id", parsed.data.cycleId)
    .single();
  if (!cycle) return { error: "Ciclo nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, cycle.sector_id, "performance", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_review_cycles")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.cycleId);

  if (error) return { error: error.message };

  revalidatePath("/hr/performance");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

/** Create or update the evaluation of an employee within a cycle. */
export async function upsertEvaluation(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = upsertEvaluationSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: cycle } = await supabase
    .from("hr_review_cycles")
    .select("sector_id, status")
    .eq("id", parsed.data.cycleId)
    .single();
  if (!cycle) return { error: "Ciclo nao encontrado" };
  if (cycle.status === "closed") {
    return { error: "Ciclo encerrado: avaliações não podem ser alteradas" };
  }

  const perms = await getUserPermissions(user.id);
  const needed = parsed.data.submit ? "update" : "create";
  if (!hasPermission(perms, cycle.sector_id, "performance", needed)) {
    return { error: "Sem permissao" };
  }

  const row = {
    cycle_id: parsed.data.cycleId,
    sector_id: cycle.sector_id,
    employee_id: parsed.data.employeeId,
    reviewer_id: parsed.data.reviewerId ?? user.id,
    performance_score: parsed.data.performanceScore ?? null,
    potential_score: parsed.data.potentialScore ?? null,
    overall_rating: parsed.data.overallRating ?? null,
    strengths: parsed.data.strengths || null,
    improvements: parsed.data.improvements || null,
    comments: parsed.data.comments || null,
    status: parsed.data.submit ? "submitted" : "pending",
    submitted_at: parsed.data.submit ? new Date().toISOString() : null,
  };

  const { data: evaluation, error } = await supabase
    .from("hr_evaluations")
    .upsert(row, { onConflict: "cycle_id,employee_id" })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/performance");
  return { data: evaluation };
}

// ---------------------------------------------------------------------------
// Development plans (PDI)
// ---------------------------------------------------------------------------

export async function createDevelopmentPlan(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createDevelopmentPlanSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "pdi", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: plan, error } = await supabase
    .from("hr_development_plans")
    .insert({
      sector_id: parsed.data.sectorId,
      employee_id: parsed.data.employeeId,
      evaluation_id: parsed.data.evaluationId ?? null,
      title: parsed.data.title,
      objective: parsed.data.objective || null,
      target_date: parsed.data.targetDate || null,
      status: "active",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/performance");
  return { data: plan };
}

export async function addDevelopmentAction(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = addDevelopmentActionSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: plan } = await supabase
    .from("hr_development_plans")
    .select("sector_id")
    .eq("id", parsed.data.planId)
    .single();
  if (!plan) return { error: "Plano nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, plan.sector_id, "pdi", "update")) {
    return { error: "Sem permissao" };
  }

  const { count } = await supabase
    .from("hr_development_actions")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", parsed.data.planId);

  const { data: action, error } = await supabase
    .from("hr_development_actions")
    .insert({
      plan_id: parsed.data.planId,
      title: parsed.data.title,
      due_date: parsed.data.dueDate || null,
      position: count ?? 0,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/performance");
  return { data: action };
}

export async function toggleDevelopmentAction(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = toggleDevelopmentActionSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: action } = await supabase
    .from("hr_development_actions")
    .select("plan_id, hr_development_plans(sector_id)")
    .eq("id", parsed.data.actionId)
    .single();
  if (!action) return { error: "Ação nao encontrada" };

  const planRel = action.hr_development_plans as
    | { sector_id: string }
    | { sector_id: string }[]
    | null;
  const sectorId = Array.isArray(planRel) ? planRel[0]?.sector_id : planRel?.sector_id;
  if (!sectorId) return { error: "Plano nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "pdi", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_development_actions")
    .update({
      is_completed: parsed.data.isCompleted,
      completed_at: parsed.data.isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.actionId);

  if (error) return { error: error.message };

  revalidatePath("/hr/performance");
  return { success: true };
}

export async function updateDevelopmentPlanStatus(
  planId: string,
  status: "active" | "completed" | "cancelled"
) {
  const idParsed = z.string().uuid().safeParse(planId);
  const statusParsed = z
    .enum(["active", "completed", "cancelled"])
    .safeParse(status);
  if (!idParsed.success || !statusParsed.success) {
    return { error: "Parametros invalidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: plan } = await supabase
    .from("hr_development_plans")
    .select("sector_id")
    .eq("id", planId)
    .single();
  if (!plan) return { error: "Plano nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, plan.sector_id, "pdi", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_development_plans")
    .update({ status })
    .eq("id", planId);

  if (error) return { error: error.message };

  revalidatePath("/hr/performance");
  return { success: true };
}
