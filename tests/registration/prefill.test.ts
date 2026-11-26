// @vitest-environment node
// Which saved answers a returning participant gets back in the current form.
import { describe, it, expect } from "vitest";
import {
  buildPrefill,
  getPrefillValue,
  questionSnapshot,
} from "../../src/pages/Registration/prefill";
import type { Form, Question, Questions } from "../../src/types";

const q = (overrides: Partial<Question>): Question => ({
  type: "short_input",
  title: "Hobbies",
  required: false,
  matchable: false,
  ...overrides,
});

// A saved entry made with the current snapshot format.
const saved = (question: Question, answer: string | number): Questions => ({
  title: question.title,
  type: question.type,
  answer,
  ...questionSnapshot(question),
});

describe("questionSnapshot", () => {
  it("records options, and a slider's effective range", () => {
    expect(questionSnapshot(q({ type: "Dropdown", options: ["a", "b"] }))).toEqual({
      options: ["a", "b"],
    });
    expect(questionSnapshot(q({ type: "Slider" }))).toEqual({ min: 1, max: 5 });
    expect(questionSnapshot(q({ type: "Slider", min: 0, max: 10 }))).toEqual({
      min: 0,
      max: 10,
    });
  });

  it("never includes undefined values (Firestore rejects them)", () => {
    const snap = questionSnapshot(q({ type: "short_input" }));
    expect(Object.values(snap).includes(undefined)).toBe(false);
    expect(snap).toEqual({});
  });
});

describe("getPrefillValue", () => {
  it("prefills free text when title and type match", () => {
    const question = q({ type: "long_input" });
    expect(getPrefillValue(question, [saved(question, "Tea")])).toEqual({
      kind: "text",
      value: "Tea",
    });
  });

  it("leaves a renamed question blank", () => {
    const before = q({ title: "Hobbies" });
    const after = q({ title: "Your hobbies" });
    expect(getPrefillValue(after, [saved(before, "Tea")])).toBeNull();
  });

  it("leaves a question whose type changed blank", () => {
    const before = q({ type: "short_input" });
    const after = q({ type: "long_input" });
    expect(getPrefillValue(after, [saved(before, "Tea")])).toBeNull();
  });

  it("ignores numericKey, matchable and required changes", () => {
    const before = q({ type: "Slider", numericKey: "numeric1", matchable: true });
    const after = { ...before, numericKey: "numeric7", matchable: false, required: true };
    expect(getPrefillValue(after, [saved(before, 4)])).toEqual({ kind: "number", value: 4 });
  });

  describe("options", () => {
    const dropdown = q({ type: "Dropdown", title: "Tea", options: ["Green", "Black"] });

    it("prefills when options are unchanged and the answer is one of them", () => {
      expect(getPrefillValue(dropdown, [saved(dropdown, "Black")])).toEqual({
        kind: "text",
        value: "Black",
      });
    });

    it("leaves blank when an option was added, removed or renamed", () => {
      const entry = saved(dropdown, "Black");
      for (const options of [
        ["Green", "Black", "Oolong"],
        ["Black"],
        ["Green", "Dark"],
      ]) {
        expect(getPrefillValue({ ...dropdown, options }, [entry])).toBeNull();
      }
    });

    it("leaves blank when the options were reordered", () => {
      const entry = saved(dropdown, "Black");
      expect(
        getPrefillValue({ ...dropdown, options: ["Black", "Green"] }, [entry]),
      ).toBeNull();
    });

    it("leaves blank when the saved answer isn't a current option", () => {
      expect(getPrefillValue(dropdown, [saved(dropdown, "Oolong")])).toBeNull();
    });

    it("handles Radio like Dropdown", () => {
      const radio = { ...dropdown, type: "Radio" as const };
      expect(getPrefillValue(radio, [saved(radio, "Green")])).toEqual({
        kind: "text",
        value: "Green",
      });
    });
  });

  describe("DropdownWithOther", () => {
    const question = q({
      type: "DropdownWithOther",
      title: "School",
      options: ["UMD", "Other"],
    });

    it("selects a listed option", () => {
      expect(getPrefillValue(question, [saved(question, "UMD")])).toEqual({
        kind: "text",
        value: "UMD",
      });
    });

    it("selects Other and fills its text for an unlisted answer", () => {
      expect(getPrefillValue(question, [saved(question, "Towson")])).toEqual({
        kind: "other",
        option: "Other",
        text: "Towson",
      });
    });

    it("uses the implicit Other option when it isn't listed", () => {
      const noOther = { ...question, options: ["UMD"] };
      expect(getPrefillValue(noOther, [saved(noOther, "Towson")])).toEqual({
        kind: "other",
        option: "Other",
        text: "Towson",
      });
    });

    it("leaves blank when the options changed", () => {
      const entry = saved(question, "Towson");
      expect(
        getPrefillValue({ ...question, options: ["UMD", "JHU", "Other"] }, [entry]),
      ).toBeNull();
    });
  });

  describe("multiple", () => {
    const question = q({
      type: "multiple",
      title: "Contact",
      options: ["Phone", "Email", "Text"],
    });

    it("splits the joined answer into checked options", () => {
      expect(getPrefillValue(question, [saved(question, "Phone, Text")])).toEqual({
        kind: "multiple",
        values: ["Phone", "Text"],
      });
    });

    it("leaves blank when an option contains the separator", () => {
      const ambiguous = { ...question, options: ["Phone, mornings", "Email"] };
      expect(
        getPrefillValue(ambiguous, [saved(ambiguous, "Phone, mornings")]),
      ).toBeNull();
    });

    it("leaves blank when a saved value is no longer an option", () => {
      expect(getPrefillValue(question, [saved(question, "Phone, Fax")])).toBeNull();
    });
  });

  describe("Slider", () => {
    const slider = q({ type: "Slider", title: "Cats" });

    it("prefills an answer in range", () => {
      expect(getPrefillValue(slider, [saved(slider, 3)])).toEqual({
        kind: "number",
        value: 3,
      });
    });

    it("leaves blank when the range changed", () => {
      const entry = saved(slider, 3);
      expect(getPrefillValue({ ...slider, max: 10 }, [entry])).toBeNull();
      expect(getPrefillValue({ ...slider, min: 0 }, [entry])).toBeNull();
    });

    it("leaves blank an unanswered slider (saved as 0)", () => {
      expect(getPrefillValue(slider, [saved(slider, 0)])).toBeNull();
    });
  });

  describe("legacy entries (no question snapshot)", () => {
    const legacy = (question: Question, answer: string | number): Questions => ({
      title: question.title,
      type: question.type,
      answer,
    });

    it("still prefills free-text types", () => {
      for (const type of ["short_input", "medium_input", "long_input", "Date"] as const) {
        const question = q({ type });
        expect(getPrefillValue(question, [legacy(question, "x")])).toEqual({
          kind: "text",
          value: "x",
        });
      }
    });

    it("never prefills a question with options or a range", () => {
      const dropdown = q({ type: "Dropdown", options: ["a"] });
      const multiple = q({ type: "multiple", options: ["a"] });
      const other = q({ type: "DropdownWithOther", options: ["a"] });
      const slider = q({ type: "Slider" });
      expect(getPrefillValue(dropdown, [legacy(dropdown, "a")])).toBeNull();
      expect(getPrefillValue(multiple, [legacy(multiple, "a")])).toBeNull();
      expect(getPrefillValue(other, [legacy(other, "a")])).toBeNull();
      expect(getPrefillValue(slider, [legacy(slider, 3)])).toBeNull();
    });
  });
});

