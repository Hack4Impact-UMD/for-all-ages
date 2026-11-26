import styles from "../Registration.module.css";

export default function MultipleInput({
  name,
  options,
  defaultValues,
}: {
  name: string;
  options: string[];
  required: boolean;
  defaultValues?: string[];
}) {
  return (
    <div>
      {options.map((opt) => (
        <label key={opt} className={styles.checkboxRow}>
          <input
            type="checkbox"
            name={name}
            value={opt}
            defaultChecked={defaultValues?.includes(opt) ?? false}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}
