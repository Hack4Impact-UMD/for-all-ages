import { useCallback, useMemo, useState } from "react";
import type { Form, Question } from "../../types";

export type EditorQuestion = Question & { id: string };

// Default locked questions that are imported when form is first created or missing from Firestore
export const LOCKED_QUESTIONS : Question[] = [
  {
    type: "address",
    title: "What is your current address?",
    required: true,
    matchable: false,
    locked: true,
    lockedKey: "current address",
  },
  {
    type: "Radio",
    title: "What are your pronouns?",
    options: ["He/Him", "She/Her", "They/Them", "Other"],
    required: true,
    matchable: true,
    locked: true,
    lockedKey: "pronouns",
  },
  
  {
    type: "phoneNumber",
    title: "What is your phone number?",
    required: true,
    matchable: false,
    locked: true,
    lockedKey: "phone number",
  },
  {
    type: "Dropdown",
    title: "If you are a student, what school do you attend?",
    options: ["University of Maryland", "Other"],
    required: false,
    matchable: true,
    locked: true,
    lockedKey: "school",
  }
]

export type EditorSection = {
  id: string;
  title?: string;
  locked?: boolean;
  questions: EditorQuestion[];
};

export type FormEditorState = {
  sections: EditorSection[];
};

let idCounter = 0;
const createId = (prefix: string) => {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
};

// Converts the Firestore form version into an editor state, adding runtime IDs and potential missing locked questions
const formToState = (form?: Form | null): FormEditorState => {
  if (!form) {
    return { sections: [] };
  }

  const state: FormEditorState = {
      sections: (form.sections ?? []).map((section) => ({
        id: createId("section"),
        title: section.title ?? "",
        locked: section.locked,
        questions: (section.questions ?? []).map((q) => ({
          ...q,
          id: createId("question"),
        })),
      })),
    };

  // Find or create a locked section to hold all required questions
  const lockedSection = state.sections.find((s) => s.locked);

  if (!lockedSection) {
    // Default locked section information
    state.sections.unshift({
      id: createId("section"),
      title: "Basic Information",
      locked: true,
      questions: LOCKED_QUESTIONS.map((lq) => ({ ...lq, id: createId("question") })),
    });
  } else {
    // Inject only missing locked questions into the existing locked section
    const missingLocked = LOCKED_QUESTIONS.filter(
      (lq) => !lockedSection.questions.some((q) => q.lockedKey === lq.lockedKey)
    );
    lockedSection.questions.push(
      ...missingLocked.map((lq) => ({ ...lq, id: createId("question") }))
    );
  }

  return state;
};


// Cleans up the question, removing the id field and optional fields if empty or not relevant
const cleanQuestion = (q: EditorQuestion): Question => {
  const { id: _id, ...rest } = q;
  const cleaned: Question = {
    type: rest.type,
    title: rest.title,
    required: rest.required,
    matchable: rest.matchable,
  };

  if (rest.description && rest.description.trim().length > 0) {
    cleaned.description = rest.description.trim();
  }

  if (["Dropdown", "Radio", "multiple"].includes(rest.type)) {
    cleaned.options = (rest.options ?? []).filter((o) => o.trim().length > 0);
  }

  if (rest.type === "Slider") {
    cleaned.min = typeof rest.min === "number" ? rest.min : 1;
    cleaned.max = typeof rest.max === "number" ? rest.max : 5;
  }

  if (rest.locked) {                                                                                                                                      
    cleaned.locked = rest.locked;
  }                                                                                                                                                       
  if (rest.lockedKey) {                                                                                                                                 
    cleaned.lockedKey = rest.lockedKey;
  }
  return cleaned;
};

// Converts editor state back to a form state before saving to Firestore
const stateToForm = (state: FormEditorState): Form => ({
  sections: state.sections.map((section) => ({
    ...(section.title ? { title: section.title } : {}),
    ...(section.locked ? { locked: section.locked } : {}),
    questions: section.questions.map(cleanQuestion),
  })),
});

