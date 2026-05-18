"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  addCandidateSchema,
  moveCandidateSchema,
  updateCandidateSchema,
  addCandidateNoteSchema,
} from "@/lib/validations/hr";
import { revalidatePath } from "next/cache";

export async function addCandidate(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = addCandidateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "candidate", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: opening } = await supabase
    .from("hr_job_openings")
    .select("id, board_id, sector_id")
    .eq("id", parsed.data.jobOpeningId)
    .single();

  if (!opening) return { error: "Vaga nao encontrada" };

  let cardId: string | null = null;

  if (opening.board_id) {
    const { data: firstColumn } = await supabase
      .from("board_columns")
      .select("id")
      .eq("board_id", opening.board_id)
      .order("position", { ascending: true })
      .limit(1)
      .single();

    if (firstColumn) {
      const { data: maxPos } = await supabase
        .from("cards")
        .select("position")
        .eq("column_id", firstColumn.id)
        .eq("is_active", true)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      const position = (maxPos?.position ?? -1) + 1;

      const { data: card } = await supabase
        .from("cards")
        .insert({
          title: parsed.data.fullName,
          description: `Candidato para vaga: ${opening.id}`,
          column_id: firstColumn.id,
          board_id: opening.board_id,
          sector_id: opening.sector_id,
          created_by: user.id,
          position,
          priority: "medium",
        })
        .select()
        .single();

      if (card) cardId = card.id;
    }
  }

  const { data: candidate, error } = await supabase
    .from("hr_candidates")
    .insert({
      job_opening_id: parsed.data.jobOpeningId,
      sector_id: parsed.data.sectorId,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      resume_url: parsed.data.resumeUrl || null,
      linkedin_url: parsed.data.linkedinUrl || null,
      source: parsed.data.source || null,
      current_company: parsed.data.currentCompany || null,
      current_position: parsed.data.currentPosition || null,
      expected_salary: parsed.data.expectedSalary || null,
      notes: parsed.data.notes || null,
      card_id: cardId,
      stage: "applied",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/recruitment");
  return { data: candidate };
}

/** Move a candidate to a different pipeline stage. */
export async function moveCandidate(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = moveCandidateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: candidate } = await supabase
    .from("hr_candidates")
    .select("sector_id")
    .eq("id", parsed.data.candidateId)
    .single();
  if (!candidate) return { error: "Candidato nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, candidate.sector_id, "candidate", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_candidates")
    .update({
      stage: parsed.data.stage,
      stage_changed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.candidateId);

  if (error) return { error: error.message };

  revalidatePath("/hr/recruitment");
  return { success: true };
}

/** Update a candidate's profile fields. */
export async function updateCandidate(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateCandidateSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: candidate } = await supabase
    .from("hr_candidates")
    .select("sector_id")
    .eq("id", parsed.data.candidateId)
    .single();
  if (!candidate) return { error: "Candidato nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, candidate.sector_id, "candidate", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_candidates")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      resume_url: parsed.data.resumeUrl || null,
      linkedin_url: parsed.data.linkedinUrl || null,
      source: parsed.data.source || null,
      current_company: parsed.data.currentCompany || null,
      current_position: parsed.data.currentPosition || null,
      expected_salary: parsed.data.expectedSalary ?? null,
      rating: parsed.data.rating ?? null,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.candidateId);

  if (error) return { error: error.message };

  revalidatePath("/hr/recruitment");
  return { success: true };
}

/** Add an interview note / scorecard entry to a candidate. */
export async function addCandidateNote(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = addCandidateNoteSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: candidate } = await supabase
    .from("hr_candidates")
    .select("sector_id")
    .eq("id", parsed.data.candidateId)
    .single();
  if (!candidate) return { error: "Candidato nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, candidate.sector_id, "candidate", "update")) {
    return { error: "Sem permissao" };
  }

  const { data: note, error } = await supabase
    .from("hr_candidate_notes")
    .insert({
      candidate_id: parsed.data.candidateId,
      sector_id: candidate.sector_id,
      author_id: user.id,
      rating: parsed.data.rating ?? null,
      body: parsed.data.body,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/hr/recruitment");
  return { data: note };
}
