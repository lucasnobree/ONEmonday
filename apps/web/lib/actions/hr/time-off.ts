"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { requestTimeOffSchema } from "@/lib/validations/hr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function requestTimeOff(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = requestTimeOffSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "time_off", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: request, error } = await supabase
    .from("hr_time_off_requests")
    .insert({
      employee_id: parsed.data.employeeId,
      sector_id: parsed.data.sectorId,
      policy_id: parsed.data.policyId,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      days_count: parsed.data.daysCount,
      reason: parsed.data.reason || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/time-off");
  return { data: request };
}

export async function approveTimeOff(requestId: string) {
  const idParsed = z.string().uuid().safeParse(requestId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: request } = await supabase
    .from("hr_time_off_requests")
    .select("sector_id, status")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Solicitacao nao encontrada" };
  if (request.status !== "pending") return { error: "Solicitacao ja processada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, request.sector_id, "time_off", "manage")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_time_off_requests")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  revalidatePath("/hr/time-off");
  return { success: true };
}

export async function rejectTimeOff(requestId: string, reason: string) {
  const idParsed = z.string().uuid().safeParse(requestId);
  if (!idParsed.success) return { error: "ID invalido" };

  const reasonParsed = z.string().min(1).safeParse(reason);
  if (!reasonParsed.success) return { error: "Motivo e obrigatorio" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: request } = await supabase
    .from("hr_time_off_requests")
    .select("sector_id, status")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Solicitacao nao encontrada" };
  if (request.status !== "pending") return { error: "Solicitacao ja processada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, request.sector_id, "time_off", "manage")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_time_off_requests")
    .update({
      status: "rejected",
      rejection_reason: reason,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  revalidatePath("/hr/time-off");
  return { success: true };
}
