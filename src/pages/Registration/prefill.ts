// Prefill for returning participants: which saved answers can be put back
// into the current registration form. Pure functions so the rules can be
// unit-tested; RegistrationNew passes the result down as default values.

import type {
  Form,
  Participant,
  Question,
  QuestionType,
  Questions,
  RawAddress,
} from "../../types";

export type Prefill =
  | { kind: "text"; value: string } // text inputs, Date, Dropdown, Radio, phone
  | { kind: "number"; value: number } // Slider
  | { kind: "multiple"; values: string[] }
  | { kind: "other"; option: string; text: string } // DropdownWithOther "Other"
  | { kind: "address"; value: RawAddress };

/** Prefill values keyed by form field name (`s{section}_q{question}`). */
export type PrefillMap = Record<string, Prefill>;

// SliderInput's defaults when a question has no min/max.
export const DEFAULT_SLIDER_MIN = 1;
export const DEFAULT_SLIDER_MAX = 5;

// "multiple" answers are stored joined with this separator.
export const MULTIPLE_SEPARATOR = ", ";

// Free-text types whose answer stays valid whatever else changed about the
// question. These are the only types a legacy entry (saved before answers
// carried a question snapshot) can prefill.
const FREE_TEXT_TYPES: ReadonlySet<QuestionType> = new Set([
  "short_input",
  "medium_input",
  "long_input",
  "Date",
  "phoneNumber",
]);

const OPTION_TYPES: ReadonlySet<QuestionType> = new Set([
  "Dropdown",
  "DropdownWithOther",
  "Radio",
  "multiple",
]);

export const isDisplayNameQuestion = (question: Question): boolean => {
  const title = question.title.toLowerCase();
  return title.includes("display name") || title === "name";
};

export const isEmailQuestion = (question: Question): boolean =>
  question.title.toLowerCase().includes("email");

/** Basic info lives on the participant doc, not in FormResponse. */
export const isBasicInfoQuestion = (question: Question): boolean =>
  question.type === "address" ||
  question.type === "phoneNumber" ||
  isDisplayNameQuestion(question) ||
  isEmailQuestion(question);

const isOtherOption = (opt: string) => opt.trim().toLowerCase() === "other";

const sameOptions = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((opt, i) => opt === b[i]);

/**
 * The snapshot of a question saved next to its answer, so a later form can
 * tell whether the question changed. Sliders store the range they were
 * rendered with, so a question with no explicit min/max still records one.
 */
export function questionSnapshot(
  question: Question,
): Pick<Questions, "options" | "min" | "max"> {
  const snapshot: Pick<Questions, "options" | "min" | "max"> = {};
  if (question.options !== undefined) snapshot.options = question.options;
  if (question.type === "Slider") {
    snapshot.min = question.min ?? DEFAULT_SLIDER_MIN;
    snapshot.max = question.max ?? DEFAULT_SLIDER_MAX;
  } else {
    if (question.min !== undefined) snapshot.min = question.min;
    if (question.max !== undefined) snapshot.max = question.max;
  }
  return snapshot;
}

/**
 * The saved answer to put back into `question`, or null to leave it blank.
 * An answer is only reused when nothing about the question changed: same
 * title, same type, same options (values and order) and same slider range,
 * and the answer is still a valid choice. numericKey, matchable and required
 * don't affect whether an answer is valid, so they are ignored.
 */
export function getPrefillValue(
  question: Question,
  savedEntries: readonly Questions[],
): Prefill | null {
  const saved = savedEntries.find((e) => e.title === question.title);
  if (!saved || saved.type !== question.type) return null;

  const { type } = question;
  const answer = saved.answer;

  if (FREE_TEXT_TYPES.has(type)) {
    if (typeof answer !== "string" || answer.trim() === "") return null;
    return { kind: "text", value: answer };
  }

  if (OPTION_TYPES.has(type)) {
    // A legacy entry has no options to compare, so we can't prove the
    // question didn't change.
    if (!Array.isArray(saved.options)) return null;
    const options = question.options ?? [];
    if (!sameOptions(saved.options, options)) return null;
    if (typeof answer !== "string" || answer.trim() === "") return null;

    switch (type) {
      case "Dropdown":
      case "Radio":
        return options.includes(answer) ? { kind: "text", value: answer } : null;
      case "DropdownWithOther": {
        if (options.includes(answer) && !isOtherOption(answer)) {
          return { kind: "text", value: answer };
        }
        // Not one of the options, so it was typed into "Other".
        const option = options.find(isOtherOption) ?? "Other";
        return { kind: "other", option, text: answer };
      }
      case "multiple": {
        // Splitting is ambiguous if an option itself contains the separator.
        if (options.some((opt) => opt.includes(MULTIPLE_SEPARATOR))) return null;
        const values = answer.split(MULTIPLE_SEPARATOR);
        return values.every((v) => options.includes(v))
          ? { kind: "multiple", values }
          : null;
      }
    }
  }

  if (type === "Slider") {
    const min = question.min ?? DEFAULT_SLIDER_MIN;
    const max = question.max ?? DEFAULT_SLIDER_MAX;
    if (saved.min !== min || saved.max !== max) return null;
    // An unanswered slider is saved as 0, which falls outside the range.
    if (typeof answer !== "number" || !Number.isInteger(answer)) return null;
    if (answer < min || answer > max) return null;
    return { kind: "number", value: answer };
  }

  // text, address, profilePicture: nothing to prefill from FormResponse.
  return null;
}

const nonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim() !== "";

/** Basic info comes from the participant doc and always prefills. */
function getBasicPrefill(
  question: Question,
  participant: Participant,
): Prefill | null {
  if (question.type === "address") {
    const address = participant.address;
    if (!address) return null;
    return Object.values(address).some((v) => nonEmpty(v))
      ? { kind: "address", value: address }
      : null;
  }
  if (question.type === "phoneNumber") {
    return nonEmpty(participant.phoneNumber)
      ? { kind: "text", value: participant.phoneNumber }
      : null;
  }
  if (isDisplayNameQuestion(question)) {
    return nonEmpty(participant.displayName)
      ? { kind: "text", value: participant.displayName }
      : null;
  }
  if (isEmailQuestion(question)) {
    return nonEmpty(participant.email)
      ? { kind: "text", value: participant.email }
      : null;
  }
  return null;
}

/**
 * Prefill values for every question in `form` that can be prefilled from a
 * returning participant's saved profile and answers. Either source may be
 * missing (e.g. a FormResponse left over from a cohort whose participant doc
 * was deleted).
 */
export function buildPrefill(
  form: Form,
  savedEntries: readonly Questions[],
  participant: Participant | null,
): PrefillMap {
  const prefill: PrefillMap = {};
  form.sections.forEach((section, sectionIndex) => {
    section.questions.forEach((question, questionIndex) => {
      const fieldName = `s${sectionIndex}_q${questionIndex}`;
      const value = isBasicInfoQuestion(question)
        ? participant
          ? getBasicPrefill(question, participant)
          : null
        : getPrefillValue(question, savedEntries);
      if (value) prefill[fieldName] = value;
    });
  });
  return prefill;
}
