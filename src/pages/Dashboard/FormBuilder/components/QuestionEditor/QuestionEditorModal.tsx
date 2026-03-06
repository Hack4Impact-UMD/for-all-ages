import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import type { Question, QuestionType } from "../../../../../types";
import styles from "./QuestionEditor.module.css";

type QuestionEditorModalProps = {
  isOpen: boolean;
  initialQuestion: Question;
  onSave: (updatedQuestion: Question) => void;
  onClose: () => void;
};

type QuestionFieldConfig = {
  value: QuestionType;
  label: string;
  supportsOptions: boolean;
  supportsRange: boolean;
};

const QUESTION_TYPE_OPTIONS: QuestionFieldConfig[] = [
  {
    value: "short_input",
    label: "Short Input",
    supportsOptions: false,
    supportsRange: false,
  },
  {
    value: "medium_input",
    label: "Medium Input",
    supportsOptions: false,
    supportsRange: false,
  },
  {
    value: "long_input",
    label: "Long Input",
    supportsOptions: false,
    supportsRange: false,
  },
  {
    value: "Dropdown",
    label: "Dropdown",
    supportsOptions: true,
    supportsRange: false,
  },
  {
    value: "Slider",
    label: "Slider",
    supportsOptions: false,
    supportsRange: true,
  },
  {
    value: "Radio",
    label: "Radio",
    supportsOptions: true,
    supportsRange: false,
  },
  {
    value: "Date",
    label: "Date",
    supportsOptions: false,
    supportsRange: false,
  },
  {
    value: "phoneNumber",
    label: "Phone Number",
    supportsOptions: false,
    supportsRange: false,
  },
  {
    value: "text",
    label: "Text",
    supportsOptions: false,
    supportsRange: false,
  },
  {
    value: "multiple",
    label: "Multiple Choice",
    supportsOptions: true,
    supportsRange: false,
  },
  {
    value: "address",
    label: "Address",
    supportsOptions: false,
    supportsRange: false,
  },
  {
    value: "profilePicture",
    label: "Profile Picture",
    supportsOptions: false,
    supportsRange: false,
  },
];

function normalizeQuestion(question: Question): Question {
  const trimmedTitle = question.title ?? "";
  const trimmedDescription = question.description?.trim() ?? "";
  const normalized: Question = {
    type: question.type,
    title: trimmedTitle,
    required: question.required,
    matchable: question.matchable,
  };

  if (trimmedDescription.length > 0) {
    normalized.description = trimmedDescription;
  }

  if (["Dropdown", "Radio", "multiple"].includes(question.type)) {
    const options = (question.options ?? []).map((option) => option.trim());
    normalized.options = options;
  }

  if (question.type === "Slider") {
    normalized.min = typeof question.min === "number" ? question.min : 1;
    normalized.max = typeof question.max === "number" ? question.max : 5;
  }

  return normalized;
}

