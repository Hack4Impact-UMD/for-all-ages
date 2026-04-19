import { useMemo, useState } from "react";
import styles from "../Registration.module.css";

/**
 * DropdownWithOtherInput: A dropdown component that always includes an "Other" option.
 * When "Other" is selected, a text input field appears below the dropdown to allow
 * users to provide a custom value. The custom text is stored with the field name suffix "_other".
 *
 * Props:
 * - name: The form field name for the dropdown
 * - options: Array of dropdown options (will auto-append "Other" if not present)
 * - required: Whether the field is required
 * - className: CSS class to apply to the select element
 */
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

  // Ensure "Other" option exists exactly once (case-insensitive check)
  // If already present, use original options; otherwise append it.
  const resolvedOptions = useMemo(
    () => {
      const hasOtherOption = options.some((opt) => opt.trim().toLowerCase() === "other");
      return hasOtherOption ? options : [...options, "Other"];
    },
    [options],
  );

  // Show the custom text input only when "Other" is selected
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

      {/* Conditional text input for custom "Other" value */}
      {/* Field name pattern: "{name}_other" for form data extraction */}
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
