import styles from "../Registration.module.css";

export default function SliderInput({
  name,
  min,
  max,
  required,
  className,
}: {
  name: string;
  min: number;
  max: number;
  required: boolean;
  className?: string;
}) {
  const lo = min ?? 0;
  const hi = max ?? 100;

  return (
    <div className={styles.sliderContainer}>
      <input
        type="range"
        name={name}
        min={lo}
        max={hi}
        step="1"
        defaultValue={lo}
        required={required}
        className={`${styles.slider} ${className ?? ""}`}
      />
      <div className={styles.sliderLabels}>
        {Array.from({ length: hi - lo + 1 }, (_, i) => (
          <span key={i}>{lo + i}</span>
        ))}
      </div>
    </div>
  );
}