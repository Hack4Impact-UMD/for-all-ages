import styles from "./Registration.module.css";
import { phoneNumberRegex } from "../../regex";
import type { Form, Question, Section, FormResponse, Participant, Questions, RawAddress } from "../../types";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, upsertUser } from "../../firebase";
import { useAuth } from "../../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

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

type QuestionWithFieldName = {
  question: Question;
  fieldName: string;
};

const BASIC_FIELD_KEYS = {
  displayName: "displayName",
  email: "email",
  phoneNumber: "phoneNumber",
  address: "address",
  userType: "user_type",
} as const;

const RegistrationNew = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // local state for the fetched configuration
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const getQuestionEntries = (formConfig: Form): QuestionWithFieldName[] => {
    const entries: QuestionWithFieldName[] = [];
    formConfig.sections.forEach((section, sectionIndex) => {
      section.questions.forEach((question, questionIndex) => {
        entries.push({
          question,
          fieldName: `s${sectionIndex}_q${questionIndex}`,
        });
      });
    });
    return entries;
  };

  const isDisplayNameQuestion = (question: Question): boolean => {
    const title = question.title.toLowerCase();
    return title.includes("display name") || title === "name";
  };

  const isEmailQuestion = (question: Question): boolean => {
    return question.title.toLowerCase().includes("email");
  };

  const isUserTypeQuestion = (question: Question): boolean => {
    const title = question.title.toLowerCase();
    return title.includes("student") && title.includes("adult");
  };

  const isBasicInfoQuestion = (question: Question): boolean => {
    if (question.type === "address" || question.type === "phoneNumber") {
      return true;
    }
    if (isDisplayNameQuestion(question) || isEmailQuestion(question)) {
      return true;
    }
    return false;
  };

  const getBasicInfoByKey = (formData: FormData, formConfig: Form): Record<string, string> => {
    const values: Record<string, string> = {
      [BASIC_FIELD_KEYS.displayName]: "",
      [BASIC_FIELD_KEYS.email]: "",
      [BASIC_FIELD_KEYS.phoneNumber]: "",
      [BASIC_FIELD_KEYS.userType]: "",
    };

    getQuestionEntries(formConfig).forEach(({ question, fieldName }) => {
      if (question.type === "phoneNumber") {
        values[BASIC_FIELD_KEYS.phoneNumber] = (formData.get(fieldName) as string) || "";
      } else if (isDisplayNameQuestion(question)) {
        values[BASIC_FIELD_KEYS.displayName] = (formData.get(fieldName) as string) || "";
      } else if (isEmailQuestion(question)) {
        values[BASIC_FIELD_KEYS.email] = (formData.get(fieldName) as string) || "";
      } else if (isUserTypeQuestion(question)) {
        values[BASIC_FIELD_KEYS.userType] = (formData.get(fieldName) as string) || "";
      }
    });

    return values;
  };

  // Helper: Parse address fields from form data
  const parseAddress = (formData: FormData, formConfig: Form): RawAddress => {
    const addressEntry = getQuestionEntries(formConfig).find(
      ({ question }) => question.type === "address",
    );
    const prefix = addressEntry?.fieldName;

    if (!prefix) {
      return {};
    }

    const getAddressField = (key: string) => formData.get(`${prefix}.${key}`) as string;
    return {
      line1: getAddressField("line1") || null,
      line2: getAddressField("line2") || null,
      city: getAddressField("city") || null,
      state: getAddressField("state") || null,
      postalCode: getAddressField("postalCode") || null,
      country: getAddressField("country") || null,
    };
  };

  // Helper: Extract basic info for Participant document
  const extractBasicInfo = (formData: FormData, formConfig: Form): Partial<Participant> => {
    const basicByKey = getBasicInfoByKey(formData, formConfig);
    return {
      userUid: user?.uid,
      displayName: user?.displayName || basicByKey[BASIC_FIELD_KEYS.displayName] || undefined,
      email: user?.email || basicByKey[BASIC_FIELD_KEYS.email] || undefined,
      phoneNumber: basicByKey[BASIC_FIELD_KEYS.phoneNumber] || undefined,
      address: parseAddress(formData, formConfig),
    };
  };

  // Helper: Extract form responses for FormResponse document
  const extractFormResponses = (formData: FormData, formConfig: Form): FormResponse => {
    const questions: Questions[] = [];

    getQuestionEntries(formConfig).forEach(({ question, fieldName }) => {
        const questionType = question.type;

        // Skip basic info and non-response fields.
        if (isBasicInfoQuestion(question) || questionType === "text" || questionType === "profilePicture") {
          return;
        }

        let answer: string | number;

        if (questionType === "multiple") {
          const values = formData.getAll(fieldName) as string[];
          answer = values.join(", ");
        } else if (questionType === "address") {
          // Address is handled separately, skip here
          return;
        } else if (questionType === "Slider") {
          answer = parseInt(formData.get(fieldName) as string) || 0;
        } else {
          answer = formData.get(fieldName) as string;
        }

        questions.push({ title: question.title, answer, type: questionType });
    });

    return {
      uid: user?.uid || "",
      questions,
    };
  };

  // Helper: Extract matchable questions for Pinecone
  const extractMatchableResponses = (formData: FormData, formConfig: Form): { textResponses: string[]; numericResponses: number[] } => {
    const textResponses: string[] = [];
    const numericResponses: number[] = [];

    getQuestionEntries(formConfig).forEach(({ question, fieldName }) => {
        // Only process matchable questions
        if (!question.matchable) {
          return;
        }

        // Skip pronouns as mentioned in requirements
        if (question.title?.toLowerCase().includes("pronoun")) {
          return;
        }

        const questionType = question.type;

        if (questionType === "Slider") {
          const value = parseInt(formData.get(fieldName) as string) || 0;
          numericResponses.push(value);
        } else if (
          [
            "short_input",
            "medium_input",
            "long_input",
            "Dropdown",
            "Radio",
            "multiple",
            "Date",
          ].includes(questionType)
        ) {
          const value = (formData.get(fieldName) as string) || "";
          // Preserve stable text1..textN key mapping even when response is empty.
          textResponses.push(value);
        }
    });

    return { textResponses, numericResponses };
  };

  // Form submission handler
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      console.error("User not authenticated. Please log in first.");
      return;
    }

    if (!form) {
      console.error("Form configuration not loaded.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData(event.currentTarget);

      // Validate phone number before proceeding
      const phoneEntry = getQuestionEntries(form).find(
        ({ question }) => question.type === "phoneNumber",
      );
      if (phoneEntry) {
        const phone = (formData.get(phoneEntry.fieldName) as string) || "";
        const confirmPhone = (formData.get(`${phoneEntry.fieldName}_confirm`) as string) || "";
        if (phone && !phoneNumberRegex.test(phone)) {
          setSubmitError("Please enter a valid phone number.");
          return;
        }
        if (phone !== confirmPhone) {
          setSubmitError("Phone numbers must match.");
          return;
        }
      }

      // Extract basic info for Participant
      const basicInfo = extractBasicInfo(formData, form);
      const basicByKey = getBasicInfoByKey(formData, form);

      // Extract form responses for FormResponse collection
      const formResponses = extractFormResponses(formData, form);

      // Extract matchable responses for Pinecone
      const { textResponses, numericResponses } = extractMatchableResponses(formData, form);

      // Check if documents exist to determine if we need to set createdAt
      const participantDocRef = doc(db, "participants", user.uid);
      const formResponseDocRef = doc(db, "FormResponse", user.uid);
      
      const [participantSnap, formResponseSnap] = await Promise.all([
        getDoc(participantDocRef),
        getDoc(formResponseDocRef)
      ]);

      // Create Participant document
      const participantData: Participant = {
        type: "Participant",
        ...basicInfo,
        updatedAt: serverTimestamp() as any,
        ...(!participantSnap.exists() && { createdAt: serverTimestamp() as any })
      };

      await setDoc(participantDocRef, participantData, { merge: true });
      console.log("Participant created/updated successfully");

      // Create FormResponse document
      const formResponseData: FormResponse = {
        ...formResponses,
        updatedAt: serverTimestamp() as any,
        ...(!formResponseSnap.exists() && { createdAt: serverTimestamp() as any })
      };
      await setDoc(formResponseDocRef, formResponseData, { merge: true });
      console.log("FormResponse created/updated successfully");

      // Call upsertUser to update Pinecone with matchable questions
      if (textResponses.length > 0 || numericResponses.length > 0) {
        await upsertUser({
          uid: user.uid,
          textResponses,
          numericResponses,
          user_type: basicByKey[BASIC_FIELD_KEYS.userType] || "student",
        });
        console.log("User upserted to Pinecone successfully");
      }

      // Navigate to dashboard
      navigate("/user/dashboard", { replace: true });
    } catch (err) {
      console.error("Form submission error:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading or form loading error
  if (loading || authLoading) return <p>Loading...</p>;
  if (!form) return <p>Form not found.</p>;

  // once loaded, render the dynamic form
  return (
    <form id={styles.page} onSubmit={handleSubmit}>
      <FormRenderer form={form} />
      {submitError && (
        <p className={styles.errorText} role="alert">{submitError}</p>
      )}
      <button id={styles.submit} type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
};

export default RegistrationNew;
