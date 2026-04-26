import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import styles from "./Registration.module.css";
import { useAuth } from "../../auth/AuthProvider";
import { db } from "../../firebase";
import { formatPhone, stripPhone, isValidPhone } from "../../utils/phone";
import { upsertUser } from "../../firebase";
import { PREFERENCE_QUESTION_LABELS } from "./preferenceQuestions";
import type { RegistrationFormState } from "../../types";

const TOTAL_STEPS = 5;

const STEP_LABELS = [
  "Personal Profile",
  "About You",
  "Tea & Interests",
  "Health",
  "Registration Agreement",
];

const buildInitialState = (email?: string): RegistrationFormState => ({
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
  confirmPhone: "",
  email: email ?? "",
  confirmEmail: "",
  dateOfBirth: "",
  pronouns: "",
  heardAbout: "",
  university: "",
  user_type: "",
  language: "",
  interests: "",
  teaPreference: "",
  preferredContactMethods: [],
  preferenceScores: { q1: 3, q2: 3, q3: 3 },
  isReturningParticipant: false,
  healthChallenge: "",
  healthChallengeAreas: [],
  healthOther: "",
  agreementName: "",
});

const Registration = () => {
  const navigate = useNavigate();
  const {
    user,
    loading: authLoading,
    emailVerified,
    participant,
    participantLoading,
    programState,
    programStateLoading,
  } = useAuth();

  const [form, setForm] = useState<RegistrationFormState>(() =>
    buildInitialState(user?.email ?? "")
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      setForm((prev) => ({
        ...prev,
        email: prev.email || user.email || "",
      }));
    }
  }, [user?.email]);

  useEffect(() => {
    if (authLoading || participantLoading) return;
    if (!user || !emailVerified) {
      navigate("/", { replace: true });
      return;
    }
    if (
      participant &&
      (participant as { type?: string }).type === "Participant"
    ) {
      navigate("/user/dashboard", { replace: true });
    }
  }, [
    authLoading,
    participantLoading,
    user,
    emailVerified,
    participant,
    navigate,
  ]);

  const signupsClosed = Boolean(programState?.matches_final);

  // When the user types into any input/select/textarea, update that field in form state
  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // When a health area checkbox is toggled, add or remove it from the list
  const handleHealthAreaChange = (area: string, checked: boolean) => {
    setForm((prev) => {
      if (checked) {
        return {
          ...prev,
          healthChallengeAreas: [...prev.healthChallengeAreas, area],
        };
      } else {
        return {
          ...prev,
          healthChallengeAreas: prev.healthChallengeAreas.filter(
            (a) => a !== area
          ),
        };
      }
    });
  };

  const goNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Phone validation
  const isPhoneInvalid =
    form.phone !== "" && !phoneNumberRegex.test(form.phone);
  const isConfirmPhoneInvalid =
    form.confirmPhone !== "" && !phoneNumberRegex.test(form.confirmPhone);
  const isPhoneMismatch =
    form.phone !== "" &&
    form.confirmPhone !== "" &&
    form.phone !== form.confirmPhone;

  // Check that all required fields have a value before allowing submit
  const allRequiredFilled =
    form.firstName !== "" &&
    form.lastName !== "" &&
    form.addressLine1 !== "" &&
    form.city !== "" &&
    form.state !== "" &&
    form.postalCode !== "" &&
    form.phone !== "" &&
    form.confirmPhone !== "" &&
    form.email !== "" &&
    form.confirmEmail !== "" &&
    form.email === form.confirmEmail &&
    form.dateOfBirth !== "" &&
    form.pronouns !== "" &&
    form.heardAbout !== "" &&
    form.language !== "" &&
    form.interests !== "" &&
    form.teaPreference !== "" &&
    form.preferredContactMethods.length > 0 &&
    form.agreementName !== "" &&
    !isPhoneMismatch &&
    !isPhoneInvalid &&
    !isConfirmPhoneInvalid;

  // Submit the form to Firestore
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (isPhoneMismatch) {
      setError("Phone numbers must match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);

    const timestamp = serverTimestamp();
    const payload = {
      type: "Participant" as const,
      userUid: user.uid,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email.trim().toLowerCase(),
      user_type: form.user_type,
      phoneNumber: form.phone,
      address: {
        line1: form.addressLine1,
        line2: form.addressLine2 || null,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country || null,
      },
      dateOfBirth: form.dateOfBirth,
      pronouns: form.pronouns,
      heardAbout: form.heardAbout,
      university: form.university,
      language: form.language,
      interests: form.interests,
      teaPreference: form.teaPreference,
      preferredContactMethods: form.preferredContactMethods,
      preferenceScores: form.preferenceScores,
      isReturningParticipant: form.isReturningParticipant,
      healthChallenge: form.healthChallenge,
      healthChallengeAreas: form.healthChallengeAreas,
      healthOther: form.healthOther,
      agreementName: form.agreementName,
      displayName: user.displayName ?? null,
      updatedAt: timestamp,
    };

    try {
      const docRef = doc(db, "participants", user.uid);
      const docTest = doc(db, "participants", user.uid);
      const dataToWrite = participant
        ? payload
        : { ...payload, createdAt: timestamp };
      await setDoc(docRef, dataToWrite, { merge: true });
      await setDoc(docTest, dataToWrite, { merge: true });

      try {
        await upsertUser({
          uid: user.uid,
          freeResponse: form.interests,
          q1: form.preferenceScores.q1,
          q2: form.preferenceScores.q2,
          q3: form.preferenceScores.q3,
          user_type: form.user_type,
          pronouns: form.pronouns,
        });
      } catch (fnErr) {
        console.error("upsertUser cloud function failed:", fnErr);
      }

      setStatus("Registration complete! Redirecting to your dashboard...");
      navigate("/user/dashboard", { replace: true });
    } catch (err) {
      console.error("Failed to save participant profile", err);
      setError(
        "We couldn't save your registration right now. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading while auth is still loading
  if (authLoading || participantLoading || programStateLoading) {
    return (
      <div id={styles.page}>
        <p className={styles.message}>Loading your registration details...</p>
      </div>
    );
  }

  if (signupsClosed) {
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

  function getStepCircleClass(stepNumber: number) {
    if (stepNumber < currentStep) return styles.stepCircle + " " + styles.stepCircleCompleted;
    if (stepNumber === currentStep) return styles.stepCircle + " " + styles.stepCircleActive;
    return styles.stepCircle;
  }

  function getStepLabelClass(stepNumber: number) {
    if (stepNumber < currentStep) return styles.stepLabel + " " + styles.stepLabelCompleted;
    if (stepNumber === currentStep) return styles.stepLabel + " " + styles.stepLabelActive;
    return styles.stepLabel;
  }

  return (
    <form id={styles.page} onSubmit={handleSubmit}>

      {/* ===== HEADER ===== */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>Registration Form</div>
        <h1 className={styles.headerSubtitle}>Tea @ 3</h1>
        <p className={styles.headerDescription}>
          Let's find your perfect tea-mate. This takes about 8-10 minutes.
        </p>
      </div>

      {/* ===== PROGRESS BAR ===== */}
      <div className={styles.progressContainer}>
        <div className={styles.stepsRow}>
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            return (
              <div key={label} className={styles.stepItem}>
                <div className={getStepCircleClass(stepNumber)}>
                  {isCompleted ? "✓" : stepNumber}
                </div>
                <span className={getStepLabelClass(stepNumber)}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== STEP 1: PERSONAL PROFILE ===== */}
      {currentStep === 1 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Personal Profile</h2>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>First Name</span>
              <input
                className={styles.fieldInput}
                type="text"
                name="firstName"
                placeholder="Jane"
                value={form.firstName}
                onChange={handleInputChange}
              />
            </div>
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Last Name</span>
              <input
                className={styles.fieldInput}
                type="text"
                name="lastName"
                placeholder="Doe"
                value={form.lastName}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Date of Birth</span>
            <input
              className={styles.fieldInput}
              type="date"
              name="dateOfBirth"
              value={form.dateOfBirth}
              onChange={handleInputChange}
              style={{ maxWidth: 250 }}
            />
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Preferred Pronouns</span>
            <input
              className={styles.fieldInput}
              type="text"
              name="pronouns"
              placeholder="she/they"
              value={form.pronouns}
              onChange={handleInputChange}
              style={{ maxWidth: 250 }}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Enter Your Email Address</span>
              <input
                className={styles.fieldInput}
                type="email"
                name="email"
                placeholder="yourname@email.com"
                value={form.email}
                onChange={handleInputChange}
              />
            </div>
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Confirm Your Email Address</span>
              <input
                className={styles.fieldInput}
                type="email"
                name="confirmEmail"
                placeholder="yourname@email.com"
                value={form.confirmEmail}
                onChange={handleInputChange}
              />
              {form.confirmEmail !== "" && form.email !== form.confirmEmail && (
                <span className={styles.errorText}>Email addresses must match.</span>
              )}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Phone Number</span>
              <input
                className={styles.fieldInput}
                type="tel"
                name="phone"
                placeholder="+1"
                value={form.phone}
                onChange={handleInputChange}
              />
              {isPhoneInvalid && (
                <span className={styles.errorText}>
                  Please enter a valid phone number.
                </span>
              )}
            </div>
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Confirm Phone Number</span>
              <input
                className={styles.fieldInput}
                type="tel"
                name="confirmPhone"
                placeholder="+1"
                value={form.confirmPhone}
                onChange={handleInputChange}
              />
              {isPhoneMismatch && (
                <span className={styles.errorText}>Phone numbers must match.</span>
              )}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              Current Mailing Address{" "}
              <span className={styles.helpText}>(We will be delivering you a package)</span>
            </span>
            <input
              className={styles.fieldInput}
              type="text"
              name="addressLine1"
              placeholder="Street Address"
              value={form.addressLine1}
              onChange={handleInputChange}
              style={{ marginBottom: "0.5rem" }}
            />
            <div className={styles.addressSubRow}>
              <input
                className={styles.fieldInput}
                type="text"
                name="city"
                placeholder="City"
                value={form.city}
                onChange={handleInputChange}
              />
              <input
                className={styles.fieldInput}
                type="text"
                name="state"
                placeholder="State"
                value={form.state}
                onChange={handleInputChange}
              />
              <input
                className={styles.fieldInput}
                type="text"
                name="postalCode"
                placeholder="Postal / Zipcode"
                value={form.postalCode}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Preferred Contact Method */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Preferred Method of Contact</span>
            <select
              className={styles.fieldSelect}
              value={form.preferredContactMethods[0] || ""}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  preferredContactMethods: e.target.value ? [e.target.value] : [],
                }));
              }}
            >
              <option value="">Select...</option>
              <option value="Phone">Phone</option>
              <option value="Email">Email</option>
              <option value="Portal notification">Portal notification</option>
            </select>
          </div>

          {/* Returning Participant */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Are you a returning participant?</span>
            <div className={styles.returningRow}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.isReturningParticipant === true}
                  onChange={() =>
                    setForm((prev) => ({ ...prev, isReturningParticipant: true }))
                  }
                />
                Yes
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.isReturningParticipant === false}
                  onChange={() =>
                    setForm((prev) => ({ ...prev, isReturningParticipant: false }))
                  }
                />
                No
              </label>
            </div>
          </div>

          {/* Step indicator + Continue */}
          <div className={styles.stepIndicator}>
            Step {currentStep} of {TOTAL_STEPS}
          </div>
          <div className={styles.navButtons}>
            <button type="button" className={styles.btnContinue} onClick={goNext}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 2: ABOUT YOU ===== */}
      {currentStep === 2 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>About You</h2>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>How did you hear about this program?</span>
            <select
              className={styles.fieldSelect}
              name="heardAbout"
              value={form.heardAbout}
              onChange={handleInputChange}
            >
              <option value="">Select...</option>
              <option value="social_media">Social Media</option>
              <option value="word_of_mouth">Word-of-mouth</option>
              <option value="referral">Referral</option>
              <option value="returning_member">Returning member</option>
              <option value="advertisement">Advertisement</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              If you are a college student, what university are you attending?
            </span>
            <input
              className={styles.fieldInput}
              type="text"
              name="university"
              placeholder="Type in your university..."
              value={form.university}
              onChange={handleInputChange}
              style={{ maxWidth: 350 }}
            />
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              What language do you use for casual conversation?{" "}
              <span className={styles.helpText}>(Primary language spoken at home.)</span>{" "}
              <span className={styles.requiredStar}>*</span>
            </span>
            <select
              className={styles.fieldSelect}
              name="language"
              value={form.language}
              onChange={handleInputChange}
            >
              <option value="">Select...</option>
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="mandarin">Mandarin</option>
              <option value="cantonese">Cantonese</option>
              <option value="korean">Korean</option>
              <option value="japanese">Japanese</option>
              <option value="french">French</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className={styles.stepIndicator}>
            Step {currentStep} of {TOTAL_STEPS}
          </div>
          <div className={styles.navButtons}>
            <button type="button" className={styles.btnBack} onClick={goBack}>
              Go Back
            </button>
            <button type="button" className={styles.btnContinue} onClick={goNext}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: TEA PREFERENCE & INTERESTS ===== */}
      {currentStep === 3 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Tea Preference &amp; Interests</h2>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              What are your interests? This will better help us pair you with your Tea-mate!
            </span>
            <textarea
              className={styles.fieldTextarea}
              name="interests"
              rows={4}
              placeholder="Reading books, playing tennis, etc..."
              value={form.interests}
              onChange={handleInputChange}
            />
          </div>

          <p className={styles.fieldLabel} style={{ marginBottom: "0.75rem" }}>
            A few quick questions — rate 1 (strongly dislike) to 5 (strongly like)
          </p>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{PREFERENCE_QUESTION_LABELS.q1}</span>
            <div className={styles.ratingRow}>
              <span className={styles.ratingEndLabel}>Strongly Dislike</span>
              <button type="button" className={form.preferenceScores.q1 === 1 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q1: 1 } }))}>1</button>
              <button type="button" className={form.preferenceScores.q1 === 2 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q1: 2 } }))}>2</button>
              <button type="button" className={form.preferenceScores.q1 === 3 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q1: 3 } }))}>3</button>
              <button type="button" className={form.preferenceScores.q1 === 4 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q1: 4 } }))}>4</button>
              <button type="button" className={form.preferenceScores.q1 === 5 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q1: 5 } }))}>5</button>
              <span className={styles.ratingEndLabel}>Strongly Like</span>
            </div>
          </div>


          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{PREFERENCE_QUESTION_LABELS.q2}</span>
            <div className={styles.ratingRow}>
              <span className={styles.ratingEndLabel}>Strongly Dislike</span>
              <button type="button" className={form.preferenceScores.q2 === 1 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q2: 1 } }))}>1</button>
              <button type="button" className={form.preferenceScores.q2 === 2 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q2: 2 } }))}>2</button>
              <button type="button" className={form.preferenceScores.q2 === 3 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q2: 3 } }))}>3</button>
              <button type="button" className={form.preferenceScores.q2 === 4 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q2: 4 } }))}>4</button>
              <button type="button" className={form.preferenceScores.q2 === 5 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q2: 5 } }))}>5</button>
              <span className={styles.ratingEndLabel}>Strongly Like</span>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{PREFERENCE_QUESTION_LABELS.q3}</span>
            <div className={styles.ratingRow}>
              <span className={styles.ratingEndLabel}>Strongly Dislike</span>
              <button type="button" className={form.preferenceScores.q3 === 1 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q3: 1 } }))}>1</button>
              <button type="button" className={form.preferenceScores.q3 === 2 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q3: 2 } }))}>2</button>
              <button type="button" className={form.preferenceScores.q3 === 3 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q3: 3 } }))}>3</button>
              <button type="button" className={form.preferenceScores.q3 === 4 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q3: 4 } }))}>4</button>
              <button type="button" className={form.preferenceScores.q3 === 5 ? styles.ratingButton + " " + styles.ratingButtonActive : styles.ratingButton} onClick={() => setForm((prev) => ({ ...prev, preferenceScores: { ...prev.preferenceScores, q3: 5 } }))}>5</button>
              <span className={styles.ratingEndLabel}>Strongly Like</span>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>What type of tea do you prefer?</span>
            <div className={styles.teaButtons}>
              <button
                type="button"
                className={form.teaPreference === "black" ? styles.teaButton + " " + styles.teaButtonActive : styles.teaButton}
                onClick={() => setForm((prev) => ({ ...prev, teaPreference: "black" }))}
              >
                Black
              </button>
              <button
                type="button"
                className={form.teaPreference === "green" ? styles.teaButton + " " + styles.teaButtonActive : styles.teaButton}
                onClick={() => setForm((prev) => ({ ...prev, teaPreference: "green" }))}
              >
                Green
              </button>
              <button
                type="button"
                className={form.teaPreference === "herbal" ? styles.teaButton + " " + styles.teaButtonActive : styles.teaButton}
                onClick={() => setForm((prev) => ({ ...prev, teaPreference: "herbal" }))}
              >
                Herbal
              </button>
              <button
                type="button"
                className={form.teaPreference === "variety" ? styles.teaButton + " " + styles.teaButtonActive : styles.teaButton}
                onClick={() => setForm((prev) => ({ ...prev, teaPreference: "variety" }))}
              >
                Variety
              </button>
            </div>
          </div>

          <div className={styles.stepIndicator}>
            Step {currentStep} of {TOTAL_STEPS}
          </div>
          <div className={styles.navButtons}>
            <button type="button" className={styles.btnBack} onClick={goBack}>
              Go Back
            </button>
            <button type="button" className={styles.btnContinue} onClick={goNext}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 4: HEALTH ===== */}
      {currentStep === 4 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Health</h2>
          <p className={styles.sectionNote}>
            A few final questions. Your answers are confidential and help us support you better.
          </p>

          <div className={styles.infoBox}>
            <span className={styles.infoBoxTitle}>A note on these questions:</span>{" "}
            Many Tea @ 3 members live with ongoing health challenges. These questions
            help us ensure everyone gets the support they need. All responses are optional
            and kept private.
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              Many people join <strong>Tea @ 3</strong> while also living with
              ongoing health challenges. Would you say this applies to you?
            </span>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="healthChallenge"
                  value="Yes"
                  checked={form.healthChallenge === "Yes"}
                  onChange={handleInputChange}
                />
                Yes
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="healthChallenge"
                  value="No"
                  checked={form.healthChallenge === "No"}
                  onChange={handleInputChange}
                />
                No
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="healthChallenge"
                  value="Prefer not to say"
                  checked={form.healthChallenge === "Prefer not to say"}
                  onChange={handleInputChange}
                />
                Prefer not to say
              </label>
            </div>
          </div>

          {/* Only show follow-up checkboxes if they selected "Yes" */}
          {form.healthChallenge === "Yes" && (
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel} style={{ marginTop: "1rem" }}>
                Optional follow-up (only if "Yes" is selected)
              </span>
              <p className={styles.sectionNote}>
                If you'd like to share, does living with ongoing health challenges
                affect your daily life in any of the following ways? (Check all that apply.)
              </p>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.healthChallengeAreas.includes("Fatigue or low energy")}
                  onChange={(e) => handleHealthAreaChange("Fatigue or low energy", e.target.checked)}
                />
                Fatigue or low energy
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.healthChallengeAreas.includes("Chronic pain")}
                  onChange={(e) => handleHealthAreaChange("Chronic pain", e.target.checked)}
                />
                Chronic pain
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.healthChallengeAreas.includes("Limited mobility")}
                  onChange={(e) => handleHealthAreaChange("Limited mobility", e.target.checked)}
                />
                Limited mobility
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.healthChallengeAreas.includes("Vision or hearing changes")}
                  onChange={(e) => handleHealthAreaChange("Vision or hearing changes", e.target.checked)}
                />
                Vision or hearing changes
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.healthChallengeAreas.includes("Memory or cognitive changes")}
                  onChange={(e) => handleHealthAreaChange("Memory or cognitive changes", e.target.checked)}
                />
                Memory or cognitive changes
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.healthChallengeAreas.includes("Emotional stress or anxiety related to health")}
                  onChange={(e) => handleHealthAreaChange("Emotional stress or anxiety related to health", e.target.checked)}
                />
                Emotional stress or anxiety related to health
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.healthChallengeAreas.includes("Something else")}
                  onChange={(e) => handleHealthAreaChange("Something else", e.target.checked)}
                />
                Something else (optional):
                <input
                  className={styles.fieldInput}
                  type="text"
                  name="healthOther"
                  value={form.healthOther}
                  onChange={handleInputChange}
                  style={{ maxWidth: 150, marginLeft: "0.25rem" }}
                />
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.healthChallengeAreas.includes("Prefer not to say")}
                  onChange={(e) => handleHealthAreaChange("Prefer not to say", e.target.checked)}
                />
                Prefer not to say
              </label>
            </div>
          )}

          <div className={styles.stepIndicator}>
            Step {currentStep} of {TOTAL_STEPS}
          </div>
          <div className={styles.navButtons}>
            <button type="button" className={styles.btnBack} onClick={goBack}>
              Go Back
            </button>
            <button type="button" className={styles.btnContinue} onClick={goNext}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 5: REGISTRATION AGREEMENT ===== */}
      {currentStep === 5 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Registration Agreement</h2>
          <p className={styles.sectionNote}>
            Please read the following disclaimer carefully.
          </p>

          <div className={styles.disclaimerBox}>
            <div className={styles.disclaimerTitle}>Community Program Disclaimer</div>
            <p>
              I understand that my application and acceptance to join the Tea @ 3
              community means that I have read, understand, and agree to the
              following. I am at least age 18, am voluntarily providing personal
              information to For All Ages, Inc., and hereby give For All Ages, Inc.,
              its officers, directors, agents, volunteers and employees ("For All
              Ages") permission to share my contact and other information included in
              my application with my Tea-Mate. I assume all risks associated with
              joining this community including, but not limited to injury whether
              arising in contract, negligence or otherwise, all such risks being
              known and appreciated by me. I, for myself and anyone entitled to act
              on my behalf, waive and release For All Ages from any and all claims or
              liabilities of any kind arising out of my participation in this
              community program. I grant permission to For All Ages to use any
              photographs, videos, recordings, or any other record of this community
              for any legitimate purpose.
            </p>
            <p>
              In addition, I understand that For All Ages will contact me before the
              session begins to evaluate my commitment to participation and that it
              has the right to decline my application to join this Community at its
              discretion for any reason it deems appropriate, including but not
              limited to, ensuring the safety of Community members and the integrity
              of the program.
            </p>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              Please type your full name below to confirm you have read and agree to
              the disclaimer above.
            </span>
            <input
              className={styles.fieldInput}
              type="text"
              name="agreementName"
              placeholder="Type in your full legal name"
              value={form.agreementName}
              onChange={handleInputChange}
              style={{ maxWidth: 350 }}
            />
          </div>

          <div className={styles.stepIndicator}>
            Step {currentStep} of {TOTAL_STEPS}
          </div>
          <div className={styles.navButtons}>
            <button type="button" className={styles.btnBack} onClick={goBack}>
              Go Back
            </button>
            <button
              type="submit"
              className={styles.btnContinue}
              disabled={!allRequiredFilled || submitting}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      )}

      {/* Error / success banners (outside the card so they're visible) */}
      {error && <div className={styles.errorBanner}>{error}</div>}
      {status && <div className={styles.statusBanner}>{status}</div>}
    </form>
  );
};

export default Registration;
