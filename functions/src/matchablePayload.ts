// Rebuilds the Pinecone upsert payload from a participant's stored
// FormResponse answers. Mirrors extractMatchableResponses / getPronouns in
// src/pages/Registration/RegistrationNew.tsx so admin placement produces the
// same vector a normal registration would.

import { assignNumericKeys, getFormQuestions } from "./numericKeys";

const TEXT_QUESTION_TYPES = [
  "short_input",
  "medium_input",
  "long_input",
  "Dropdown",
  "DropdownWithOther",
  "Radio",
  "multiple",
  "Date",
];

type StoredAnswer = { title?: unknown; type?: unknown; answer?: unknown };

export function buildMatchablePayload(
  form: any,
  storedAnswers: StoredAnswer[],
): {
  textResponses: string[];
  numericResponses: Record<string, number>;
  pronouns: string;
} {
  // Stored answers only carry the question's title and type, in form order.
  // Queue them per title+type and hand them out in form order, so two
  // questions sharing a title each get their own answer.
  const answerQueues = new Map<string, unknown[]>();
  const answerKey = (title: unknown, type: unknown) => `${type}\u0000${title}`;
  storedAnswers.forEach((a) => {
    if (typeof a.title !== "string") return;
    const key = answerKey(a.title, a.type);
    const queue = answerQueues.get(key) ?? [];
    queue.push(a.answer);
    answerQueues.set(key, queue);
  });
  const takeAnswer = (q: any): unknown => answerQueues.get(answerKey(q.title, q.type))?.shift();

  const questions = getFormQuestions(form);
  const numericKeys = assignNumericKeys(questions);

  const textResponses: string[] = [];
  const numericResponses: Record<string, number> = {};
  let pronouns: string | null = null;

  questions.forEach((q) => {
    const title = typeof q.title === "string" ? q.title : "";
    const answer = takeAnswer(q);

    if (title.toLowerCase().includes("pronoun")) {
      // Registration uses the first pronoun question only.
      if (pronouns === null) {
        pronouns = typeof answer === "string" && answer.trim() !== "" ? answer : "Other";
      }
      return;
    }
    if (!q.matchable) return;

    if (q.type === "Slider") {
      const key = numericKeys.get(q);
      if (key) numericResponses[key] = Number(answer) || 0;
    } else if (TEXT_QUESTION_TYPES.includes(q.type)) {
      if (typeof answer === "string" && answer.trim() !== "") {
        textResponses.push(answer);
      }
    }
  });

  return { textResponses, numericResponses, pronouns: pronouns ?? "Other" };
}
