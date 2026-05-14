"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { addCandidateSchema } from "@/lib/validations/hr";
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
