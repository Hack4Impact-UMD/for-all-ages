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
  const today = new Date().toISOString().split("T")[0];

  return (
    <input
      type="date"
      name={name}
      max={today}
      required={required}
      className={`${styles.dob} ${className ?? ""}`}
    />
  );
}