"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { requestTimeOffSchema } from "@/lib/validations/hr";
import { checkTimeOffBalance } from "@/lib/hr/time-off-balance";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Available balance for an employee + policy in a given year, via the
 * get_time_off_available_days RPC (migration 00150). Returns null when the
 * RPC fails or the balance is otherwise indeterminable — callers must treat
 * null as "cannot verify" and fail closed, not proceed.
 */
async function getAvailableDays(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
  policyId: string,
  year: number,
  excludeRequestId?: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_time_off_available_days", {
    p_employee_id: employeeId,
    p_policy_id: policyId,
    p_year: year,
    p_exclude_request_id: excludeRequestId ?? null,
  });
  if (error) return null;
  return typeof data === "number" ? data : null;
}

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

  // Block a request that would push the balance negative, unless the caller
  // explicitly opted to override after being warned.
  if (!parsed.data.allowNegativeBalance) {
    const year = new Date(parsed.data.startDate).getFullYear();
    const available = await getAvailableDays(
      supabase,
      parsed.data.employeeId,
      parsed.data.policyId,
      year
    );
    // Fail closed: if the balance cannot be determined, do not let the
    // request through silently — the whole point of the guard is to block
    // over-balance requests.
    if (available === null) {
      return {
        error:
          "Não foi possível verificar o saldo de férias. Tente novamente.",
      };
    }
    const check = checkTimeOffBalance(available, parsed.data.daysCount);
    if (!check.withinBalance) {
      return {
        error: `Saldo insuficiente: a solicitação excede o saldo disponível em ${check.shortfall} dia(s).`,
        balanceShortfall: check.shortfall,
      };
    }
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

export async function approveTimeOff(
  requestId: string,
  options?: { allowNegativeBalance?: boolean }
) {
  const idParsed = z.string().uuid().safeParse(requestId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: request } = await supabase
    .from("hr_time_off_requests")
    .select(
      "sector_id, status, employee_id, policy_id, start_date, days_count"
    )
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Solicitacao nao encontrada" };
  if (request.status !== "pending") return { error: "Solicitacao ja processada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, request.sector_id, "time_off", "manage")) {
    return { error: "Sem permissao" };
  }

  // Warn (and require an explicit override) when approving would push the
  // balance negative. The request being approved is itself "pending", so it
  // is excluded from the sum and compared explicitly via its day count.
  if (!options?.allowNegativeBalance) {
    const year = new Date(request.start_date as string).getFullYear();
    const available = await getAvailableDays(
      supabase,
      request.employee_id as string,
      request.policy_id as string,
      year,
      requestId
    );
    // Fail closed: an unverifiable balance must not silently approve.
    if (available === null) {
      return {
        error:
          "Não foi possível verificar o saldo de férias. Tente novamente.",
      };
    }
    const check = checkTimeOffBalance(
      available,
      request.days_count as number
    );
    if (!check.withinBalance) {
      return {
        error: `Aprovar esta solicitação deixará o saldo negativo (faltam ${check.shortfall} dia(s)). Confirme para aprovar mesmo assim.`,
        balanceShortfall: check.shortfall,
      };
    }
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
