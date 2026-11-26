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
  /** Set when this participant was the selected person's partner before. */
  isPastPartner?: boolean;
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
  isPastPartner = false,
}: ParticipantCardProps) {
  const pronouns = getPronouns(participant);
  return (
    <div
      className={`${styles.participantCard} ${
        isSelected ? styles.selected : ""
      } ${isStudentColumn ? styles.studentCard : styles.adultCard} ${
        isPastPartner ? styles.pastPartner : ""
      }`}
      onClick={isPastPartner ? undefined : onClick}
      aria-disabled={isPastPartner || undefined}
      title={
        isPastPartner
          ? "Already partnered in a previous cohort, so they can't be matched again."
          : undefined
      }
    >
      <div className={styles.participantName}>{participant.name}</div>
      {isPastPartner && <div className={styles.pastPartnerLabel}>Past partner</div>}
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

