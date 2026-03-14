import styles from "./Registration.module.css";
import { phoneNumberRegex } from "../../regex";
import type { Form, Question, Section } from "../../types";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import ShortInput from "./Question Types/ShortInput";
import MediumInput from "./MediumInput";
import LongInput from "./Question Types/LongInput";
import DropdownInput from "./Question Types/DropdownInput";
import SliderInput from "./Question Types/SliderInput";
import RadioInput from "./Question Types/RadioInput";
import DateInput from "./Question Types/DateInput";
import PhoneNumberInput from "./PhoneNumberInput";
import TextDisplay from "./Question Types/TextDisplay";
import MultipleInput from "./Question Types/MultipleInput";
import AddressInput from "./Question Types/AddressInput";
import ProfilePictureEdit from "../Profile/components/ProfilePictureEdit/ProfilePictureEdit";


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
          <p>profile picture coming soon</p>
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
