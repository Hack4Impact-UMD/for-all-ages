import styles from "../Registration.module.css";

export default function TextDisplay({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.infoBox}>
      <span className={styles.infoBoxTitle}>{title}</span>
      {description && (
        <p style={{ margin: "0.5rem 0 0" }}>{description}</p>
      )}
    </div>
  );
}
