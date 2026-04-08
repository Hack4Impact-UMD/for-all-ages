import styles from "./Registration.module.css";
import { phoneNumberRegex } from "../../regex";
import type { Form, Question, Section, FormResponse, Participant, Questions, RawAddress } from "../../types";
import { useState, useEffect, useRef } from "react";
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
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
  const { type, title, description, options, min, max, required } = question;
  const requiredMark = required ? <span className={styles.requiredStar}> *</span> : null;

  const labelContent = (
    <>
      <span className={styles.fieldLabel}>
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
        <div className={styles.fieldGroup}>
          {labelContent}
          <ShortInput name={name} required={required} className={styles.fieldInput} />
        </div>
      );
    case "medium_input":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <MediumInput name={name} required={required} className={styles.fieldInput} />
        </div>
      );
    case "long_input":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <LongInput name={name} required={required} className={styles.fieldTextarea} />
        </div>
      );
    case "Dropdown":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <DropdownInput
            name={name}
            options={options ?? []}
            required={required}
            className={styles.fieldSelect}
          />
        </div>
      );
    case "Slider":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <SliderInput
            name={name}
            min={min ?? 1}
            max={max ?? 5}
            required={required}
          />
        </div>
      );
    case "Radio":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <RadioInput name={name} options={options ?? []} required={required} />
        </div>
      );
    case "Date":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <DateInput name={name} required={required} />
        </div>
      );
    case "phoneNumber":
      return <PhoneNumberInput name={name} required={required} />;
    case "text":
      return (
        <TextDisplay title={title + requiredMark} description={description} />
      );
    case "multiple":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <MultipleInput
            name={name}
            options={options ?? []}
            required={required}
          />
        </div>
      );
    case "address":
      return (
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {title}{requiredMark}
            {description && (
              <span className={styles.helpText} style={{ marginLeft: "0.5rem" }}>
                ({description})
              </span>
            )}
          </span>
          <AddressInput namePrefix={name} required={required} />
        </div>
      );
    case "profilePicture":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <p>profile picture coming soon</p>
        </div>
      );
    default:
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <ShortInput name={name} required={required} className={styles.fieldInput} />
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Form renderer: iterates over sections and delegates each question to
// QuestionRenderer with a unique name identifier.
// Accepts currentStep + navFooter to render one section at a time.
// ---------------------------------------------------------------------------

