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

function getPronouns(participant: RematchingParticipant): string | null {
  if (participant.pronouns) return participant.pronouns;
  if (!participant.matchableAnswers) return null;
  const entry = Object.entries(participant.matchableAnswers).find(([title]) => {
    const t = title.trim().toLowerCase();
    return t.includes("pronouns") || t.includes("gender");
  });
  return entry ? String(entry[1]).trim().replace(/\\/g, "/") : null;
}

export default function ParticipantCard({
  participant,
  isSelected,
  onClick,
  isStudentColumn,
  compatibilityPercentage,
}: ParticipantCardProps) {
  const pronouns = getPronouns(participant);
  return (
    <div
      className={`${styles.participantCard} ${
        isSelected ? styles.selected : ""
      } ${isStudentColumn ? styles.studentCard : styles.adultCard}`}
      onClick={onClick}
    >
      <div className={styles.participantName}>{participant.name}</div>
      {pronouns && <div className={styles.participantPronouns}>{pronouns}</div>}
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

