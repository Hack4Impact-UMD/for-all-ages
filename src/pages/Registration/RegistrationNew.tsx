import styles from "./Registration.module.css";
import { stripPhone, isValidPhone } from "../../utils/phone";
import {
  MAX_AGE,
  MIN_AGE,
  computeAge,
  isDateOfBirthQuestion,
  isPlausibleAge,
  userTypeForAge,
  yearsAgo,
} from "../../utils/age";
import type { BannerState, Form, Question, Section, FormResponse, Participant, Questions, RawAddress } from "../../types";
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
import { isAdminRole } from "../../utils/roles";
import { useLocation, useNavigate } from "react-router-dom";
import {
  buildPrefill,
  isBasicInfoQuestion,
  isDisplayNameQuestion,
  isEmailQuestion,
  questionSnapshot,
  type Prefill,
  type PrefillMap,
} from "./prefill";


// ---------------------------------------------------------------------------
// Question renderer: selects appropriate input based on a question's type
// and wraps it with the question's label/description markup
// ---------------------------------------------------------------------------

function QuestionRenderer({
  question,
  name,
  previewMode = false,
  enforceAgeLimits = true,
  prefill,
}: {
  question: Question;
  name: string;
  previewMode?: boolean;
  enforceAgeLimits?: boolean;
  /** A returning participant's saved answer, used as the initial value. */
  prefill?: Prefill;
}) {
  const { type, title, description, options, min, max, required } = question;
  const text = prefill?.kind === "text" ? prefill.value : undefined;
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
          <ShortInput name={name} required={required} className={styles.fieldInput} defaultValue={text} />
        </div>
      );
    case "medium_input":
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <MediumInput name={name} required={required} className={styles.fieldInput} defaultValue={text} />
        </div>
      );
    case "long_input":
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <LongInput name={name} required={required} className={styles.fieldTextarea} defaultValue={text} />
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
            defaultValue={text}
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
            defaultValue={prefill?.kind === "other" ? prefill.option : text}
            defaultOther={prefill?.kind === "other" ? prefill.text : undefined}
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
            defaultValue={prefill?.kind === "number" ? prefill.value : undefined}
          />
        </div>
      );
    case "Radio":
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          <RadioInput name={name} options={options ?? []} required={required} defaultValue={text} />
        </div>
      );
    case "Date":
      return withDisabledState(
        <div className={styles.fieldGroup}>
          {labelContent}
          {enforceAgeLimits && isDateOfBirthQuestion(question) ? (
            <DateInput name={name} required={required} min={yearsAgo(MAX_AGE)} max={yearsAgo(MIN_AGE)} defaultValue={text} />
          ) : (
            <DateInput name={name} required={required} defaultValue={text} />
          )}
        </div>
      );
    case "phoneNumber":
      return withDisabledState(<PhoneNumberInput name={name} required={required} defaultValue={text} />);
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
            defaultValues={prefill?.kind === "multiple" ? prefill.values : undefined}
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
          <AddressInput
            namePrefix={name}
            required={required}
            defaultValue={prefill?.kind === "address" ? prefill.value : undefined}
          />
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
          <ShortInput name={name} required={required} className={styles.fieldInput} defaultValue={text} />
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
  enforceAgeLimits = true,
  prefill,
}: {
  form: Form;
  currentStep: number;
  navFooter: React.ReactNode;
  previewMode?: boolean;
  hideSectionTitles?: boolean;
  enforceAgeLimits?: boolean;
  prefill?: PrefillMap;
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
          {section.questions.map((question, questionIndex) => {
            const name = `s${sectionIndex}_q${questionIndex}`;
            return (
              <QuestionRenderer
                key={questionIndex}
                question={question}
                name={name}
                previewMode={previewMode}
                enforceAgeLimits={enforceAgeLimits}
                prefill={prefill?.[name]}
              />
            );
          })}
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
  address: "address"
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
  onPreviewStepChange?: (step: number) => void;
};

