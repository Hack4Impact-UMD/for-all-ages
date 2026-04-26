import { useState } from "react";
import styles from "./Registration.module.css";
import { formatPhone, stripPhone, isValidPhone } from "../../utils/phone";

export default function PhoneNumberInput({
  name,
  required,
}: {
  name: string;
  required: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPhone(formatPhone(e.target.value));
  };

  const isPhoneInvalid = phone !== "" && !isValidPhone(phone);
  const isConfirmInvalid = confirmPhone !== "" && !isValidPhone(confirmPhone);
  const isMismatch =
    phone !== "" &&
    confirmPhone !== "" &&
    stripPhone(phone) !== stripPhone(confirmPhone);

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          Phone Number{required && <span className={styles.requiredStar}> *</span>}
        </span>
        <input
          className={styles.fieldInput}
          type="tel"
          value={phone}
          onChange={handlePhoneChange}
          placeholder="(xxx) xxx-xxxx"
        />
        {/* Hidden input submits the clean 10-digit value */}
        <input type="hidden" name={name} value={stripPhone(phone)} />
        {isPhoneInvalid && (
          <span className={styles.errorText}>
            Please enter a valid 10-digit phone number.
          </span>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          Confirm Phone Number{required && <span className={styles.requiredStar}> *</span>}
        </span>
        <input
          className={styles.fieldInput}
          type="tel"
          value={confirmPhone}
          onChange={handleConfirmChange}
          placeholder="(xxx) xxx-xxxx"
        />
        <input type="hidden" name={`${name}_confirm`} value={stripPhone(confirmPhone)} />
        {(isMismatch || isConfirmInvalid) && (
          <span className={styles.errorText}>
            {isMismatch
              ? "Phone numbers must match."
              : "Please enter a valid 10-digit phone number."}
          </span>
        )}
      </div>
    </div>
  );
}
