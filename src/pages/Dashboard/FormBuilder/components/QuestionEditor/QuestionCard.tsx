import { FaEdit, FaTrash } from "react-icons/fa";
import type { Question, QuestionType } from "../../../../../types";
import styles from "./QuestionEditor.module.css";

type QuestionCardProps = {
  question: Question;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  short_input: "Short Input",
  medium_input: "Medium Input",
  long_input: "Long Input",
  Dropdown: "Dropdown",
  Slider: "Slider",
  Radio: "Radio",
  Date: "Date",
  phoneNumber: "Phone Number",
  text: "Text",
  multiple: "Multiple Choice",
  address: "Address",
  profilePicture: "Profile Picture",
};

export default function QuestionCard({
  question,
  index,
  onEdit,
  onDelete,
}: QuestionCardProps) {
  const optionCount = question.options?.filter((option) => option.trim().length > 0)
    .length;

  return (
    <article className={styles.questionCard}>
      <div className={styles.cardMain}>
        <div className={styles.cardHeader}>
          <span className={styles.questionIndex}>Question {index + 1}</span>
          <span className={styles.typeBadge}>{TYPE_LABELS[question.type]}</span>
        </div>

        <h3 className={styles.questionTitle}>{question.title || "Untitled Question"}</h3>

        {question.description ? (
          <p className={styles.questionDescription}>{question.description}</p>
        ) : null}

        <div className={styles.metaRow}>
          <span
            className={`${styles.metaBadge} ${
              question.required ? styles.metaBadgeActive : ""
            }`}
          >
            {question.required ? "Required" : "Optional"}
          </span>
          <span
            className={`${styles.metaBadge} ${
              question.matchable ? styles.metaBadgeActive : ""
            }`}
          >
            {question.matchable ? "Matchable" : "Not Matchable"}
          </span>
          {typeof optionCount === "number" && optionCount > 0 ? (
            <span className={styles.metaBadge}>{optionCount} options</span>
          ) : null}
          {question.type === "Slider" &&
          typeof question.min === "number" &&
          typeof question.max === "number" ? (
            <span className={styles.metaBadge}>
              Range {question.min} - {question.max}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onEdit}
          aria-label={`Edit ${question.title || `question ${index + 1}`}`}
          title="Edit question"
        >
          <FaEdit aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.deleteButton}`}
          onClick={onDelete}
          aria-label={`Delete ${question.title || `question ${index + 1}`}`}
          title="Delete question"
        >
          <FaTrash aria-hidden />
        </button>
      </div>
    </article>
  );
}
