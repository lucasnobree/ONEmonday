"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createSurveySchema,
  updateSurveyStatusSchema,
  submitSurveyResponseSchema,
} from "@/lib/validations/hr";
import { revalidatePath } from "next/cache";

/** Create a climate / engagement survey with its questions. */
export async function createSurvey(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createSurveySchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "survey", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: survey, error } = await supabase
    .from("hr_surveys")
    .insert({
      sector_id: parsed.data.sectorId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      survey_type: parsed.data.surveyType,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const questionRows = parsed.data.questions.map((q, index) => ({
    survey_id: survey.id,
    prompt: q.prompt,
    question_type: q.questionType,
    position: index,
  }));

  const { error: qError } = await supabase
    .from("hr_survey_questions")
    .insert(questionRows);

  if (qError) {
    // Roll back the survey so it is not left question-less.
    await supabase.from("hr_surveys").delete().eq("id", survey.id);
    return { error: qError.message };
  }

  revalidatePath("/hr/surveys");
  return { data: survey };
}

export async function updateSurveyStatus(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateSurveyStatusSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: survey } = await supabase
    .from("hr_surveys")
    .select("sector_id")
    .eq("id", parsed.data.surveyId)
    .single();
  if (!survey) return { error: "Pesquisa nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, survey.sector_id, "survey", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("hr_surveys")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.surveyId);

  if (error) return { error: error.message };

  revalidatePath("/hr/surveys");
  return { success: true };
}

/**
 * Submit an anonymous response to an open survey on behalf of an employee.
 *
 * The whole submission — the anonymous response, its answers and the
 * participation record — is written atomically by the `submit_survey_response`
 * SECURITY DEFINER RPC (migration 00190). The participation record enforces a
 * one-response-per-employee guard, while the response row carries no identity:
 * the two are deliberately unlinkable so the answers stay anonymous.
 */
export async function submitSurveyResponse(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = submitSurveyResponseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data, error } = await supabase.rpc("submit_survey_response", {
    p_survey_id: parsed.data.surveyId,
    p_employee_id: parsed.data.employeeId,
    p_answers: parsed.data.answers.map((a) => ({
      question_id: a.questionId,
      score_value: a.scoreValue ?? null,
      text_value: a.textValue ?? null,
    })),
  });

  if (error) return { error: error.message };

  const result = (data ?? {}) as { error?: string; success?: boolean };
  if (result.error) return { error: result.error };

  revalidatePath("/hr/surveys");
  return { success: true };
}
