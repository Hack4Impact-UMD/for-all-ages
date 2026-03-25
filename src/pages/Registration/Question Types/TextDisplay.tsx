import styles from "../Registration.module.css";

export default function TextDisplay({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.label}>
      <span className={styles.label}>{title}</span>
      {description && (
        <span className={styles.helpText} style={{ marginTop: "0.25rem" }}>
          {description}
        </span>
      )}
    </div>
  );
}