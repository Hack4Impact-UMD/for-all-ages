import styles from "../Registration.module.css";

const ADDRESS_FIELDS = [
  { key: "line1", label: "Street Address" },
  { key: "line2", label: "Street Address 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State / Province" },
  { key: "postalCode", label: "Postal / Zip Code" },
  { key: "country", label: "Country" },
] as const;

export default function AddressInput({
  namePrefix,
  required,
}: {
  namePrefix: string;
  required: boolean;
}) {
  const streetFields = ADDRESS_FIELDS.filter(
    (f) => f.key === "line1" || f.key === "line2",
  );

  const detailFields = ADDRESS_FIELDS.filter(
    (f) => f.key !== "line1" && f.key !== "line2",
  );

  return (
    <div>
      {streetFields.map((f) => (
        <div key={f.key} className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{f.label}</span>
          <input
            className={styles.fieldInput}
            type="text"
            name={`${namePrefix}.${f.key}`}
            required={f.key === "line1" ? required : false}
          />
        </div>
      ))}
      <div className={styles.addressSubRow}>
        {detailFields.map((f) => (
          <div key={f.key} className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{f.label}</span>
            <input
              className={styles.fieldInput}
              type="text"
              name={`${namePrefix}.${f.key}`}
              required={required}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
