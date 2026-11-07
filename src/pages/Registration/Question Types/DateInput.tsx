import styles from "../Registration.module.css";
import { toLocalDateString } from "../../../utils/age";

export default function DateInput({
  name,
  required,
  className,
  min,
  max,
}: {
  name: string;
  required: boolean;
  className?: string;
  min?: string;
  max?: string;
}) {
  return (
    <input
      type="date"
      name={name}
      min={min}
      max={max ?? toLocalDateString(new Date())}
      required={required}
      className={className ?? styles.fieldInput}
      style={{ maxWidth: 250 }}
    />
  );
}
