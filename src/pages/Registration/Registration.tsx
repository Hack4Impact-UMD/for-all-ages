import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import styles from "./Registration.module.css";
import logo from "../../assets/For all Ages high res logo 2022 (1).svg";
import { useAuth } from "../../auth/AuthProvider";
import { db } from "../../firebase";
import { phoneNumberRegex } from '../../regex';


// Defines the shape of the registration form state
type RegistrationFormState = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  confirmPhone: string;
  email: string;
  confirmEmail: string;
  dateOfBirth: string;
  pronouns: string;
  heardAbout: string;
  university: string;
  interests: string;
  teaPreference: string;
};

// Builds the initial state for the registration form
const buildInitialState = (email?: string): RegistrationFormState => ({
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
  confirmPhone: "",
  email: email ?? "",
  confirmEmail: email ?? "",
  dateOfBirth: "",
  pronouns: "",
  heardAbout: "",
  university: "",
  interests: "",
  teaPreference: "",
});

const Registration = () => {
  const navigate = useNavigate();
  // Access authentication context
  const {
    user,
    loading: authLoading,
    emailVerified,
    participant,
    participantLoading,
  } = useAuth();


  const [form, setForm] = useState<RegistrationFormState>(() => buildInitialState(user?.email ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      setForm((prev) => ({
        ...prev,
        email: prev.email || user.email || "",
        confirmEmail: prev.confirmEmail || user.email || "",
      }));
    }
  }, [user?.email]);

  // unverified users out, and if the profile already exists, skips registration
  useEffect(() => {
    if (authLoading || participantLoading) return;
    if (!user || !emailVerified) {
      navigate("/", { replace: true });
      return;
    }
    if (participant && (participant as { type?: string }).type === "Participant") {
      navigate("/user/dashboard", { replace: true });
    }
  }, [authLoading, participantLoading, user, emailVerified, participant, navigate]);

  // Handles changes to form inputs
  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const isPhoneInvalid = form.phone !== "" && !phoneNumberRegex.test(form.phone);
  const isConfirmPhoneInvalid = form.confirmPhone !== "" && !phoneNumberRegex.test(form.confirmPhone);
  
  const isPhoneMismatch =
    form.phone !== "" && form.confirmPhone !== "" && form.phone !== form.confirmPhone;

  const isEmailMismatch =
    form.email !== "" &&
    form.confirmEmail !== "" &&
    form.email.trim().toLowerCase() !== form.confirmEmail.trim().toLowerCase();

  const allRequiredFilled =
    Boolean(form.addressLine1) &&
    Boolean(form.city) &&
    Boolean(form.state) &&
    Boolean(form.postalCode) &&
    Boolean(form.country) &&
    Boolean(form.phone) &&
    Boolean(form.confirmPhone) &&
    Boolean(form.email) &&
    Boolean(form.confirmEmail) &&
    Boolean(form.dateOfBirth) &&
    Boolean(form.pronouns) &&
    Boolean(form.heardAbout) &&
    Boolean(form.university) &&
    Boolean(form.interests) &&
    Boolean(form.teaPreference) &&
    !isPhoneMismatch &&
    !isEmailMismatch &&
    !isPhoneInvalid &&
    !isConfirmPhoneInvalid;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (isPhoneMismatch) {
      setError("Phone numbers must match.");
      return;
    }
    if (isEmailMismatch) {
      setError("Emails must match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);

    // stores the time stamp 
    const timestamp = serverTimestamp();
    // builds the payload to store in firestore
    const payload = {
      type: "Participant" as const,
      userUid: user.uid,
      email: form.email.trim().toLowerCase(),
      phoneNumber: form.phone,
      address: {
        line1: form.addressLine1,
        line2: form.addressLine2 || null,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country,
      },
      dateOfBirth: form.dateOfBirth,
      pronouns: form.pronouns,
      heardAbout: form.heardAbout,
      university: form.university,
      interests: form.interests,
      teaPreference: form.teaPreference,
      displayName: user.displayName ?? null,
      updatedAt: timestamp,
    };

    // attempts to write the participant profile to firestore
    // if participant already exists, merges with existing data
    // otherwise, creates a new document with createdAt timestamp
    // always sets updatedAt to current timestamp
    try {
      const docRef = doc(db, "participants", user.uid);
      const dataToWrite = participant ? payload : { ...payload, createdAt: timestamp };
      await setDoc(docRef, dataToWrite, { merge: true });
      setStatus("Registration complete! Redirecting to your dashboard...");
      navigate("/user/dashboard", { replace: true });
    } catch (err) {
      console.error("Failed to save participant profile", err);
      setError("We couldn't save your registration right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || participantLoading) {
    return (
      <div id={styles.page}>
        <p className={styles.message}>Loading your registration details...</p>
      </div>
    );
  }

  return (
    <>
      <div id={styles.navbar}>
        <img id={styles.logo} src={logo} alt="For All Ages Logo" />
        <p id={styles.title}>Registration Form</p>
      </div>

      <form id={styles.page} onSubmit={handleSubmit}>
        <div id={styles.addr_container}>
          <div id={styles.addr_street}>
            <label className={styles.sublabel}>
              <span className={styles.label}>Address</span>
              <input
                type="text"
                name="addressLine1"
                value={form.addressLine1}
                onChange={handleInputChange}
                required
              />
              Street Address
            </label>

            <label className={styles.sublabel}>
              <input
                type="text"
                name="addressLine2"
                value={form.addressLine2}
                onChange={handleInputChange}
              />
              Street Address 2
            </label>
          </div>

          <div id={styles.addr_details}>
            <div>
              <label className={styles.sublabel}>
                <input type="text" name="city" value={form.city} onChange={handleInputChange} required />
                City
              </label>
            </div>

            <div>
              <label className={styles.sublabel}>
                <input type="text" name="state" value={form.state} onChange={handleInputChange} required />
                State / Province
              </label>
            </div>

            <div>
              <label className={styles.sublabel}>
                <input
                  type="text"
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleInputChange}
                  required
                />
                Postal / Zip Code
              </label>
            </div>

            <div>
              <label className={styles.sublabel}>
                <input
                  type="text"
                  name="country"
                  value={form.country}
                  onChange={handleInputChange}
                  required
                />
                Country
              </label>
            </div>
          </div>
        </div>

        <div className={styles.confirm}>
          <label className={styles.label}>
            Phone Number
            <input 
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleInputChange}
              placeholder='(XXX) XXX-XXXX'
              required
            />
            {isPhoneInvalid && 
              <span className={styles.errorText}>
                Please enter a valid phone number format.
              </span>
            }
            <span className={styles.helpText}>
              Valid phone number formats: <br/>
              <ul>
                <li>123-456-7890</li>
                <li>(123) 456-7890</li>
                <li>+1 (123) 456-7890</li>
              </ul>
            </span>
          </label>

          <label className={styles.label}>
            Confirm Phone Number
            <input
              type="tel"
              name="confirmPhone"
              placeholder="(XXX) XXX-XXXX"
              value={form.confirmPhone}
              onChange={handleInputChange}
              required
            />
            {isPhoneMismatch && 
              <span className={styles.errorText}>
                Phone numbers must match.
              </span>
            }
          </label>
        </div>

        <div className={styles.confirm}>
          <label className={styles.label}>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleInputChange}
              required
            />
          </label>

          <label className={styles.label}>
            Confirm Email
            <input
              type="email"
              name="confirmEmail"
              value={form.confirmEmail}
              onChange={handleInputChange}
              required
            />
            {isEmailMismatch && <span className={styles.errorText}>Emails must match.</span>}
          </label>
        </div>

        <label className={styles.label}>
          Date of Birth
          <input
            className={styles.dob}
            type="date"
            name="dateOfBirth"
            value={form.dateOfBirth}
            onChange={handleInputChange}
            required
          />
        </label>

        <label className={styles.label}>
          Preferred Pronouns
          <input
            className={styles.pronouns}
            type="text"
            name="pronouns"
            value={form.pronouns}
            onChange={handleInputChange}
            required
          />
        </label>

        <label className={styles.label}>
          How did you hear about this program?
          <select name="heardAbout" value={form.heardAbout} onChange={handleInputChange} required>
            <option value="" disabled>
              Select an option
            </option>
            <option value="social_media">Social Media</option>
            <option value="word_of_mouth">Word-of-mouth</option>
            <option value="referral">Referral</option>
            <option value="returning_member">Returning member</option>
            <option value="advertisement">Advertisement</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className={styles.label}>
          If you are a college student, what University are you attending?
          <input
            type="text"
            name="university"
            value={form.university}
            onChange={handleInputChange}
            required
          />
        </label>

        <label className={styles.label}>
          What are your interests? This will better help us pair you with your Tea-mate!
          <textarea
            id={styles.interests}
            name="interests"
            rows={5}
            value={form.interests}
            onChange={handleInputChange}
            required
          />
        </label>

        <label className={styles.label}>
          What type of tea do you prefer?

          <label>
            <input
              type="radio"
              id="black"
              name="teaPreference"
              value="black"
              checked={form.teaPreference === "black"}
              onChange={handleInputChange}
              required
            />
            Black
          </label>

          <label htmlFor="green">
            <input
              type="radio"
              id="green"
              name="teaPreference"
              value="green"
              checked={form.teaPreference === "green"}
              onChange={handleInputChange}
              required
            />
            Green
          </label>

          <label htmlFor="herbal">
            <input
              type="radio"
              id="herbal"
              name="teaPreference"
              value="herbal"
              checked={form.teaPreference === "herbal"}
              onChange={handleInputChange}
              required
            />
            Herbal
          </label>

          <label htmlFor="variety">
            <input
              type="radio"
              id="variety"
              name="teaPreference"
              value="variety"
              checked={form.teaPreference === "variety"}
              onChange={handleInputChange}
              required
            />
            Variety
          </label>
        </label>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {status && <div className={styles.statusBanner}>{status}</div>}

        <button id={styles.submit} type="submit" disabled={!allRequiredFilled || submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </>
  );
};

export default Registration;
