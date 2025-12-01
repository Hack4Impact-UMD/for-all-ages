import styles from "./ParticipantCard.module.css";
import type { RematchingParticipant } from "../../Rematching";

/**
 * Participant Card Component
 * Displays a single participant with their name, school (for students), and interests.
 */
interface ParticipantCardProps {
  participant: RematchingParticipant;
  isSelected: boolean;
  onClick: () => void;
  isStudentColumn: boolean;
}

export default function ParticipantCard({
  participant,
  isSelected,
  onClick,
  isStudentColumn,
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
    </div>
  );
}

