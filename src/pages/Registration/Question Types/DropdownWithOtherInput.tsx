import { useMemo, useState } from "react";
import styles from "../Registration.module.css";

export default function DropdownWithOtherInput({
  name,
  options,
  required,
  className,
}: {
  name: string;
  options: string[];
  required: boolean;
  className?: string;
}) {
  const [selectedValue, setSelectedValue] = useState("");

  const resolvedOptions = useMemo(
    () => {
      const hasOtherOption = options.some((opt) => opt.trim().toLowerCase() === "other");
      return hasOtherOption ? options : [...options, "Other"];
    },
    [options],
  );
  const showOtherInput = selectedValue.trim().toLowerCase() === "other";

  return (
    <>
      <select
        name={name}
        required={required}
        className={className}
        value={selectedValue}
        onChange={(event) => setSelectedValue(event.target.value)}
      >
        <option value="">Select an option</option>
        {resolvedOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      {showOtherInput && (
        <input
          type="text"
          name={`${name}_other`}
          maxLength={160}
          required={required}
          className={styles.otherFieldInput}
          placeholder="Please specify"
        />
      )}
    </>
  );
}