const RegistrationNew = ({
  previewMode = false,
  previewForm,
  previewInitialStep,
  compactPreview = false,
  onPreviewStepChange,
}: RegistrationNewProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading, programState, programStateLoading } = useAuth();
  const location = useLocation();
  /** True only on `/admin/add-participant` (admin-created participant, no Auth account). */
  const isManualEntry = location.pathname === "/admin/add-participant";
  const manualFullName = (
    (location.state as { name?: string } | null)?.name ?? ""
  ).trim();
  const userUid = user?.uid ?? null;
  const manualUserIdRef = useRef<string>(doc(collection(db, "participants")).id);

  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<Form | null>(previewForm ?? null);
  const [loading, setLoading] = useState(!previewMode);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(previewInitialStep ?? 0);
  const [showAgeWarningModal, setShowAgeWarningModal] = useState(false);
  const [prefill, setPrefill] = useState<PrefillMap>({});
  const pendingContinue = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (previewMode) {
      setForm(previewForm ?? null);
      setLoading(false);
      return;
    }

    // Inputs only read their default value on first render, so wait for the
    // user before loading anything.
    if (authLoading) return;
    let cancelled = false;

    // A returning participant's saved profile and answers, used to prefill
    // the form. The FormResponse is read even when the participant doc is
    // missing: one left over from an earlier cohort still has their answers.
    const loadSaved = async (): Promise<{
      participant: Participant | null;
      questions: Questions[];
    }> => {
      if (isManualEntry || !userUid) return { participant: null, questions: [] };
      try {
        const [participantSnap, formResponseSnap] = await Promise.all([
          getDoc(doc(db, "participants", userUid)),
          getDoc(doc(db, "FormResponse", userUid)),
        ]);
        const saved = formResponseSnap.data() as Partial<FormResponse> | undefined;
        return {
          participant: participantSnap.exists()
            ? (participantSnap.data() as Participant)
            : null,
          questions: Array.isArray(saved?.questions) ? saved.questions : [],
        };
      } catch (err) {
        // Prefill is a convenience: fall back to an empty form.
        console.error("Error loading saved answers:", err);
        return { participant: null, questions: [] };
      }
    };

    const fetchForm = async () => {
      try {
        const [docSnap, saved] = await Promise.all([
          getDoc(doc(db, "config", "registrationForm")),
          loadSaved(),
        ]);
        if (cancelled) return;
        let loadedForm: Form | null = null;
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.sections && Array.isArray(data.sections)) {
            loadedForm = data as Form;
          } else if (data.questions && Array.isArray(data.questions)) {
            loadedForm = {
              sections: [{ title: data.title || "Registration", questions: data.questions }],
            };
          }
        } else {
          console.error("No registrationForm document found");
        }
        setForm(loadedForm);
        setPrefill(
          loadedForm
            ? buildPrefill(loadedForm, saved.questions, saved.participant)
            : {},
        );
      } catch (err) {
        console.error("Error fetching form:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchForm();
    return () => {
      cancelled = true;
    };
  }, [previewForm, previewMode, authLoading, userUid, isManualEntry]);

  useEffect(() => {
    if (!previewMode || typeof previewInitialStep !== "number") {
      return;
    }
    setCurrentStep(previewInitialStep);
  }, [previewInitialStep, previewMode]);

  useEffect(() => {
    if (!previewMode || !onPreviewStepChange) {
      return;
    }
    onPreviewStepChange(currentStep);
  }, [currentStep, onPreviewStepChange, previewMode]);

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

  const getDateOfBirth = (formData: FormData, formConfig: Form): string | null => {
    const entry = getQuestionEntries(formConfig).find(({ question }) =>
      isDateOfBirthQuestion(question)
    );
    if (!entry) return null;
    return (formData.get(entry.fieldName) as string) || null;
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
      [BASIC_FIELD_KEYS.phoneNumber]: ""
    };

    getQuestionEntries(formConfig).forEach(({ question, fieldName }) => {
      if (question.type === "phoneNumber") {
        values[BASIC_FIELD_KEYS.phoneNumber] = (formData.get(fieldName) as string) || "";
      } else if (isDisplayNameQuestion(question)) {
        values[BASIC_FIELD_KEYS.displayName] = (formData.get(fieldName) as string) || "";
      } else if (isEmailQuestion(question)) {
        values[BASIC_FIELD_KEYS.email] = (formData.get(fieldName) as string) || "";
      }
    });

    return values;
  };

  // The school answer is copied onto the participant doc so sub-admins' campus
  // rosters can query it without reading FormResponse.
  const getSchool = (formData: FormData, formConfig: Form): string | null => {
    const entry = getQuestionEntries(formConfig).find(
      ({ question }) => question.lockedKey === "school",
    );
    if (!entry) return null;

    const selectedValue = (formData.get(entry.fieldName) as string) || "";
    const value =
      entry.question.type === "DropdownWithOther" &&
      selectedValue.trim().toLowerCase() === "other"
        ? ((formData.get(`${entry.fieldName}_other`) as string) || "")
        : selectedValue;
    return value.trim() || null;
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

        // Save what the question looked like, so a returning participant's
        // answer is only prefilled if the question hasn't changed since.
        questions.push({
          title: question.title,
          answer,
          type: questionType,
          ...questionSnapshot(question),
        });
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
        } else if (questionType === "multiple") {
          // Embed every selected option, joined the same way FormResponse
          // stores it (formData.get would only return the first).
          const value = (formData.getAll(fieldName) as string[]).join(", ");
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
        if (phone && !isValidPhone(phone)) {
          setSubmitError("Please enter a valid 10-digit phone number.");
          setSubmitting(false);
          return;
        }
        if (stripPhone(phone) !== stripPhone(confirmPhone)) {
          setSubmitError("Phone numbers must match.");
          setSubmitting(false);
          return;
        }
      }

      const dob = getDateOfBirth(formData, form);
      const age = dob ? computeAge(dob) : null;
      // A DOB that doesn't parse, or is in the future, is always rejected.
      // Admins entering someone manually may go outside the usual age range.
      if (dob && (age === null || age < 0 || (!isManualEntry && !isPlausibleAge(age)))) {
        setSubmitError("Please check your date of birth.");
        setSubmitting(false);
        return;
      }
      const computedUserType = age === null ? null : userTypeForAge(age);

      const performRegistration = async () => {
        // Extract basic info for Participant
        const basicInfo = extractBasicInfo(formData, form, participantId);

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

        // A participant who already finished registering is re-submitting.
        const alreadyRegistered = participantSnap.data()?.type === "Participant";

        // Sub-admins can register as participants too; keep their admin role.
        const keepsAdminRole = isAdminRole(participantSnap.data()?.role);
        const { role, ...basicInfoWithoutRole } = basicInfo;

        // Save the profile and answers, but don't mark registration complete
        // (type: "Participant") until the capacity check and Pinecone upsert
        // have succeeded. Until then RegistrationGate keeps showing the form,
        // so a failed submit can simply be retried.
        const participantData = {
          ...omitUndefined(
            keepsAdminRole ? basicInfoWithoutRole : { ...basicInfoWithoutRole, role },
          ),
          user_type: computedUserType,
          school: getSchool(formData, form),
          ...(dob && { dateOfBirth: dob }),
          updatedAt: serverTimestamp(),
          ...(!participantSnap.exists() && { createdAt: serverTimestamp() }),
        };

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

        if (!alreadyRegistered) {
          shouldWaitlist = await runTransaction(db, async (transaction) => {
            const [programSnap, ownSnap] = await Promise.all([
              transaction.get(programStateRef),
              transaction.get(participantDocRef),
            ]);

            // A previous attempt already made (and counted) the decision but
            // failed afterwards; reuse it so retries don't count twice.
            const previousDecision = ownSnap.data()?.capacityDecision;
            if (previousDecision === "counted" || previousDecision === "waitlisted") {
              return previousDecision === "waitlisted";
            }

            const programData = programSnap.data();
            const matchesFinal = programData?.matches_final === true;
            const programStarted = programData?.started === true;
            const current = programData?.currentParticipants ?? 0;
            const max = programData?.maxParticipants ?? Infinity;

            // Once matches are finalized, keep all new registrations on waitlist
            // until the program has started, regardless of participant capacity.
            const waitlist = (matchesFinal && !programStarted) || current >= max;

            if (!waitlist) {
              transaction.set(programStateRef, { currentParticipants: increment(1) }, { merge: true });
            }
            transaction.set(
              participantDocRef,
              { capacityDecision: waitlist ? "waitlisted" : "counted" },
              { merge: true },
            );
            return waitlist;
          });
        }

        if (shouldWaitlist) {
          const waitlistRef = doc(db, "waitlist", participantId);
          await setDoc(waitlistRef, { uid: participantId, createdAt: serverTimestamp() });
        }

        // Upsert Pinecone for both self-serve and manual registrations using
        // the same payload shape the matching pipeline already expects.
        // Waitlisted users are upserted too: matchAll skips anyone on the
        // waitlist, and having a vector lets admins score and pair them in
        // Rematching when a spot opens.
        // Skip for ages 36-54, wait for admin to enter matching
        if (computedUserType !== null) {
          await upsertUser({
            uid: participantId,
            textResponses,
            numericResponses,
            user_type: computedUserType,
            pronouns: getPronouns(formData, form)
          });
        }

        // Everything succeeded: mark registration complete.
        await setDoc(participantDocRef, { type: "Participant" }, { merge: true });

        if (isManualEntry) {
          // The admin never belongs on /waiting or the user dashboard: send
          // them back to Users, which shows the outcome as a banner.
          const banner: BannerState = {
            type: "success",
            message: shouldWaitlist
              ? `${manualFullName} was registered and added to the waitlist (the program is full).`
              : `${manualFullName} was registered.`,
          };
          navigate("/admin/creator", { replace: true, state: { banner } });
        } else if (shouldWaitlist) {
          navigate("/waiting", { replace: true });
        } else {
          navigate("/user/dashboard", { replace: true });
        }
      };

      // Show 36-54 age warming
      if (!isManualEntry && age !== null && age >= 36 && age <= 54) {
        pendingContinue.current = performRegistration;
        setShowAgeWarningModal(true);
        setSubmitting(false);
        return;
      }

      await performRegistration();
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

      {!previewMode && Object.keys(prefill).length > 0 && (
        <div className={styles.prefillBanner} role="status">
          Welcome back! We&rsquo;ve filled in your answers from last time.
          Please review them before submitting.
        </div>
      )}

      {/* Form sections -- one visible at a time */}
      <FormRenderer
        form={form}
        currentStep={currentStep}
        previewMode={previewMode}
        hideSectionTitles={previewMode && compactPreview}
        enforceAgeLimits={!isManualEntry}
        prefill={prefill}
        navFooter={
          <>
            {!previewMode && submitError && (
              <div className={styles.errorBanner} role="alert">{submitError}</div>
            )}
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
            <div className={styles.stepIndicator}>
              Step {currentStep + 1} of {totalSteps}
            </div>
          </>
        }
      />

      {showAgeWarningModal && (
        <div className={styles.ageModalOverlay}>
          <div className={styles.ageModalCard}>
            <h3 className={styles.ageModalTitle}>Outside Typical Age Range</h3>
            <p className={styles.ageModalText}>
              Your age is in the range 36-54, which falls outside the typical age ranges for Tea @ 3
              participants — younger adults are under 36, and older adults are 55
              and up.
            </p>
            <p className={styles.ageModalText}>
              You are still welcome to sign up! To ensure accurate matching,
              please reach out to our admin team at{" "}
              <a href="mailto:info@forallages.org" className={styles.ageModalLink}>
                info@forallages.org
              </a>{" "}
              after registering so they can place you appropriately.
            </p>
            <div className={styles.ageModalActions}>
              <button
                type="button"
                className={styles.btnBack}
                onClick={() => {
                  setShowAgeWarningModal(false);
                  pendingContinue.current = null;
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                className={styles.btnContinue}
                disabled={submitting}
                onClick={async () => {
                  setShowAgeWarningModal(false);
                  setSubmitting(true);
                  try {
                    await pendingContinue.current?.();
                  } catch {
                    setSubmitError("Something went wrong. Please try again.");
                  } finally {
                    setSubmitting(false);
                    pendingContinue.current = null;
                  }
                }}
              >
                {submitting ? "Submitting…" : "Continue Signing Up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default RegistrationNew;
