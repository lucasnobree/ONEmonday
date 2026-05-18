import { describe, it, expect } from "vitest";
import {
  isAnswered,
  unansweredRequired,
  canSubmitSurvey,
  buildAnswerPayload,
  SCORE_SCALE,
  ENPS_SCALE,
  type AnswerableQuestion,
  type DraftAnswer,
} from "./survey-answering";

const scoreQ: AnswerableQuestion = { id: "q1", question_type: "score" };
const enpsQ: AnswerableQuestion = { id: "q2", question_type: "enps" };
const textQ: AnswerableQuestion = { id: "q3", question_type: "text" };

describe("SCORE_SCALE / ENPS_SCALE", () => {
  it("exposes the canonical 1-5 and 0-10 scales", () => {
    expect([...SCORE_SCALE]).toEqual([1, 2, 3, 4, 5]);
    expect([...ENPS_SCALE]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("isAnswered", () => {
  it("treats a missing draft as unanswered", () => {
    expect(isAnswered(scoreQ, undefined)).toBe(false);
  });

  it("needs a numeric value for a score question", () => {
    expect(isAnswered(scoreQ, { questionId: "q1" })).toBe(false);
    expect(isAnswered(scoreQ, { questionId: "q1", scoreValue: 0 })).toBe(true);
    expect(isAnswered(scoreQ, { questionId: "q1", scoreValue: 4 })).toBe(true);
  });

  it("needs non-empty text for a text question", () => {
    expect(isAnswered(textQ, { questionId: "q3", textValue: "" })).toBe(false);
    expect(isAnswered(textQ, { questionId: "q3", textValue: "   " })).toBe(
      false
    );
    expect(isAnswered(textQ, { questionId: "q3", textValue: "ok" })).toBe(
      true
    );
  });
});

describe("unansweredRequired", () => {
  it("flags every unanswered scored question, ignoring text", () => {
    const questions = [scoreQ, enpsQ, textQ];
    expect(unansweredRequired(questions, {})).toEqual(["q1", "q2"]);
  });

  it("returns empty when all scored questions are answered", () => {
    const drafts: Record<string, DraftAnswer> = {
      q1: { questionId: "q1", scoreValue: 3 },
      q2: { questionId: "q2", scoreValue: 9 },
    };
    expect(unansweredRequired([scoreQ, enpsQ, textQ], drafts)).toEqual([]);
  });
});

describe("canSubmitSurvey", () => {
  it("rejects an empty question list", () => {
    expect(canSubmitSurvey([], {})).toBe(false);
  });

  it("rejects when a scored question is unanswered", () => {
    expect(
      canSubmitSurvey([scoreQ, textQ], {
        q3: { questionId: "q3", textValue: "hi" },
      })
    ).toBe(false);
  });

  it("accepts when every scored question is answered (text optional)", () => {
    expect(
      canSubmitSurvey([scoreQ, textQ], {
        q1: { questionId: "q1", scoreValue: 5 },
      })
    ).toBe(true);
  });
});

describe("buildAnswerPayload", () => {
  it("drops unanswered drafts", () => {
    const payload = buildAnswerPayload([scoreQ, enpsQ, textQ], {
      q1: { questionId: "q1", scoreValue: 4 },
    });
    expect(payload).toEqual([{ questionId: "q1", scoreValue: 4 }]);
  });

  it("trims text answers and keeps score answers", () => {
    const payload = buildAnswerPayload([scoreQ, textQ], {
      q1: { questionId: "q1", scoreValue: 2 },
      q3: { questionId: "q3", textValue: "  bom ambiente  " },
    });
    expect(payload).toEqual([
      { questionId: "q1", scoreValue: 2 },
      { questionId: "q3", textValue: "bom ambiente" },
    ]);
  });

  it("preserves question order", () => {
    const payload = buildAnswerPayload([textQ, scoreQ], {
      q1: { questionId: "q1", scoreValue: 1 },
      q3: { questionId: "q3", textValue: "x" },
    });
    expect(payload.map((p) => p.questionId)).toEqual(["q3", "q1"]);
  });
});