describe("buildPrefill", () => {
  const form: Form = {
    sections: [
      {
        questions: [
          q({ type: "short_input", title: "Name" }),
          q({ type: "short_input", title: "Email" }),
          q({ type: "phoneNumber", title: "Phone" }),
          q({ type: "address", title: "Address" }),
          q({ type: "Date", title: "Date of Birth", lockedKey: "date of birth" }),
        ],
      },
      {
        questions: [
          q({ type: "text", title: "Intro" }),
          q({ type: "Dropdown", title: "Tea", options: ["Green", "Black"] }),
          q({ type: "long_input", title: "New question" }),
        ],
      },
    ],
  };

  const participant = {
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    phoneNumber: "3015550100",
    address: { line1: "1 Main St", city: "College Park", country: "United States" },
  };

  it("fills basic info from the participant doc and answers from FormResponse", () => {
    const entries: Questions[] = [
      { title: "Date of Birth", type: "Date", answer: "2004-05-06" },
      { title: "Tea", type: "Dropdown", answer: "Black", options: ["Green", "Black"] },
    ];
    expect(buildPrefill(form, entries, participant)).toEqual({
      s0_q0: { kind: "text", value: "Ada Lovelace" },
      s0_q1: { kind: "text", value: "ada@example.com" },
      s0_q2: { kind: "text", value: "3015550100" },
      s0_q3: { kind: "address", value: participant.address },
      s0_q4: { kind: "text", value: "2004-05-06" },
      s1_q1: { kind: "text", value: "Black" },
    });
  });

  it("uses FormResponse alone when the participant doc is gone", () => {
    const entries: Questions[] = [
      { title: "Date of Birth", type: "Date", answer: "2004-05-06" },
    ];
    expect(buildPrefill(form, entries, null)).toEqual({
      s0_q4: { kind: "text", value: "2004-05-06" },
    });
  });

  it("is empty for a brand-new user", () => {
    expect(buildPrefill(form, [], null)).toEqual({});
  });
});
