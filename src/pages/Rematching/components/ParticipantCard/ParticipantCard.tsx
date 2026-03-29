import styles from "./ParticipantCard.module.css";
import type { RematchingParticipant } from "../../Rematching";

/**
 * Participant Card Component
 * Displays a single participant with their name and score details.
 */
interface ParticipantCardProps {
  participant: RematchingParticipant;
  isSelected: boolean;
  onClick: () => void;
  isStudentColumn: boolean;
  compatibilityPercentage?: number | null;
}

export default function ParticipantCard({
  participant,
  isSelected,
  onClick,
  isStudentColumn,
  compatibilityPercentage,
}: ParticipantCardProps) {
  return (
    <div
      className={`${styles.participantCard} ${
        isSelected ? styles.selected : ""
      } ${isStudentColumn ? styles.studentCard : styles.adultCard}`}
      onClick={onClick}
    >
      <div className={styles.participantName}>{participant.name}</div>
      {isStudentColumn && participant.school && (
        <div className={styles.participantSchool}>{participant.school}</div>
      )}
      {compatibilityPercentage !== null && compatibilityPercentage !== undefined && (
        <div className={styles.compatibilityScore}>
          Compatibility: {Math.round(compatibilityPercentage)}%
        </div>
      )}
    </div>
  );
}

