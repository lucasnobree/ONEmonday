"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createJobOpeningSchema } from "@/lib/validations/hr";
import {
  JOB_OPENING_STATUSES,
  canTransitionStatus,
} from "@/lib/hr/recruitment";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createJobOpening(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createJobOpeningSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "job_opening", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: opening, error } = await supabase
    .from("hr_job_openings")
    .insert({
      sector_id: parsed.data.sectorId,
      title: parsed.data.title,
      department: parsed.data.department || null,
      description: parsed.data.description || null,
      requirements: parsed.data.requirements || null,
      employment_type: parsed.data.employmentType,
      location: parsed.data.location || null,
      salary_range: parsed.data.salaryRange || null,
      hiring_manager_id: parsed.data.hiringManagerId || user.id,
      max_candidates: parsed.data.maxCandidates || null,
      status: "open",
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/recruitment");
  return { data: opening };
}

export async function updateJobOpeningStatus(
  openingId: string,
  status: string
) {
  const idParsed = z.string().uuid().safeParse(openingId);
  if (!idParsed.success) return { error: "ID invalido" };

  const statusParsed = z.enum(JOB_OPENING_STATUSES).safeParse(status);
  if (!statusParsed.success) return { error: "Status invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: opening } = await supabase
    .from("hr_job_openings")
    .select("sector_id, status")
    .eq("id", openingId)
    .single();

  if (!opening) return { error: "Vaga nao encontrada" };

  if (!canTransitionStatus(opening.status, statusParsed.data)) {
    return { error: "Transicao de status invalida" };
  }

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, opening.sector_id, "job_opening", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_job_openings")
    .update({
      status: statusParsed.data,
      closed_at: statusParsed.data === "open" ? null : new Date().toISOString(),
    })
    .eq("id", openingId);

  if (error) return { error: error.message };

  revalidatePath("/hr/recruitment");
  return { success: true };
}
