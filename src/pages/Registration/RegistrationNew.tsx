import styles from "./Registration.module.css";
import { phoneNumberRegex } from "../../regex";
import type { Form, Question, Section, FormResponse, Participant, Questions, RawAddress } from "../../types";
import { useRef, useState, useEffect } from "react";
import ShortInput from "./Question Types/ShortInput";
import MediumInput from "./MediumInput";
import LongInput from "./Question Types/LongInput";
import DropdownInput from "./Question Types/DropdownInput";
import DropdownWithOtherInput from "./Question Types/DropdownWithOtherInput";
import SliderInput from "./Question Types/SliderInput";
import RadioInput from "./Question Types/RadioInput";
import DateInput from "./Question Types/DateInput";
import PhoneNumberInput from "./PhoneNumberInput";
import TextDisplay from "./Question Types/TextDisplay";
import MultipleInput from "./Question Types/MultipleInput";
import AddressInput from "./Question Types/AddressInput";
import { collection, doc, getDoc, setDoc, serverTimestamp, runTransaction, increment } from "firebase/firestore";
import { db, upsertUser } from "../../firebase";
import { useAuth } from "../../auth/AuthProvider";
import { useLocation, useNavigate } from "react-router-dom";


// ---------------------------------------------------------------------------
// Question renderer: selects appropriate input based on a question's type
// and wraps it with the question's label/description markup
// ---------------------------------------------------------------------------

