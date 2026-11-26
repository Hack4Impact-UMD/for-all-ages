import styles from "../Registration.module.css";

export default function RadioInput({
  name,
  options,
  required,
  defaultValue,
}: {
  name: string;
  options: string[];
  required: boolean;
  defaultValue?: string;
}) {
  return (
    <div className={styles.radioGroup}>
      {options.map((opt) => (
        <label key={opt} className={styles.radioLabel}>
          <input
            type="radio"
            name={name}
            value={opt}
            required={required}
            defaultChecked={opt === defaultValue}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}