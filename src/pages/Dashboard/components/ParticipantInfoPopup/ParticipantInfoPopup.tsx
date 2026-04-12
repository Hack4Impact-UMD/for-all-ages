import styles from "./ParticipantInfoPopup.module.css";
import CloseIcon from "@mui/icons-material/Close";
import type { FormResponse } from "../../../../types";

type ParticipantInfoPopupProps = {
  userName: string;
  onClose: () => void;
  formResponses: FormResponse | null;
  loading: boolean;
  error: string | null;
};

/**
 * Pop-up component for easily viewing a user's registration form responses.
 */
export default function ParticipantInfoPopup({
  userName,
  onClose,
  formResponses,
  loading,
  error,
}: ParticipantInfoPopupProps) {
  return (
		// Shadow background behind popup; clicking outside of the pop-up exits out of it
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}> {/* Body of the popup */}
				{/* Display user's name at the top of the popup */}
        <h1 className={styles.userName}>{userName}</h1>

				{/* Button to exit out of popup */}
        <CloseIcon onClick={onClose} className={styles.xbutton} />

        {loading ? (
          <p>Loading form responses…</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : formResponses ? (
          (() => {
						// Any answer that isn't a 'long_input' type or is < 75 chars long uses one grid space
            const shortQuestions = formResponses.questions.filter(
              (question) => {
                if (question.type !== "long_input") return true;
                return String(question.answer).trim().length < 75;
              },
            );
						// Any long answer greater than 75 characters long uses up an entire row
            const longQuestions = formResponses.questions.filter((question) => {
              if (question.type !== "long_input") return false;
              return String(question.answer).trim().length >= 75;
            });

						// Organize grids into rows for alternate coloring
            const rows: Array<{
              type: "short" | "long";
              items: typeof formResponses.questions;
            }> = [];

						// 3 questions per row
            for (let i = 0; i < shortQuestions.length; i += 3) {
              rows.push({
                type: "short",
                items: shortQuestions.slice(i, i + 3),
              });
            }

            longQuestions.forEach((question) => {
              rows.push({
                type: "long",
                items: [question],
              });
            });

            return (
              <div className={styles.grid}>
                {rows.map((row, rowIndex) => (
									// Use alternate coloring based on rowIndex
                  <div
                    key={`row-${rowIndex}`}
                    className={`${styles.gridRow} ${
                      rowIndex % 2 === 1 ? styles.altRow : ""
                    } ${row.type === "long" ? styles.longRow : ""}`}
                  >

										{/* Display each question title and answer */}
                    {row.items.map((question, index) => (
                      <div
                        key={`${row.type}-${rowIndex}-${index}`}
                        className={styles.questionItem}
                      >
                        <h4>{question.title}</h4>
                        <p>{String(question.answer)}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
					// Display this if the user has no FormResponse document in Firebase
          <p>No form responses found.</p>
        )}
      </div>
    </div>
  );
}
