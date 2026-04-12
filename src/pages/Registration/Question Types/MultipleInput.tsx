import styles from "../Registration.module.css";

export default function MultipleInput({
  name,
  options,
}: {
  name: string;
  options: string[];
  required: boolean;
}) {
  return (
    <div>
      {options.map((opt) => (
        <label key={opt} className={styles.checkboxRow}>
          <input type="checkbox" name={name} value={opt} />
          {opt}
        </label>
      ))}
    </div>
  );
}
