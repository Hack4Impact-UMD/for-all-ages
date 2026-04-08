import { useState } from "react";
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

  const isPhoneInvalid = phone !== "" && !phoneNumberRegex.test(phone);
  const isConfirmInvalid =
    confirmPhone !== "" && !phoneNumberRegex.test(confirmPhone);
  const isMismatch =
    phone !== "" && confirmPhone !== "" && phone !== confirmPhone;

  return (
    <div className={styles.confirm}>
      <label className={styles.label}>
        Phone Number
        <input
          type="tel"
          name={name}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(XXX) XXX-XXXX"
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
      </label>

      <label className={styles.label}>
        Confirm Phone Number
        <input
          type="tel"
          name={`${name}_confirm`}
          value={confirmPhone}
          onChange={(e) => setConfirmPhone(e.target.value)}
          placeholder="(XXX) XXX-XXXX"
          required={required}
        />
        {(isMismatch || isConfirmInvalid) && (
          <span className={styles.errorText}>
            {isMismatch
              ? "Phone numbers must match."
              : "Please enter a valid phone number format."}
          </span>
        )}
      </label>
    </div>
  );
}