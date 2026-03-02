import styles from "./Registration.module.css";
import { phoneNumberRegex } from "../../regex";
import type { Form, Question, Section } from "../../types";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

// ---------------------------------------------------------------------------
// Small input components (uncontrolled; no submission logic)
// Each of these simply renders an appropriate HTML input element.
// ---------------------------------------------------------------------------

// renders a single-line text input limited to 160 characters
function ShortInput({
  name,
  required,
  className,
}: {
  name: string;
  required: boolean;
  className?: string;
}) {
  return (
    <input
      type="text"
      name={name}
      maxLength={160}
      required={required}
      className={className}
    />
  );
}
// renders a single-line text input limited to 320 characters
function MediumInput({
  name,
  required,
  className,
}: {
  name: string;
  required: boolean;
  className?: string;
}) {
  return (
    <input
      type="text"
      name={name}
      maxLength={320}
      required={required}
      className={className}
    />
  );
}
// renders a single-line text input limited to 1000 characters
function LongInput({
  name,
  required,
  className,
  id,
}: {
  name: string;
  required: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <textarea
      id={id}
      name={name}
      maxLength={1000}
      rows={5}
      required={required}
      className={className}
    />
  );
}

function DropdownInput({
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
  return (
    <select name={name} required={required} className={className}>
      <option value="" disabled>
        Select an option
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
// slider for preferences (e.g., prefer quiet - prefer social)
function SliderInput({
  name,
  min,
  max,
  required,
  className,
}: {
  name: string;
  min: number;
  max: number;
  required: boolean;
  className?: string;
}) {
  const lo = min ?? 0;
  const hi = max ?? 100;
  return (
    <div className={styles.sliderContainer}>
      <input
        type="range"
        name={name}
        min={lo}
        max={hi}
        step="1"
        defaultValue={lo}
        required={required}
        className={`${styles.slider} ${className ?? ""}`}
      />
      <div className={styles.sliderLabels}>
        {Array.from({ length: hi - lo + 1 }, (_, i) => (
          <span key={i}>{lo + i}</span>
        ))}
      </div>
    </div>
  );
}

function RadioInput({
  name,
  options,
  required,
}: {
  name: string;
  options: string[];
  required: boolean;
}) {
  return (
    <div className={styles.radioGroup}>
      {options.map((opt) => (
        <label key={opt}>
          <input type="radio" name={name} value={opt} required={required} />
          {opt}
        </label>
      ))}
    </div>
  );
}

// date picker that prevents selecting future dates
function DateInput({
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
      max={today} // disallow future birth dates, etc.
      required={required}
      className={`${styles.dob} ${className ?? ""}`}
    />
  );
}

// composite component for phone entry with confirmation and inline validation
function PhoneNumberInput({name, required}: {name: string; required: boolean;}) {
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  // validation flags for user feedback
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

// displays static text label and optional description
function TextDisplay({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.label}>
      <span className={styles.label}>{title}</span>
      {description && (
        <span className={styles.helpText} style={{ marginTop: "0.25rem" }}>
          {description}
        </span>
      )}
    </div>
  );
}

// renders a group of checkboxes allowing multiple selections
function MultipleInput({
  name,
  options,
}: {
  name: string;
  options: string[];
  required: boolean;
}) {
  return (
    <div className={styles.checkboxGroup}>
      {options.map((opt) => (
        <label key={opt} className={styles.checkboxLabel}>
          <input type="checkbox" name={name} value={opt} />
          {opt}
        </label>
      ))}
    </div>
  );
}

const ADDRESS_FIELDS = [
  { key: "line1", label: "Street Address" },
  { key: "line2", label: "Street Address 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State / Province" },
  { key: "postalCode", label: "Postal / Zip Code" },
  { key: "country", label: "Country" },
] as const;

// constructs a multi-field address input, splitting street vs other details
function AddressInput({
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
            {f.key === "line1"}
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

function ProfilePictureInput({ name }: { name: string }) {
  return (
    <input type="file" name={name} accept="image/*" className={styles.label} />
  );
}

// ---------------------------------------------------------------------------
// Question renderer: selects appropriate input based on a question's type
// and wraps it with the question's label/description markup
// ---------------------------------------------------------------------------

function QuestionRenderer({
  question,
  name,
}: {
  question: Question;
  name: string;
}) {
  // destructure to simplify access below
  const { type, title, description, options, min, max, required } = question;
  const requiredMark = ""; // placeholder for future asterisk logic

  // common label section shown above every input
  const labelContent = (
    <>
      <span className={styles.label}>
        {title}
        {requiredMark}
      </span>
      {description && (
        <span className={styles.helpText} style={{ marginTop: "0.25rem" }}>
          {description}
        </span>
      )}
    </>
  );

  switch (type) {
    case "short_input":
      // simple text field
      return (
        <label className={styles.label}>
          {labelContent}
          <ShortInput name={name} required={required} />
        </label>
      );
    case "medium_input":
      return (
        <label className={styles.label}>
          {labelContent}
          <MediumInput name={name} required={required} />
        </label>
      );
    case "long_input":
      return (
        <label className={styles.label}>
          {labelContent}
          <LongInput name={name} required={required} id={styles.interests} />
        </label>
      );
    case "Dropdown":
      return (
        <label className={styles.label}>
          {labelContent}
          <DropdownInput
            name={name}
            options={options ?? []}
            required={required}
          />
        </label>
      );
    case "Slider":
      return (
        <label className={styles.label}>
          {labelContent}
          <SliderInput
            name={name}
            min={min ?? 1}
            max={max ?? 5}
            required={required}
          />
        </label>
      );
    case "Radio":
      return (
        <label className={styles.label}>
          {labelContent}
          <RadioInput name={name} options={options ?? []} required={required} />
        </label>
      );
    case "Date":
      return (
        <label className={styles.label}>
          {labelContent}
          <DateInput name={name} required={required} />
        </label>
      );
    case "phoneNumber":
      // phone input includes its own labels/descriptions internally
      return <PhoneNumberInput name={name} required={required} />;
    case "text":
      // purely informational text block
      return (
        <TextDisplay title={title + requiredMark} description={description} />
      );
    case "multiple":
      return (
        <label className={styles.label}>
          {labelContent}
          <MultipleInput
            name={name}
            options={options ?? []}
            required={required}
          />
        </label>
      );
    case "address":
      return (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span className={styles.label}>{title}{requiredMark}</span>
            {description && (
              <span className={styles.helpText}>
                ({description})
              </span>
            )}
            
          </div>
          <AddressInput namePrefix={name} required={required} />
        </>
      );
    case "profilePicture":
      return (
        <label className={styles.label}>
          {labelContent}
          <ProfilePictureInput name={name} />
        </label>
      );
    default:
      // fallback to short input if type isn't recognized
      return (
        <label className={styles.label}>
          {labelContent}
          <ShortInput name={name} required={required} />
        </label>
      );
  }
}

// ---------------------------------------------------------------------------
// Form renderer: iterates over sections and delegates each question to
// QuestionRenderer with a unique name identifier.
// ---------------------------------------------------------------------------

function FormRenderer({ form }: { form: Form }) {
  return (
    <>
      {form.sections.map((section: Section, sectionIndex) => (
        <div
          key={sectionIndex}
          className={styles.section}
          style={{ marginTop: sectionIndex > 0 ? "2.5rem" : 0 }}
        >
          {section.questions.map((question, questionIndex) => (
            <QuestionRenderer
              key={questionIndex}
              question={question}
              name={`s${sectionIndex}_q${questionIndex}`} // unique field name
            />
          ))}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page component handles loading the form data from Firestore and
// conditionally rendering the form or status messages.
// ---------------------------------------------------------------------------

const RegistrationNew = () => {
  // local state for the fetched configuration
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);

  // on mount, pull the form schema from Firestore
  useEffect(() => {
    const fetchForm = async () => {
      try {
        const docRef = doc(db, "config", "registrationForm");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          console.log(JSON.stringify(docSnap.data(), null, 2));
          setForm(docSnap.data() as Form);
        } else {
          console.error("No registrationForm document found");
        }
      } catch (err) {
        console.error("Error fetching form:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, []);

  // Show loading or form loading error
  if (loading) return <p>Loading...</p>;
  if (!form) return <p>Form not found.</p>;

  // once loaded, render the dynamic form; submission is disabled
  // until real handling is added elsewhere
  return (
    <form id={styles.page} onSubmit={(e) => e.preventDefault()}>
      <FormRenderer form={form} />
      <button id={styles.submit} type="submit" disabled>
        Submit
      </button>
    </form>
  );
};

export default RegistrationNew;
