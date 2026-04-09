import { useState } from "react";
import styles from "../Registration.module.css";

export default function SliderInput({
  name,
  min,
  max,
  required,
}: {
  name: string;
  min: number;
  max: number;
  required: boolean;
}) {
  const lo = min ?? 1;
  const hi = max ?? 5;
  const [value, setValue] = useState<number | null>(null);

  return (
    <>
      <input type="hidden" name={name} value={value ?? ""} required={required} />
      <div className={styles.ratingRow}>
        <span className={styles.ratingEndLabel}>Strongly Dislike</span>
        {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.ratingButton}${value === n ? ` ${styles.ratingButtonActive}` : ""}`}
            onClick={() => setValue(n)}
          >
            {n}
          </button>
        ))}
        <span className={styles.ratingEndLabel}>Strongly Like</span>
      </div>
    </>
  );
}
