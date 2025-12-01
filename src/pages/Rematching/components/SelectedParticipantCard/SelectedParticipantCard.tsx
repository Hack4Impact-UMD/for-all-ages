import styles from "./SelectedParticipantCard.module.css";
import type { RematchingParticipant } from "../../Rematching";

/**
 * Selected Participant Card Component
 * Displays a selected participant in the match details column.
 * Clicking deselects the participant. Always visible, even when empty.
 */
interface SelectedParticipantCardProps {
  label: string;
  participant: RematchingParticipant | null;
  onDeselect: () => void;
  type: "student" | "adult";
}

export default function SelectedParticipantCard({
  label,
  participant,
  onDeselect,
  type,
}: SelectedParticipantCardProps) {
  const isEmpty = !participant;

  return (
    <div
      className={`${styles.selectedCard} ${
        type === "student"
          ? styles.selectedStudentCard
          : styles.selectedAdultCard
      } ${isEmpty ? styles.emptyCard : ""}`}
      onClick={isEmpty ? undefined : onDeselect}
      style={{ cursor: isEmpty ? "default" : "pointer" }}
    >
      <div
        className={`${styles.selectedLabel} ${
          type === "student" ? styles.studentLabel : styles.adultLabel
        }`}
      >
        {label}
      </div>

      {participant ? (
        <>
          <div className={styles.selectedName}>{participant.name}</div>
          {type === "student" && participant.school && (
            <div className={styles.participantSchool}>{participant.school}</div>
          )}
          <div
            className={`${styles.interests} ${
              type === "student"
                ? styles.studentInterests
                : styles.adultInterests
            }`}
          >
          </div>
        </>
      ) : (
        <div className={styles.emptyCardContent}>—</div>
      )}
    </div>
  );
}

