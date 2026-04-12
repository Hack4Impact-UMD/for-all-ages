import { useEffect, useRef, useState } from "react";
import styles from "./Registration.module.css";
import { phoneNumberRegex } from "../../regex";

export default function PhoneNumberInput({
  name,
  required,
}: {
  name: string;
  required: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const confirmPhoneInputRef = useRef<HTMLInputElement | null>(null);

  const isPhoneInvalid = phone !== "" && !phoneNumberRegex.test(phone);
  const isConfirmInvalid =
    confirmPhone !== "" && !phoneNumberRegex.test(confirmPhone);
  const isMismatch =
    phone !== "" && confirmPhone !== "" && phone !== confirmPhone;

  useEffect(() => {
    if (!phoneInputRef.current || !confirmPhoneInputRef.current) {
      return;
    }

    phoneInputRef.current.setCustomValidity(
      isPhoneInvalid ? "Please enter a valid phone number format." : ""
    );

    if (isConfirmInvalid) {
      confirmPhoneInputRef.current.setCustomValidity(
        "Please enter a valid phone number format."
      );
      return;
    }

    if (isMismatch) {
      confirmPhoneInputRef.current.setCustomValidity(
        "Phone numbers must match."
      );
      return;
    }

    confirmPhoneInputRef.current.setCustomValidity("");
  }, [isConfirmInvalid, isMismatch, isPhoneInvalid]);

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Phone Number{required && <span className={styles.requiredStar}> *</span>}</span>
        <input
          ref={phoneInputRef}
          className={styles.fieldInput}
          type="tel"
          name={name}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1"
          required={required}
        />
        {isPhoneInvalid && (
          <span className={styles.errorText}>
            Please enter a valid phone number format.
          </span>
        )}
        <span className={styles.helpText}>
          Valid formats: 123-456-7890, (123) 456-7890, +1 (123) 456-7890
        </span>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Confirm Phone Number{required && <span className={styles.requiredStar}> *</span>}</span>
        <input
          ref={confirmPhoneInputRef}
          className={styles.fieldInput}
          type="tel"
          name={`${name}_confirm`}
          value={confirmPhone}
          onChange={(e) => setConfirmPhone(e.target.value)}
          placeholder="+1"
          required={required}
        />
        {(isMismatch || isConfirmInvalid) && (
          <span className={styles.errorText}>
            {isMismatch
              ? "Phone numbers must match."
              : "Please enter a valid phone number format."}
          </span>
        )}
      </div>
    </div>
  );
}
