import styles from "../Registration.module.css";

export default function RadioInput({
  name,
  options,
  required,
}: {
  name: string;
  options: string[];
  required: boolean;
}) {
  return (
    <div className={styles.radioGroup}>
      {options.map((opt) => (
        <label key={opt} className={styles.radioLabel}>
          <input type="radio" name={name} value={opt} required={required} />
          {opt}
        </label>
      ))}
    </div>
  );
}