export default function QuestionEditorModal({
  isOpen,
  initialQuestion,
  onSave,
  onClose,
}: QuestionEditorModalProps) {
  const [draftQuestion, setDraftQuestion] = useState<Question>(() =>
    normalizeQuestion(initialQuestion),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraftQuestion(normalizeQuestion(initialQuestion));
    setError(null);
  }, [initialQuestion, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const currentTypeConfig = useMemo(
    () =>
      QUESTION_TYPE_OPTIONS.find((option) => option.value === draftQuestion.type) ??
      QUESTION_TYPE_OPTIONS[0],
    [draftQuestion.type],
  );

  if (!isOpen) {
    return null;
  }

  const updateDraft = (updates: Partial<Question>) => {
    setDraftQuestion((previous) => ({ ...previous, ...updates }));
  };

  const handleTextChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;

    if (name === "type") {
      const nextType = value as QuestionType;
      const nextConfig = QUESTION_TYPE_OPTIONS.find((option) => option.value === nextType);
      const nextQuestion: Question = {
        type: nextType,
        title: draftQuestion.title,
        description: draftQuestion.description,
        required: draftQuestion.required,
        matchable: draftQuestion.matchable,
      };

      if (nextConfig?.supportsOptions) {
        nextQuestion.options =
          draftQuestion.options && draftQuestion.options.length > 0
            ? [...draftQuestion.options]
            : [""];
      }

      if (nextConfig?.supportsRange) {
        nextQuestion.min = typeof draftQuestion.min === "number" ? draftQuestion.min : 1;
        nextQuestion.max = typeof draftQuestion.max === "number" ? draftQuestion.max : 5;
      }

      setDraftQuestion(nextQuestion);
      setError(null);
      return;
    }

    updateDraft({ [name]: value } as Partial<Question>);
    if (error) setError(null);
  };

  const handleToggleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    updateDraft({ [name]: checked } as Partial<Question>);
  };

  const handleOptionChange = (index: number, value: string) => {
    const nextOptions = [...(draftQuestion.options ?? [])];
    nextOptions[index] = value;
    updateDraft({ options: nextOptions });
    if (error) setError(null);
  };

  const handleAddOption = () => {
    updateDraft({ options: [...(draftQuestion.options ?? []), ""] });
  };

  const handleRemoveOption = (index: number) => {
    const nextOptions = (draftQuestion.options ?? []).filter((_, itemIndex) => itemIndex !== index);
    updateDraft({ options: nextOptions.length > 0 ? nextOptions : [""] });
  };

  const handleRangeChange = (field: "min" | "max", value: string) => {
    const parsedValue = Number(value);
    updateDraft({ [field]: Number.isNaN(parsedValue) ? 0 : parsedValue } as Partial<Question>);
    if (error) setError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = draftQuestion.title.trim();
    if (!title) {
      setError("Question title is required.");
      return;
    }

    const nextQuestion: Question = {
      type: draftQuestion.type,
      title,
      required: draftQuestion.required,
      matchable: draftQuestion.matchable,
    };

    const description = draftQuestion.description?.trim();
    if (description) {
      nextQuestion.description = description;
    }

    if (currentTypeConfig.supportsOptions) {
      const options = (draftQuestion.options ?? [])
        .map((option) => option.trim())
        .filter((option) => option.length > 0);

      if (options.length === 0) {
        setError("Add at least one option for this question type.");
        return;
      }

      nextQuestion.options = options;
    }

    if (currentTypeConfig.supportsRange) {
      const min = typeof draftQuestion.min === "number" ? draftQuestion.min : 1;
      const max = typeof draftQuestion.max === "number" ? draftQuestion.max : 5;

      if (min > max) {
        setError("Slider minimum cannot be greater than the maximum.");
        return;
      }

      nextQuestion.min = min;
      nextQuestion.max = max;
    }

    onSave(nextQuestion);
    onClose();
  };

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.editorModalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.editorHeader}>
          <h2 id="question-editor-title" className={styles.editorTitle}>
            Edit Question
          </h2>
          <p className={styles.editorSubtitle}>{currentTypeConfig.label}</p>
        </header>

        <form className={styles.editorForm} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="question-title" className={styles.fieldLabel}>
              Question Title
            </label>
            <input
              id="question-title"
              name="title"
              type="text"
              value={draftQuestion.title}
              onChange={handleTextChange}
              className={styles.textInput}
              placeholder="Enter question title"
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="question-description" className={styles.fieldLabel}>
              Description
            </label>
            <textarea
              id="question-description"
              name="description"
              value={draftQuestion.description ?? ""}
              onChange={handleTextChange}
              className={`${styles.textInput} ${styles.textArea}`}
              placeholder="Optional helper text"
              rows={3}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="question-type" className={styles.fieldLabel}>
              Input Type
            </label>
            <select
              id="question-type"
              name="type"
              value={draftQuestion.type}
              onChange={handleTextChange}
              className={styles.textInput}
            >
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.toggleGrid}>
            <label className={styles.toggleCard}>
              <input
                type="checkbox"
                name="required"
                checked={draftQuestion.required}
                onChange={handleToggleChange}
                className={styles.toggleInput}
              />
              <span className={styles.toggleLabel}>Required</span>
            </label>
            <label className={styles.toggleCard}>
              <input
                type="checkbox"
                name="matchable"
                checked={draftQuestion.matchable}
                onChange={handleToggleChange}
                className={styles.toggleInput}
              />
              <span className={styles.toggleLabel}>Matchable</span>
            </label>
          </div>

          {currentTypeConfig.supportsOptions ? (
            <section className={styles.configCard}>
              <div className={styles.configHeader}>
                <h3 className={styles.configTitle}>Answer Options</h3>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={handleAddOption}
                >
                  <FaPlus aria-hidden />
                  <span>Add Option</span>
                </button>
              </div>

              <div className={styles.optionList}>
                {(draftQuestion.options ?? []).map((option, index) => (
                  <div key={`${index}-${draftQuestion.type}`} className={styles.optionRow}>
                    <input
                      type="text"
                      value={option}
                      onChange={(event) => handleOptionChange(index, event.target.value)}
                      className={styles.textInput}
                      placeholder={`Option ${index + 1}`}
                    />
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.deleteButton}`}
                      onClick={() => handleRemoveOption(index)}
                      aria-label={`Remove option ${index + 1}`}
                    >
                      <FaTrash aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {currentTypeConfig.supportsRange ? (
            <section className={styles.configCard}>
              <div className={styles.configHeader}>
                <h3 className={styles.configTitle}>Slider Range</h3>
              </div>
              <div className={styles.rangeGrid}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="slider-min" className={styles.fieldLabel}>
                    Minimum
                  </label>
                  <input
                    id="slider-min"
                    type="number"
                    value={draftQuestion.min ?? 1}
                    onChange={(event) => handleRangeChange("min", event.target.value)}
                    className={styles.textInput}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="slider-max" className={styles.fieldLabel}>
                    Maximum
                  </label>
                  <input
                    id="slider-max"
                    type="number"
                    value={draftQuestion.max ?? 5}
                    onChange={(event) => handleRangeChange("max", event.target.value)}
                    className={styles.textInput}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {error ? <div className={styles.errorMessage}>{error}</div> : null}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className={styles.submitButton}>
              Save Question
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
