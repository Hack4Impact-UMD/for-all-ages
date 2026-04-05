import styles from "./Registration.module.css";
import { phoneNumberRegex } from "../../regex";
import type { Form, Question, Section, FormResponse, Participant, Questions, RawAddress } from "../../types";
import { useState, useEffect } from "react";
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
import { doc, getDoc, setDoc, serverTimestamp, runTransaction, increment } from "firebase/firestore";
import { db, upsertUser } from "../../firebase";
import { useAuth } from "../../auth/AuthProvider";
import { useNavigate } from "react-router-dom";


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

  //Helper: Get pronouns
  const getPronouns = (formData: FormData, formConfig: Form): string => {
    const entry = getQuestionEntries(formConfig).find(
      ({ question }) => question.title?.toLowerCase().includes("pronoun")
    );

    if (!entry) return "Other";

    return (formData.get(entry.fieldName) as string) || "Other"; //defualt to other
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
      user_type: basicByKey[BASIC_FIELD_KEYS.userType] || "student"
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

      // Check waitlist: atomically read currentParticipants and decide
      const programStateRef = doc(db, "config", "programState");
      let shouldWaitlist = false;

      await runTransaction(db, async (transaction) => {
        const programSnap = await transaction.get(programStateRef);
        const programData = programSnap.data();
        const current = programData?.currentParticipants ?? 0;
        const max = programData?.maxParticipants ?? Infinity;

        if (current >= max) {
          shouldWaitlist = true;
        } else {
          // Increment currentParticipants atomically
          transaction.update(programStateRef, {
            currentParticipants: increment(1),
          });
        }
      });

      if (shouldWaitlist) {
        // Add to waitlist collection — do NOT upsert to Pinecone
        const waitlistRef = doc(db, "waitlist", user.uid);
        await setDoc(waitlistRef, {
          uid: user.uid,
          createdAt: serverTimestamp(),
        });
        console.log("Participant added to waitlist");
        navigate("/waiting", { replace: true });
      } else {
        // Call upsertUser to update Pinecone with matchable questions
        if (textResponses.length > 0 || numericResponses.length > 0) {
          await upsertUser({
            uid: user.uid,
            textResponses,
            numericResponses,
            user_type: basicByKey[BASIC_FIELD_KEYS.userType] || "student",
            pronouns: getPronouns(formData, form)
          });
          console.log("User upserted to Pinecone successfully");
        }

        // Navigate to dashboard
        navigate("/user/dashboard", { replace: true });
      }
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
