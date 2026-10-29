import styles from "../Registration.module.css";

export default function DateInput({
  name,
  required,
  className,
}: {
  name: string;
  required: boolean;
  className?: string;
}) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const oldest = new Date(now);
  oldest.setFullYear(now.getFullYear() - 110);
  const min = oldest.toISOString().split("T")[0];

  return (
    <input
      type="date"
      name={name}
      min={min}
      max={today}
      required={required}
      className={className ?? styles.fieldInput}
      style={{ maxWidth: 250 }}
    />
  );
}
