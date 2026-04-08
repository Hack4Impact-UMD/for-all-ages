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
    <div id={styles.addr_container}>
      <div id={styles.addr_street}>
        {streetFields.map((f) => (
          <label key={f.key} className={styles.sublabel}>
            <input
              type="text"
              name={`${namePrefix}.${f.key}`}
              required={f.key === "line1" ? required : false}
            />
            {f.label}
          </label>
        ))}
      </div>

      <div id={styles.addr_details}>
        {detailFields.map((f) => (
          <div key={f.key}>
            <label className={styles.sublabel}>
              <input
                type="text"
                name={`${namePrefix}.${f.key}`}
                required={required}
              />
              {f.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}