// React hook that manages all the editor state for the form builder
export const useFormEditor = (initialForm?: Form | null) => {
  const [state, setState] = useState<FormEditorState>(() =>
    formToState(initialForm),
  );

  const setPresent = useCallback(
    (updater: (current: FormEditorState) => FormEditorState) => {
      setState((current) => {
        const next = updater(current);
        return next === current ? current : next;
      });
    },
    [],
  );

  const loadForm = useCallback((form: Form) => {
    setState(formToState(form));
  }, []);

  const addSection = useCallback(() => {
    setPresent((state) => ({
      ...state,
      sections: [
        ...state.sections,
        {
          id: createId("section"),
          title: `Section ${state.sections.length + 1}`,
          questions: [],
        },
      ],
    }));
  }, [setPresent]);

  const deleteSection = useCallback((id: string) => {
    setPresent((state) => ({
      ...state,
      sections: state.sections.filter(
        (section) => section.id !== id || !!section.locked
      ),
    }));
  }, [setPresent]);

  const updateSectionTitle = useCallback(
    (id: string, title: string) => {
      setPresent((state) => ({
        ...state,
        sections: state.sections.map((section) =>
          section.id === id ? { ...section, title } : section,
        ),
      }));
    },
    [setPresent],
  );
  const reorderSections = useCallback(
    (fromIndex: number, toIndex: number) => {
      setPresent((state) => {
        // Checks if the indexes are valid
        if (
          fromIndex < 0 ||
          fromIndex >= state.sections.length ||
          toIndex < 0 ||
          toIndex >= state.sections.length
        ) {
          return state;
        }
        const sections = [...state.sections];
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        return {
          ...state,
          sections,
        };
      });
    },
    [setPresent],
  );

  const addQuestion = useCallback(
    (sectionId: string, baseQuestion?: Question) => {
      setPresent((state) => ({
        ...state,
        sections: state.sections.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                questions: [
                  ...section.questions,
                  {
                    id: createId("question"),
                    ...(baseQuestion ?? {
                      type: "short_input",
                      title: "",
                      description: "",
                      options: [],
                      min: 1,
                      max: 5,
                      required: true,
                      matchable: false,
                    }),
                  },
                ],
              },
        ),
      }));
    },
    [setPresent],
  );

  const updateQuestion = useCallback(
    (sectionId: string, questionId: string, updated: Question) => {
      setPresent((state) => ({
        ...state,
        sections: state.sections.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                questions: section.questions.map((question) =>
                  question.id === questionId
                    ? { ...updated, id: question.id }
                    : question,
                ),
              },
        ),
      }));
    },
    [setPresent],
  );

  const deleteQuestion = useCallback(
    (sectionId: string, questionId: string) => {
      setPresent((state) => ({
        ...state,
        sections: state.sections.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                questions: section.questions.filter(
                  (question) => question.id !== questionId || !!question.locked
                ),
              },
        ),
      }));
    },
    [setPresent],
  );

  const reorderQuestions = useCallback(
    (sectionId: string, fromIndex: number, toIndex: number) => {
      setPresent((state) => ({
        ...state,
        sections: state.sections.map((section) => {
          if (section.id !== sectionId) return section;
          // Checks if the indexes are valid
          if (
            fromIndex < 0 ||
            fromIndex >= section.questions.length ||
            toIndex < 0 ||
            toIndex >= section.questions.length
          ) {
            return section;
          }
          // Logic reordering the questions
          const nextQuestions = [...section.questions];
          const [moved] = nextQuestions.splice(fromIndex, 1);
          nextQuestions.splice(toIndex, 0, moved);
          return { ...section, questions: nextQuestions };
        }),
      }));
    },
    [setPresent],
  );

  const getForm = useCallback(() => stateToForm(state), [state]);

  const sections = useMemo(() => state.sections, [state]);

  return {
    sections,
    addSection,
    deleteSection,
    updateSectionTitle,
    reorderSections,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    loadForm,
    getForm,
  };
};
