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

/** Submit an anonymous response to an open survey. */
export async function submitSurveyResponse(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = submitSurveyResponseSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: survey } = await supabase
    .from("hr_surveys")
    .select("sector_id, status")
    .eq("id", parsed.data.surveyId)
    .single();
  if (!survey) return { error: "Pesquisa nao encontrada" };
  if (survey.status !== "open") {
    return { error: "Esta pesquisa não está aberta para respostas" };
  }

  // The response itself is anonymous: it stores no user/employee reference.
  const { data: response, error } = await supabase
    .from("hr_survey_responses")
    .insert({
      survey_id: parsed.data.surveyId,
      sector_id: survey.sector_id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const answerRows = parsed.data.answers.map((a) => ({
    response_id: response.id,
    question_id: a.questionId,
    score_value: a.scoreValue ?? null,
    text_value: a.textValue || null,
  }));

  const { error: aError } = await supabase
    .from("hr_survey_answers")
    .insert(answerRows);

  if (aError) {
    await supabase.from("hr_survey_responses").delete().eq("id", response.id);
    return { error: aError.message };
  }

  revalidatePath("/hr/surveys");
  return { success: true };
}
