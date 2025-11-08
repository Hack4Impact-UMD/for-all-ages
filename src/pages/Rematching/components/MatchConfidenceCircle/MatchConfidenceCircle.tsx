import styles from "./MatchConfidenceCircle.module.css";

/**
 * Match Confidence Circle Component
 * Displays the match confidence percentage in a circular format.
 */
interface MatchConfidenceCircleProps {
  confidencePercentage: number | null;
}

export default function MatchConfidenceCircle({
  confidencePercentage,
}: MatchConfidenceCircleProps) {
  return (
    <div className={styles.matchCircle}>
      <div className={styles.confidencePercentage}>
        {confidencePercentage !== null ? `${confidencePercentage}%` : "—%"}
      </div>
      <div className={styles.confidenceLabel}>Match</div>
    </div>
  );
}

