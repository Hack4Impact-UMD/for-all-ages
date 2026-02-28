import styles from "./Registration.module.css";
import { phoneNumberRegex } from "../../regex";
import type { Form, Question } from "../../types";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Sample form data (drive the form from this object)
// ---------------------------------------------------------------------------

const SAMPLE_FORM: Form = {
  sections: [
    {
      title: "Contact Information",
      questions: [
        {
          type: "address",
          title: "Current Mailing Address",
          required: true,
          matchable: false,
        },
        {
          type: "phoneNumber",
          title: "Phone Number",
          description: "We'll use this to coordinate matches.",
          required: true,
          matchable: false,
        },
        {
          type: "short_input",
          title: "Email",
          required: true,
          matchable: false,
        },
      ],
    },
    {
      title: "About You",
      questions: [
        {
          type: "Date",
          title: "Date of Birth",
          required: true,
          matchable: false,
        },
        {
          type: "short_input",
          title: "Preferred Pronouns",
          required: true,
          matchable: false,
        },
        {
          type: "Dropdown",
          title: "How did you hear about this program?",
          options: [
            "Social Media",
            "Word-of-mouth",
            "Referral",
            "Returning member",
            "Advertisement",
            "Other",
          ],
          required: true,
          matchable: false,
        },
        {
          type: "Radio",
          title: "Are you a college student or an adult?",
          options: ["Student", "Adult"],
          required: true,
          matchable: false,
        },
        {
          type: "long_input",
          title: "What are your interests?",
          description: "This will help us pair you with your Tea-mate!",
          required: true,
          matchable: true,
        },
        {
          type: "Radio",
          title: "What type of tea do you prefer?",
          options: ["Black", "Green", "Herbal", "Variety"],
          required: true,
          matchable: true,
        },
        {
          type: "Slider",
          title: "How much do you enjoy quiet conversation?",
          min: 1,
          max: 5,
          required: false,
          matchable: true,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Small input components (uncontrolled; no submission logic)
// ---------------------------------------------------------------------------

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
      max={today}
      required={required}
      className={`${styles.dob} ${className ?? ""}`}
    />
  );
}

function PhoneNumberInput({
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
            {f.key === "line1" && (
              <span className={styles.label}>Current Mailing Address</span>
            )}
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
// Question renderer: maps question.type to the right UI
// ---------------------------------------------------------------------------

function QuestionRenderer({
  question,
  name,
}: {
  question: Question;
  name: string;
}) {
  const { type, title, description, options, min, max, required } = question;
  const requiredMark = required ? " *" : "";
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
      return (
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
          <PhoneNumberInput name={name} required={required} />
        </>
      );
    case "text":
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
          <span className={styles.label}>
            {title}
            {requiredMark}
          </span>
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
      return (
        <label className={styles.label}>
          {labelContent}
          <ShortInput name={name} required={required} />
        </label>
      );
  }
}

// ---------------------------------------------------------------------------
// Form renderer: loops sections and questions
// ---------------------------------------------------------------------------

function FormRenderer({ form }: { form: Form }) {
  return (
    <>
      {form.sections.map((section, sectionIndex) => (
        <div
          key={sectionIndex}
          className={styles.section}
          style={{ marginTop: sectionIndex > 0 ? "2.5rem" : 0 }}
        >
          {section.title && (
            <h2 className={styles.sectionTitle}>{section.title}</h2>
          )}
          {section.questions.map((question, questionIndex) => (
            <QuestionRenderer
              key={questionIndex}
              question={question}
              name={`s${sectionIndex}_q${questionIndex}`}
            />
          ))}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

const RegistrationNew = () => {
  return (
    <form id={styles.page} onSubmit={(e) => e.preventDefault()}>
      <FormRenderer form={SAMPLE_FORM} />
      <button id={styles.submit} type="submit" disabled>
        Submit
      </button>
    </form>
  );
};

export default RegistrationNew;