function QuestionRenderer({
  question,
  name,
  previewMode = false,
}: {
  question: Question;
  name: string;
  previewMode?: boolean;
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

  const withDisabledState = (content: React.ReactNode) => {
    if (!previewMode) {
      return content;
    }

    return (
      <fieldset disabled className={styles.previewFieldset}>
        {content}
      </fieldset>
    );
  };

  switch (type) {
    case "short_input":
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <ShortInput name={name} required={required} className={styles.fieldInput} />
        </div>
      );
    case "medium_input":
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <MediumInput name={name} required={required} className={styles.fieldInput} />
        </div>
      );
    case "long_input":
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <LongInput name={name} required={required} className={styles.fieldTextarea} />
        </div>
      );
    case "Dropdown":
      return withDisabledState(
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
    case "DropdownWithOther":
      return (
        <div className={styles.fieldGroup}>
          {labelContent}
          <DropdownWithOtherInput
            name={name}
            options={options ?? []}
            required={required}
            className={styles.fieldSelect}
          />
        </div>
      );
    case "Slider":
      return withDisabledState(
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
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <RadioInput name={name} options={options ?? []} required={required} />
        </div>
      );
    case "Date":
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <DateInput name={name} required={required} />
        </div>
      );
    case "phoneNumber":
      return withDisabledState(<PhoneNumberInput name={name} required={required} />);
    case "text":
      return (
        <TextDisplay title={title + requiredMark} description={description} />
      );
    case "multiple":
      return withDisabledState(
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
      return withDisabledState(
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
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <p>profile picture coming soon</p>
        </div>
      );
    default:
      return withDisabledState(
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
  previewMode = false,
  hideSectionTitles = false,
}: {
  form: Form;
  currentStep: number;
  navFooter: React.ReactNode;
  previewMode?: boolean;
  hideSectionTitles?: boolean;
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
          {section.title && !hideSectionTitles && (
            <h2 className={styles.cardTitle}>{section.title}</h2>
          )}
          {section.questions.map((question, questionIndex) => (
            <QuestionRenderer
              key={questionIndex}
              question={question}
              name={`s${sectionIndex}_q${questionIndex}`}
              previewMode={previewMode}
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

const omitUndefined = <T extends Record<string, unknown>>(value: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
};

type RegistrationNewProps = {
  previewMode?: boolean;
  previewForm?: Form;
  previewInitialStep?: number;
  compactPreview?: boolean;
};

const RegistrationNew = ({
  previewMode = false,
  previewForm,
  previewInitialStep,
  compactPreview = false,
}: RegistrationNewProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading, programState, programStateLoading } = useAuth();
  const location = useLocation();
  /** True only on `/admin/add-participant` (admin-created participant, no Auth account). */
  const isManualEntry = location.pathname === "/admin/add-participant";
  const manualFullName = (
    (location.state as { name?: string } | null)?.name ?? ""
  ).trim();
  const manualUserIdRef = useRef<string>(doc(collection(db, "participants")).id);

  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<Form | null>(previewForm ?? null);
  const [loading, setLoading] = useState(!previewMode);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(previewInitialStep ?? 0);

  useEffect(() => {
    if (previewMode) {
      setForm(previewForm ?? null);
      setLoading(false);
      return;
    }

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
  }, [previewForm, previewMode]);

  useEffect(() => {
    if (!previewMode || typeof previewInitialStep !== "number") {
      return;
    }
    setCurrentStep(previewInitialStep);
  }, [previewInitialStep, previewMode]);

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
    // Use strict matching based on lockedKey to avoid false positives
    return question.lockedKey === "user type";
  };

  const isBasicInfoQuestion = (question: Question): boolean => {
    if (question.type === "address" || question.type === "phoneNumber") {
      return true;
    }
    if (
      isDisplayNameQuestion(question) ||
      isEmailQuestion(question) ||
      isUserTypeQuestion(question)
    ) {
      return true;
    }
    return false;
  };

  const normalizeUserType = (value?: string): "student" | "adult" => {
    const normalized = value?.trim().toLowerCase() ?? "";
    return normalized === "adult" ? "adult" : "student";
  };

  const getNumericQuestionKeys = (formConfig: Form): Map<string, string> => {
    const keys = new Map<string, string>();
    const usedKeys = new Set<string>();
    let nextNumericIndex = 1;

    const getNextNumericKey = (): string => {
      while (usedKeys.has(`numeric${nextNumericIndex}`)) {
        nextNumericIndex += 1;
      }
      const key = `numeric${nextNumericIndex}`;
      usedKeys.add(key);
      nextNumericIndex += 1;
      return key;
    };

    getQuestionEntries(formConfig).forEach(({ question, fieldName }) => {
      if (question.type !== "Slider" || !question.matchable) {
        return;
      }

      const existingKey = question.numericKey?.trim();
      if (existingKey && !usedKeys.has(existingKey)) {
        usedKeys.add(existingKey);
        keys.set(fieldName, existingKey);
        return;
      }

      keys.set(fieldName, getNextNumericKey());
    });

    return keys;
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
        // Only assign user_type if a non-empty value is found (prevents overwrite by empty matches)
        const userTypeValue = (formData.get(fieldName) as string)?.trim();
        if (userTypeValue) {
          values[BASIC_FIELD_KEYS.userType] = userTypeValue;
        }
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

  // Helper: Extract basic info for Participant document
  const extractBasicInfo = (
    formData: FormData,
    formConfig: Form,
    participantId: string,
  ): Partial<Participant> => {
    const basicByKey = getBasicInfoByKey(formData, formConfig);
    const formEmail = basicByKey[BASIC_FIELD_KEYS.email]?.trim().toLowerCase() || "";
    return {
      userUid: participantId,
      displayName:
        (isManualEntry ? manualFullName || undefined : user?.displayName) ||
        basicByKey[BASIC_FIELD_KEYS.displayName] ||
        undefined,
      email: (isManualEntry ? undefined : (user?.email || formEmail)) || undefined,
      phoneNumber: basicByKey[BASIC_FIELD_KEYS.phoneNumber] || undefined,
      address: parseAddress(formData, formConfig),
      user_type: normalizeUserType(basicByKey[BASIC_FIELD_KEYS.userType]),
      role: "Participant",
      hasAuthAccount: !isManualEntry,
      isManualEntry,
    };
  };

  // Helper: Extract form responses for FormResponse document
  const extractFormResponses = (
    formData: FormData,
    formConfig: Form,
    participantId: string,
  ): FormResponse => {
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
        } else if (questionType === "DropdownWithOther") {
          const selectedValue = (formData.get(fieldName) as string) || "";
          if (selectedValue.trim().toLowerCase() === "other") {
            answer = (formData.get(`${fieldName}_other`) as string) || "";
          } else {
            answer = selectedValue;
          }
        } else if (questionType === "address") {
          return;
        } else if (questionType === "Slider") {
          answer = parseInt(formData.get(fieldName) as string) || 0;
        } else {
          answer = formData.get(fieldName) as string;
        }

        if (typeof answer === "string" && answer.trim() === "") {
          return;
        }

        questions.push({ title: question.title, answer, type: questionType });
    });

    return {
      uid: participantId,
      questions,
    };
  };

  const extractMatchableResponses = (
    formData: FormData,
    formConfig: Form
  ): { textResponses: string[]; numericResponses: Record<string, number> } => {
    const textResponses: string[] = [];
    const numericResponses: Record<string, number> = {};
    const numericQuestionKeys = getNumericQuestionKeys(formConfig);

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
          const numericKey = numericQuestionKeys.get(fieldName);
          if (numericKey) {
            numericResponses[numericKey] = value;
          }
        } else if (questionType === "DropdownWithOther") {
          const selectedValue = (formData.get(fieldName) as string) || "";
          const value =
            selectedValue.trim().toLowerCase() === "other"
              ? ((formData.get(`${fieldName}_other`) as string) || "")
              : selectedValue;
          if (value.trim() !== "") {
            textResponses.push(value);
          }
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
          if (value.trim() !== "") {
            textResponses.push(value);
          }
        }
    });

    return { textResponses, numericResponses };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (previewMode) {
      return;
    }

    if (!isManualEntry && !user) {
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
      const participantId = isManualEntry
        ? manualUserIdRef.current
        : user!.uid;
      const formData = new FormData(event.currentTarget);

      if (isManualEntry && !manualFullName) {
        setSubmitError("Participant name is required.");
        setSubmitting(false);
        return;
      }

      // Validate phone number before proceeding
      const phoneEntry = getQuestionEntries(form).find(
        ({ question }) => question.type === "phoneNumber",
      );
      if (phoneEntry) {
        const phone = (formData.get(phoneEntry.fieldName) as string) || "";
        const confirmPhone = (formData.get(`${phoneEntry.fieldName}_confirm`) as string) || "";
        if (phone && !phoneNumberRegex.test(phone)) {
          setSubmitError("Please enter a valid phone number.");
          setSubmitting(false);
          return;
        }
        if (phone !== confirmPhone) {
          setSubmitError("Phone numbers must match.");
          setSubmitting(false);
          return;
        }
      }

      // Extract basic info for Participant
      const basicInfo = extractBasicInfo(formData, form, participantId);
      const basicByKey = getBasicInfoByKey(formData, form);

      // Extract form responses for FormResponse collection
      const formResponses = extractFormResponses(formData, form, participantId);

      // Extract matchable responses for Pinecone
      const { textResponses, numericResponses } = extractMatchableResponses(formData, form);

      // Check if documents exist to determine if we need to set createdAt
      const participantDocRef = doc(db, "participants", participantId);
      const formResponseDocRef = doc(db, "FormResponse", participantId);
      
      const [participantSnap, formResponseSnap] = await Promise.all([
        getDoc(participantDocRef),
        getDoc(formResponseDocRef)
      ]);

      // Create Participant document
      const participantData = omitUndefined({
        type: "Participant",
        ...basicInfo,
        updatedAt: serverTimestamp() as any,
        ...(!participantSnap.exists() && { createdAt: serverTimestamp() as any })
      }) as Participant;

      await setDoc(participantDocRef, participantData, { merge: true });

      const formResponseData = {
        ...formResponses,
        updatedAt: serverTimestamp(),
        ...(!formResponseSnap.exists() && { createdAt: serverTimestamp() })
      };
      await setDoc(formResponseDocRef, formResponseData, { merge: true });

      // Check waitlist: atomically read currentParticipants and decide.
      // Skip the capacity check if the participant already existed (re-submission / profile update).
      const programStateRef = doc(db, "config", "programState");
      let shouldWaitlist = false;

      if (!participantSnap.exists()) {
        shouldWaitlist = await runTransaction(db, async (transaction) => {
          const programSnap = await transaction.get(programStateRef);
          const programData = programSnap.data();
          const matchesFinal = programData?.matches_final === true;
          const programStarted = programData?.started === true;
          const current = programData?.currentParticipants ?? 0;
          const max = programData?.maxParticipants ?? Infinity;

          // Once matches are finalized, keep all new registrations on waitlist
          // until the program has started, regardless of participant capacity.
          if (matchesFinal && !programStarted) {
            return true;
          }

          if (current >= max) {
            return true;
          }
          transaction.set(programStateRef, { currentParticipants: increment(1) }, { merge: true });
          return false;
        });
      }

      
      if (shouldWaitlist) {
        const waitlistRef = doc(db, "waitlist", user.uid);
        await setDoc(waitlistRef, { uid: user.uid, createdAt: serverTimestamp() });
        navigate("/waiting", { replace: true });
      } else {
        // Upsert Pinecone for both self-serve and manual registrations using
        // the same payload shape the matching pipeline already expects.
        await upsertUser({
          uid: participantId,
          textResponses,
          numericResponses,
          user_type: normalizeUserType(basicByKey[BASIC_FIELD_KEYS.userType]),
          pronouns: getPronouns(formData, form)
        });
        // Navigate to dashboard
        navigate(isManualEntry ? "/admin/creator" : "/user/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("Form submission error:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (!previewMode && authLoading) || programStateLoading) return <p className={styles.message}>Loading...</p>;
  if (!form) return <p className={styles.message}>Form not found.</p>;

  if (programState?.matches_final && !previewMode) {
    return (
      <div id={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Signups have closed for this cohort</h2>
          <p>
            If you’re interested in joining, please contact the admin team at{" "}
            <a href="mailto:info@forallages.org">info@forallages.org</a>.
          </p>
        </div>
      </div>
    );
  }

  // Multi-step navigation
  const totalSteps = form.sections.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const goNext = () => {
    if (previewMode) {
      setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

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

  const showPreviewChrome = !previewMode || !compactPreview;

  return (
    <form
      ref={formRef}
      id={previewMode ? undefined : styles.page}
      className={
        previewMode
          ? compactPreview
            ? styles.previewPageCompact
            : styles.previewPage
          : undefined
      }
      onSubmit={handleSubmit}
    >
      {/* Header */}
      {showPreviewChrome && <div className={styles.header}>
        <div className={styles.headerTitle}>Registration Form</div>
        <h1 className={styles.headerSubtitle}>Tea @ 3</h1>
        <p className={styles.headerDescription}>
          Let&rsquo;s find your perfect tea-mate. This takes about 8&ndash;10 minutes.
        </p>
      </div>}

      {/* Progress bar */}
      {showPreviewChrome && <div className={styles.progressContainer}>
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
      </div>}

      {/* Form sections -- one visible at a time */}
      <FormRenderer
        form={form}
        currentStep={currentStep}
        previewMode={previewMode}
        hideSectionTitles={previewMode && compactPreview}
        navFooter={
          <>
            {!previewMode && submitError && (
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
                <button
                  type={previewMode ? "button" : "submit"}
                  className={styles.btnContinue}
                  disabled={previewMode || submitting}
                >
                  {previewMode ? "Submit" : submitting ? "Submitting..." : "Submit"}
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
