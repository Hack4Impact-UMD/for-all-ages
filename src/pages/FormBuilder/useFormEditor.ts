import { useCallback, useMemo, useState } from "react";
import type { Form, Question as BaseQuestion } from "../../types";

export type EditorQuestion = BaseQuestion & { id: string };

export type EditorSection = {
  id: string;
  title?: string;
  questions: EditorQuestion[];
};

export type FormEditorState = {
  sections: EditorSection[];
};

type History<T> = {
  past: T[];
  present: T;
};

let idCounter = 0;
const createId = (prefix: string) => {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
};

const formToState = (form?: Form | null): FormEditorState => {
  if (!form) {
    return { sections: [] };
  }

  return {
    sections: (form.sections ?? []).map((section) => ({
      id: createId("section"),
      title: section.title ?? "",
      questions: (section.questions ?? []).map((question) => ({
        ...question,
        id: createId("question"),
      })),
    })),
  };
};

const cleanQuestion = (q: EditorQuestion): BaseQuestion => {
  const { id: _id, ...rest } = q;
  const cleaned: BaseQuestion = {
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

  return cleaned;
};

const stateToForm = (state: FormEditorState): Form => ({
  sections: state.sections.map((section) => ({
    title: section.title || undefined,
    questions: section.questions.map(cleanQuestion),
  })),
});

const createInitialHistory = (
  initialForm?: Form | null,
): History<FormEditorState> => {
  const initial = formToState(initialForm);
  return {
    past: [],
    present: initial,
  };
};

export const useFormEditor = (initialForm?: Form | null) => {
  const [history, setHistory] = useState<History<FormEditorState>>(() =>
    createInitialHistory(initialForm),
  );

  const setPresent = useCallback(
    (updater: (current: FormEditorState) => FormEditorState) => {
      setHistory((current) => {
        const newPresent = updater(current.present);
        if (newPresent === current.present) {
          return current;
        }
        return {
          past: [...current.past, current.present],
          present: newPresent,
        };
      });
    },
    [],
  );

  const loadForm = useCallback((form: Form) => {
    setHistory({
      past: [],
      present: formToState(form),
    });
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

  const deleteSection = useCallback(
    (id: string) => {
      setPresent((state) => ({
        ...state,
        sections: state.sections.filter((section) => section.id !== id),
      }));
    },
    [setPresent],
  );

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
        //checks if the indexes are valid
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
    (sectionId: string, baseQuestion?: BaseQuestion) => {
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
    (sectionId: string, questionId: string, updated: BaseQuestion) => {
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
                  (question) => question.id !== questionId,
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
          //checks if the indexes are valid
          if (
            fromIndex < 0 ||
            fromIndex >= section.questions.length ||
            toIndex < 0 ||
            toIndex >= section.questions.length
          ) {
            return section;
          }
          // actual logic reordering the questions
          const nextQuestions = [...section.questions];
          const [moved] = nextQuestions.splice(fromIndex, 1);
          nextQuestions.splice(toIndex, 0, moved);
          return { ...section, questions: nextQuestions };
        }),
      }));
    },
    [setPresent],
  );

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
      };
    });
  }, []);

  const getForm = useCallback(
    () => stateToForm(history.present),
    [history.present],
  );

  const canUndo = history.past.length > 0;

  const sections = useMemo(() => history.present.sections, [history.present]);

  return {
    sections,
    canUndo,
    addSection,
    deleteSection,
    updateSectionTitle,
    reorderSections,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    undo,
    loadForm,
    getForm,
  };
};
