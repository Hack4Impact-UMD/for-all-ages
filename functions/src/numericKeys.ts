// Assigns each matchable Slider question its numericN key, the same way
// getNumericQuestionKeys does at registration (src/pages/Registration/
// RegistrationNew.tsx). Vectors and score ranges must agree on these keys, so
// every server-side caller goes through this one function.
//
// Only Sliders get keys: registration only stores Slider answers as numeric
// metadata.

export function getFormQuestions(form: any): any[] {
  const questions: any[] = [];
  if (form && Array.isArray(form.sections)) {
    form.sections.forEach((section: any) => {
      if (Array.isArray(section.questions)) questions.push(...section.questions);
    });
  }
  return questions;
}

export function assignNumericKeys(questions: any[]): Map<any, string> {
  const usedKeys = new Set<string>();
  let nextNumericIndex = 1;
  const getNextNumericKey = (): string => {
    while (usedKeys.has(`numeric${nextNumericIndex}`)) nextNumericIndex += 1;
    const key = `numeric${nextNumericIndex}`;
    usedKeys.add(key);
    nextNumericIndex += 1;
    return key;
  };

  const keys = new Map<any, string>();
  questions.forEach((q) => {
    if (q.type !== "Slider" || !q.matchable) return;
    const existingKey = typeof q.numericKey === "string" ? q.numericKey.trim() : "";
    if (existingKey && !usedKeys.has(existingKey)) {
      usedKeys.add(existingKey);
      keys.set(q, existingKey);
      return;
    }
    keys.set(q, getNextNumericKey());
  });
  return keys;
}
