import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import styles from "./AdminCreator.module.css";

type AddParticipantModalProps = {
  onClose: () => void;
};

type CapacityState = {
  matches_final: boolean;
  started: boolean;
  currentParticipants: number;
  maxParticipants: number;
} | null;

function isParticipantRegistrationClosed(programState: CapacityState): boolean {
  if (!programState) return false;
  if (programState.matches_final && !programState.started) {
    return true;
  }
  return programState.currentParticipants >= programState.maxParticipants;
}

/**
 * Starts a manual registration for someone who can't sign up themselves
 * (e.g. no computer). Only asks for a name, then hands off to the
 * registration form at /admin/add-participant, which writes the participant
 * and form response docs and upserts them to Pinecone. No Auth account is
 * created, so the participant never logs in.
 */
export default function AddParticipantModal({ onClose }: AddParticipantModalProps) {
  const navigate = useNavigate();
  const { programState, programStateLoading } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const closed =
    programStateLoading || isParticipantRegistrationClosed(programState);
  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !closed;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (closed) {
      setError(programStateLoading ? "Checking program capacity…" : "Program is full.");
      return;
    }
    if (!trimmedName) {
      setError("Please enter the participant's name.");
      return;
    }
    navigate("/admin/add-participant", { state: { name: trimmedName } });
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
        aria-labelledby="add-participant-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <h2 id="add-participant-title" className={styles.modalTitle}>
            Add New Participant
          </h2>
        </header>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <p className={styles.fieldHint}>
            For someone who can't register themselves. No login is created;
            you'll fill out the registration form for them next, and they'll be
            matched like any other participant.
          </p>

          <div className={styles.field}>
            <label htmlFor="manual-participant-full-name">Participant name</label>
            <input
              ref={inputRef}
              id="manual-participant-full-name"
              name="participantName"
              type="text"
              className={styles.textInput}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              placeholder="First and last name"
              required
              disabled={closed}
            />
            {closed ? (
              <p className={styles.fieldError}>
                {programStateLoading ? "Checking program capacity…" : "Program is full."}
              </p>
            ) : null}
          </div>

          {error ? <div className={styles.errorMessage}>{error}</div> : null}

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitButton} disabled={!canSubmit}>
              Continue to form
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
