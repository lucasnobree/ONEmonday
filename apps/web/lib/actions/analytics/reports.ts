"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createReportSchema,
  updateReportSchema,
} from "@/lib/validations/analytics";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Creates a saved analytics report scoped to a sector. */
export async function createReport(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createReportSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, parsed.data.sectorId, "analytics_report", "create")
  ) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("analytics_reports")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      metric: parsed.data.metric,
      chart_type: parsed.data.chartType,
      group_by: parsed.data.groupBy,
      date_range_days: parsed.data.dateRangeDays,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/analytics/reports");
  return { data };
}

/** Updates an existing saved report. */
export async function updateReport(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateReportSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("analytics_reports")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Relatorio nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, existing.sector_id, "analytics_report", "update")
  ) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("analytics_reports")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      metric: parsed.data.metric,
      chart_type: parsed.data.chartType,
      group_by: parsed.data.groupBy,
      date_range_days: parsed.data.dateRangeDays,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/analytics/reports");
  return { success: true };
}

/** Soft-deletes a saved report (sets `is_active = false`). */
export async function deleteReport(reportId: string) {
  const parsed = z.string().uuid().safeParse(reportId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: report } = await supabase
    .from("analytics_reports")
    .select("sector_id")
    .eq("id", reportId)
    .single();
  if (!report) return { error: "Relatorio nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, report.sector_id, "analytics_report", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("analytics_reports")
    .update({ is_active: false })
    .eq("id", reportId);

  if (error) return { error: error.message };

  revalidatePath("/analytics/reports");
  return { success: true };
}
