import { useNavigate } from "react-router-dom";
import type { Role } from "../../types";
import { useAuth } from "../../auth/AuthProvider";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { getDocs, query, collection, where } from "firebase/firestore";
import { db } from "../../firebase";
import { inviteAdminAccount, assignAdminRoleToExistingUser } from "../../services/adminAccounts";
import { friendlyAuthError } from "../../utils/firebaseErrors";
import styles from "./AdminCreator.module.css";
import { emailRegex } from "../../regex";
import DropdownInput from "../Registration/Question Types/DropdownInput";
import { getUniversityOptions } from "../Registration/helpers";

type AddAdminModalProps = {
  onClose: () => void;
  onSuccess: (message: string) => void;
};

type AddUserRole = Role | "Participant";

// State for the AddAdminModal form
type AddAdminFormState = {
  firstName: string;
  lastName: string;
  email: string;
  role: AddUserRole;
  university: string;
  participantName: string;
};

export default function AddAdminModal({ onClose, onSuccess }: AddAdminModalProps) {
  const navigate = useNavigate();
  const { programState, programStateLoading } = useAuth();
  const [form, setForm] = useState<AddAdminFormState>({
    firstName: "",
    lastName: "",
    email: "",
    role: "Admin",
    university: "",
    participantName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingAccountPrompt, setExistingAccountPrompt] = useState<{
    participantId: string;
    email: string;
    currentRole?: Role | null;
  } | null>(null);

  const [universityOptions, setUniversityOptions] = useState<string[]>([]);

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);


  useEffect(() => {
    getUniversityOptions().then(setUniversityOptions);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);


  function isParticipantRegistrationClosed(
    programState: { matches_final: boolean; started: boolean; currentParticipants: number; maxParticipants: number } | null,
  ): boolean {
    if (!programState) return false;
    if (programState.matches_final && !programState.started) {
      return true;
    }
    return programState.currentParticipants >= programState.maxParticipants;
  }


  const dismissExistingPrompt = useCallback(() => {
    setExistingAccountPrompt(null);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "role") {
        const roleValue = (value as AddUserRole) ?? "Admin";
        return {
          ...prev,
          role: roleValue,
          university:
            roleValue === "Admin" || roleValue === "Participant"
              ? ""
              : prev.university,
        };
      }
      const nextState = {
        ...prev,
        [name]: value,
      } as AddAdminFormState;
      return nextState;
    });

    if (name === "email" && existingAccountPrompt) {
      dismissExistingPrompt();
    }

    if (error) {
      setError(null);
    }
  };

  const trimmedEmail = form.email.trim();
  const emailValid = emailRegex.test(trimmedEmail);
  const isParticipantRole = form.role === "Participant";

  const participantCreationDisabled =
    isParticipantRole &&
    (programStateLoading || isParticipantRegistrationClosed(programState));

  const allRequiredFilled = isParticipantRole
    ? form.participantName.trim().length > 0
    : form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0 &&
      trimmedEmail.length > 0 &&
      (form.role !== "Subadmin" || form.university.trim().length > 0);

  const canSubmit =
    allRequiredFilled &&
    (isParticipantRole || emailValid) &&
    !participantCreationDisabled &&
    !submitting;

  const prepareExistingAccountPrompt = useCallback(async (email: string) => {
    try {
      const snapshot = await getDocs(
        query(collection(db, "participants"), where("email", "==", email)),
      );

      if (snapshot.empty) {
        setExistingAccountPrompt(null);
        setError(
          "That email already has an account, but no profile was found. Ask them to sign in before assigning roles.",
        );
        return false;
      }

      const docSnap = snapshot.docs[0];
      setExistingAccountPrompt({
        participantId: docSnap.id,
        email,
        currentRole: (docSnap.data().role as Role | undefined) ?? null,
      });
      setError(
        "An account with this email already exists. Promote them to the selected role?",
      );
      return true;
    } catch (lookupError) {
      console.error("Failed to look up existing account", lookupError);
      setExistingAccountPrompt(null);
      setError("We couldn't check for an existing account. Please try again.");
      return false;
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.role === "Participant") {
      if (participantCreationDisabled) {
        setError(programStateLoading ? "Checking program capacity…" : "Program is full.");
        return;
      }

      const name = form.participantName.trim();
      if (!name) {
        setError("Please enter the participant's name.");
        return;
      }
      navigate("/admin/add-participant", { state: { name } });
      onSuccess("Opening the registration form for this participant.");
      return;
    }

    // Final validation before submission
    if (!canSubmit) {
      setError(
        emailValid
          ? "Please fill out all required fields."
          : "Please enter a valid email address.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await inviteAdminAccount({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: trimmedEmail,
        role: form.role as Role,
        university:
          form.role === "Subadmin" ? form.university.trim() : undefined,
      });

      const displayName =
        `${form.firstName.trim()} ${form.lastName.trim()}`.replace(/\s+/g, " ");
      const successMessage = `Invitation sent to ${
        displayName || trimmedEmail
      }.`;
      onSuccess(successMessage);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/email-already-in-use") {
          const prepared = await prepareExistingAccountPrompt(trimmedEmail);
          if (prepared) {
            return;
          }
        }
        setError(friendlyAuthError(err));
      } else {
        setError("We couldn’t create that admin. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExistingAccountPromotion = async () => {
    if (!existingAccountPrompt) return;

    setSubmitting(true);
    setError(null);

    try {
      await assignAdminRoleToExistingUser({
        participantId: existingAccountPrompt.participantId,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        role: form.role as Role,
        university:
          form.role === "Subadmin" ? form.university.trim() : undefined,
      });

      const roleLabel = form.role === "Subadmin" ? "Sub-admin" : "Admin";
      const displayName =
        `${form.firstName.trim()} ${form.lastName.trim()}`.replace(/\s+/g, " ");
      const successMessage = `Updated ${
        displayName || existingAccountPrompt.email
      } to ${roleLabel}.`;
      onSuccess(successMessage);
      setExistingAccountPrompt(null);
    } catch (promotionError) {
      console.error("Failed to update existing account", promotionError);
      setError("We couldn't update the existing account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-admin-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <h2 id="add-admin-title" className={styles.modalTitle}>
            Add New User
          </h2>
        </header>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <span className={styles.radioLabel}>Role</span>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="role"
                  value="Admin"
                  checked={form.role === "Admin"}
                  onChange={handleInputChange}
                />
                <span className={styles.radioContent}>
                  <span className={styles.radioVisual} aria-hidden="true" />
                  <span className={styles.radioText}>Admin</span>
                </span>
              </label>

              <label className={styles.radioOption}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="role"
                  value="Subadmin"
                  checked={form.role === "Subadmin"}
                  onChange={handleInputChange}
                />
                <span className={styles.radioContent}>
                  <span className={styles.radioVisual} aria-hidden="true" />
                  <span className={styles.radioText}>Sub-admin</span>
                </span>
              </label>

              <label className={styles.radioOption}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="role"
                  value="Participant"
                  checked={form.role === "Participant"}
                  onChange={handleInputChange}
                />
                <span className={styles.radioContent}>
                  <span className={styles.radioVisual} aria-hidden="true" />
                  <span className={styles.radioText}>Participant</span>
                </span>
              </label>
            </div>
            {form.role === "Participant" ? (
              <p className={styles.fieldHint} style={{ color: "#475569", marginTop: "0.35rem" }}>
                Manual entry (no login). You will complete their registration form next.
              </p>
            ) : null}
          </div>

          {isParticipantRole ? (
            <div className={styles.field}>
              <label htmlFor="manual-participant-full-name">Participant name</label>
              <input
                ref={firstInputRef}
                id="manual-participant-full-name"
                name="participantName"
                type="text"
                className={styles.textInput}
                value={form.participantName}
                onChange={handleInputChange}
                placeholder="First and last name"
                required
                disabled={participantCreationDisabled}
              />
              {participantCreationDisabled ? (
                <p className={styles.fieldHint}>
                  {programStateLoading ? "Checking program capacity…" : "Program is full."}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label htmlFor="admin-first-name">First Name</label>
                <input
                  ref={firstInputRef}
                  id="admin-first-name"
                  name="firstName"
                  type="text"
                  className={styles.textInput}
                  value={form.firstName}
                  onChange={handleInputChange}
                  placeholder="First name"
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="admin-last-name">Last Name</label>
                <input
                  id="admin-last-name"
                  name="lastName"
                  type="text"
                  className={styles.textInput}
                  value={form.lastName}
                  onChange={handleInputChange}
                  placeholder="Last name"
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="admin-email">Email</label>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  className={styles.textInput}
                  value={form.email}
                  onChange={handleInputChange}
                  placeholder="name@example.com"
                  required
                />
                {!emailValid && trimmedEmail.length > 0 ? (
                  <p className={styles.fieldHint}>Enter a valid email address.</p>
                ) : null}
              </div>

              {form.role === "Subadmin" ? (
                <div className={styles.field}>
                  <label htmlFor="admin-university">University Name</label>

                  <select
                    id="admin-university"
                    name="university"
                    className={styles.textInput}
                    value={form.university}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="" disabled>
                      Select a university
                    </option>

                    {universityOptions.map((uni) => (
                      <option key={uni} value={uni}>
                        {uni}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          )}

          {error ? <div className={styles.errorMessage}>{error}</div> : null}

          {existingAccountPrompt ? (
            <div className={styles.existingPrompt}>
              <p className={styles.existingPromptText}>
                <strong>{existingAccountPrompt.email}</strong>{" "}
                {existingAccountPrompt.currentRole
                  ? `is currently set as ${existingAccountPrompt.currentRole}.`
                  : "already has an account."}
              </p>
              <p className={styles.existingPromptText}>
                Promote them to{" "}
                <strong>
                  {form.role === "Subadmin" ? "Sub-admin" : "Admin"}
                </strong>
                ?
              </p>
              <div className={styles.existingPromptActions}>
                <button
                  type="button"
                  className={styles.promptCancel}
                  onClick={() => {
                    dismissExistingPrompt();
                    setError(null);
                  }}
                  disabled={submitting}
                >
                  No, keep current role
                </button>
                <button
                  type="button"
                  className={styles.promptConfirm}
                  onClick={handleExistingAccountPromotion}
                  disabled={submitting}
                >
                  {submitting ? "Updating…" : "Yes, update"}
                </button>
              </div>
            </div>
          ) : null}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={!canSubmit}
            >
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}