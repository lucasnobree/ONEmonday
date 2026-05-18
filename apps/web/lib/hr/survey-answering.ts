// Pure helpers for the employee-facing survey answering flow. Framework-free
// so they can be unit-tested directly and shared between the route component
// and the server action.

/** A survey question as seen by the respondent. */
export interface AnswerableQuestion {
  id: string;
  question_type: string;
}

/** A draft answer keyed by question id. */
export interface DraftAnswer {
  questionId: string;
  scoreValue?: number;
  textValue?: string;
}

/** The valid 1-5 scale values for a `score` question. */
export const SCORE_SCALE = [1, 2, 3, 4, 5] as const;

/** The valid 0-10 scale values for an `enps` question. */
export const ENPS_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * True when a draft answer has been filled in: a score question needs a
 * numeric value, a text question needs non-empty text.
 */
export function isAnswered(
  question: AnswerableQuestion,
  draft: DraftAnswer | undefined
): boolean {
  if (!draft) return false;
  if (question.question_type === "text") {
    return !!draft.textValue && draft.textValue.trim().length > 0;
  }
  return typeof draft.scoreValue === "number";
}

/**
 * Returns the ids of every required question still unanswered. Score and eNPS
 * questions are required; free-text `comment` questions are optional.
 */
export function unansweredRequired(
  questions: AnswerableQuestion[],
  drafts: Record<string, DraftAnswer>
): string[] {
  return questions
    .filter((q) => q.question_type !== "text")
    .filter((q) => !isAnswered(q, drafts[q.id]))
    .map((q) => q.id);
}

/**
 * True when the survey can be submitted: every scored question is answered.
 * An empty question list cannot be submitted.
 */
export function canSubmitSurvey(
  questions: AnswerableQuestion[],
  drafts: Record<string, DraftAnswer>
): boolean {
  if (questions.length === 0) return false;
  return unansweredRequired(questions, drafts).length === 0;
}

/**
 * Builds the answer payload for `submitSurveyResponse`, dropping empty drafts.
 * A score draft contributes `scoreValue`; a non-empty text draft contributes a
 * trimmed `textValue`.
 */
export function buildAnswerPayload(
  questions: AnswerableQuestion[],
  drafts: Record<string, DraftAnswer>
): DraftAnswer[] {
  const payload: DraftAnswer[] = [];
  for (const q of questions) {
    const draft = drafts[q.id];
    if (!isAnswered(q, draft)) continue;
    if (q.question_type === "text") {
      payload.push({ questionId: q.id, textValue: draft!.textValue!.trim() });
    } else {
      payload.push({ questionId: q.id, scoreValue: draft!.scoreValue });
    }
  }
  return payload;
}
