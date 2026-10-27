// Rebuilds the Pinecone upsert payload from a participant's stored
// FormResponse answers. Mirrors extractMatchableResponses / getPronouns in
// src/pages/Registration/RegistrationNew.tsx so admin placement produces the
// same vector a normal registration would.

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

type StoredAnswer = { title?: unknown; answer?: unknown };

export function buildMatchablePayload(
  form: any,
  storedAnswers: StoredAnswer[],
): {
  textResponses: string[];
  numericResponses: Record<string, number>;
  pronouns: string;
} {
  const answers = new Map<string, unknown>();
  storedAnswers.forEach((a) => {
    if (typeof a.title === "string") answers.set(a.title, a.answer);
  });

  const questions: any[] = [];
  if (form && Array.isArray(form.sections)) {
    form.sections.forEach((section: any) => {
      if (Array.isArray(section.questions)) questions.push(...section.questions);
    });
  }

  // Same numeric key assignment as getNumericQuestionKeys at registration.
  const usedKeys = new Set<string>();
  let nextNumericIndex = 1;
  const getNextNumericKey = (): string => {
    while (usedKeys.has(`numeric${nextNumericIndex}`)) nextNumericIndex += 1;
    const key = `numeric${nextNumericIndex}`;
    usedKeys.add(key);
    nextNumericIndex += 1;
    return key;
  };
  const numericKeys = new Map<any, string>();
  questions.forEach((q) => {
    if (q.type !== "Slider" || !q.matchable) return;
    const existingKey = typeof q.numericKey === "string" ? q.numericKey.trim() : "";
    if (existingKey && !usedKeys.has(existingKey)) {
      usedKeys.add(existingKey);
      numericKeys.set(q, existingKey);
      return;
    }
    numericKeys.set(q, getNextNumericKey());
  });

  const textResponses: string[] = [];
  const numericResponses: Record<string, number> = {};
  let pronouns = "Other";

  questions.forEach((q) => {
    const title = typeof q.title === "string" ? q.title : "";
    const answer = answers.get(title);

    if (title.toLowerCase().includes("pronoun")) {
      if (typeof answer === "string" && answer.trim() !== "") pronouns = answer;
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

  return { textResponses, numericResponses, pronouns };
}