function FormRenderer({
  form,
  currentStep,
  navFooter,
}: {
  form: Form;
  currentStep: number;
  navFooter: React.ReactNode;
}) {
  return (
    <>
      {form.sections.map((section: Section, sectionIndex) => (
        <div
          key={sectionIndex}
          data-step={sectionIndex}
          className={styles.card}
          style={{ display: sectionIndex === currentStep ? "block" : "none" }}
        >
          {section.title && (
            <h2 className={styles.cardTitle}>{section.title}</h2>
          )}
          {section.questions.map((question, questionIndex) => (
            <QuestionRenderer
              key={questionIndex}
              question={question}
              name={`s${sectionIndex}_q${questionIndex}`}
            />
          ))}
          {sectionIndex === currentStep && navFooter}
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

  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const docRef = doc(db, "config", "registrationForm");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.sections && Array.isArray(data.sections)) {
            setForm(data as Form);
          } else if (data.questions && Array.isArray(data.questions)) {
            setForm({
              sections: [{ title: data.title || "Registration", questions: data.questions }],
            });
          }
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

  const getPronouns = (formData: FormData, formConfig: Form): string => {
    const entry = getQuestionEntries(formConfig).find(
      ({ question }) => question.title?.toLowerCase().includes("pronoun")
    );

    if (!entry) return "Other";

    return (formData.get(entry.fieldName) as string) || "Other";
  };

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

  const extractFormResponses = (formData: FormData, formConfig: Form): FormResponse => {
    const questions: Questions[] = [];

    getQuestionEntries(formConfig).forEach(({ question, fieldName }) => {
        const questionType = question.type;

        if (isBasicInfoQuestion(question) || questionType === "text" || questionType === "profilePicture") {
          return;
        }

        let answer: string | number;

        if (questionType === "multiple") {
          const values = formData.getAll(fieldName) as string[];
          answer = values.join(", ");
        } else if (questionType === "address") {
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

  const extractMatchableResponses = (formData: FormData, formConfig: Form): { textResponses: string[]; numericResponses: number[] } => {
    const textResponses: string[] = [];
    const numericResponses: number[] = [];

    getQuestionEntries(formConfig).forEach(({ question, fieldName }) => {
        if (!question.matchable) {
          return;
        }

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
          textResponses.push(value);
        }
    });

    return { textResponses, numericResponses };
  };

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

      const basicInfo = extractBasicInfo(formData, form);
      const basicByKey = getBasicInfoByKey(formData, form);
      const formResponses = extractFormResponses(formData, form);
      const { textResponses, numericResponses } = extractMatchableResponses(formData, form);

      const participantDocRef = doc(db, "participants", user.uid);
      const formResponseDocRef = doc(db, "FormResponse", user.uid);
      
      const [participantSnap, formResponseSnap] = await Promise.all([
        getDoc(participantDocRef),
        getDoc(formResponseDocRef)
      ]);

      const participantData: Participant = {
        type: "Participant",
        ...basicInfo,
        updatedAt: serverTimestamp() as any,
        ...(!participantSnap.exists() && { createdAt: serverTimestamp() as any })
      };

      await setDoc(participantDocRef, participantData, { merge: true });

      const formResponseData: FormResponse = {
        ...formResponses,
        updatedAt: serverTimestamp() as any,
        ...(!formResponseSnap.exists() && { createdAt: serverTimestamp() as any })
      };
      await setDoc(formResponseDocRef, formResponseData, { merge: true });

      if (textResponses.length > 0 || numericResponses.length > 0) {
        await upsertUser({
          uid: user.uid,
          textResponses,
          numericResponses,
          user_type: basicByKey[BASIC_FIELD_KEYS.userType] || "student",
          pronouns: getPronouns(formData, form)
        });
      }

      navigate("/user/dashboard", { replace: true });
    } catch (err) {
      console.error("Form submission error:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) return <p className={styles.message}>Loading...</p>;
  if (!form) return <p className={styles.message}>Form not found.</p>;

  // Multi-step navigation
  const totalSteps = form.sections.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const goNext = () => {
    const formEl = formRef.current;
    if (formEl) {
      const currentFields = formEl.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        `[data-step="${currentStep}"] [name]`
      );
      for (const field of currentFields) {
        if (!field.checkValidity()) {
          field.reportValidity();
          return;
        }
      }
    }
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stepCircleClass = (i: number) => {
    if (i < currentStep) return `${styles.stepCircle} ${styles.stepCircleCompleted}`;
    if (i === currentStep) return `${styles.stepCircle} ${styles.stepCircleActive}`;
    return styles.stepCircle;
  };

  const stepLabelClass = (i: number) => {
    if (i < currentStep) return `${styles.stepLabel} ${styles.stepLabelCompleted}`;
    if (i === currentStep) return `${styles.stepLabel} ${styles.stepLabelActive}`;
    return styles.stepLabel;
  };

  return (
    <form ref={formRef} id={styles.page} onSubmit={handleSubmit}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>Registration Form</div>
        <h1 className={styles.headerSubtitle}>Tea @ 3</h1>
        <p className={styles.headerDescription}>
          Let&rsquo;s find your perfect tea-mate. This takes about 8&ndash;10 minutes.
        </p>
      </div>

      {/* Progress bar */}
      <div className={styles.progressContainer}>
        <div className={styles.stepsRow}>
          {form.sections.map((section, i) => (
            <div key={i} className={styles.stepItem}>
              <div className={stepCircleClass(i)}>
                {i < currentStep ? "✓" : i + 1}
              </div>
              <span className={stepLabelClass(i)}>
                {section.title || `Step ${i + 1}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Form sections -- one visible at a time */}
      <FormRenderer
        form={form}
        currentStep={currentStep}
        navFooter={
          <>
            {submitError && (
              <div className={styles.errorBanner} role="alert">{submitError}</div>
            )}
            <div className={styles.stepIndicator}>
              Step {currentStep + 1} of {totalSteps}
            </div>
            <div className={styles.navButtons}>
              {!isFirstStep && (
                <button type="button" className={styles.btnBack} onClick={goBack}>
                  Go Back
                </button>
              )}
              {!isLastStep ? (
                <button type="button" className={styles.btnContinue} onClick={goNext}>
                  Continue
                </button>
              ) : (
                <button type="submit" className={styles.btnContinue} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              )}
            </div>
          </>
        }
      />
    </form>
  );
};

export default RegistrationNew;
