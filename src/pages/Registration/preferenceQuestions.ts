import type { PreferenceQuestionId } from "../../types";

export type { PreferenceQuestionId } from "../../types";

export const PREFERENCE_QUESTION_LABELS: Record<PreferenceQuestionId, string> = {
  q1: "Prefer indoor movie (1) - Prefer outdoor camping (5)",
  q2: "Prefer early mornings (1) - Prefer late nights (5)",
  q3: "Prefer quiet (1) - Prefer social (5)",
};

export const PREFERENCE_QUESTION_IDS: PreferenceQuestionId[] = ["q1", "q2", "q3"];
