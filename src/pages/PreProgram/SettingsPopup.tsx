import Dialog from "@mui/material/Dialog";
import styles from "./PreProgram.module.css";
import type { ProgramState } from "../../types";
import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { endRegistration } from "../../services/programState";
interface SettingsPopupProps {
  isOpened: boolean;
  close: () => void;
  program: ProgramState | null;
  setProgram: React.Dispatch<React.SetStateAction<ProgramState | null>>;
  onThresholdChange?: (newThreshold: number) => Promise<void>;
}

export default function SettingsPopup({
  isOpened,
  close,
  program,
  setProgram,
  onThresholdChange,
}: SettingsPopupProps) {
  const [numWeeks, setNumWeeks] = useState(program?.numWeeks ?? 1);
  const [maxParticipants, setMaxParticipants] = useState(
    program?.maxParticipants ?? 2,
  );
  const [autoApprovalThreshold, setAutoApprovalThreshold] = useState(
    program?.autoApprovalThreshold ?? 80,
  );
  const [originalThreshold, setOriginalThreshold] = useState(
    program?.autoApprovalThreshold ?? 80,
  );
  const [changed, setChanged] = useState(false);
  const [endingRegistration, setEndingRegistration] = useState(false);
  const [confirmingEndRegistration, setConfirmingEndRegistration] =
    useState(false);
  const [endRegistrationError, setEndRegistrationError] = useState<
    string | null
  >(null);

  useEffect(() => {
    const threshold = program?.autoApprovalThreshold ?? 80;
    setNumWeeks(program?.numWeeks ?? 1);
    setMaxParticipants(program?.maxParticipants ?? 2);
    setAutoApprovalThreshold(threshold);
    setOriginalThreshold(threshold);
    setChanged(false);
  }, [program, isOpened]);

  useEffect(() => {
    if (!program) {
      setChanged(false);
      return;
    }

    if (
      numWeeks != program.numWeeks ||
      maxParticipants != program.maxParticipants ||
      autoApprovalThreshold != (program.autoApprovalThreshold ?? 80)
    ) {
      setChanged(true);
    } else {
      setChanged(false);
    }
  }, [numWeeks, maxParticipants, autoApprovalThreshold, program]);

  // Editable only during the registration "edit period": program not
  // running, and registration not yet reopened to the public.
  const inEditPeriod = !program?.started && !program?.accepting_registrations;

  const handleEndRegistration = async () => {
    if (!program || !inEditPeriod) return;

    try {
      setEndRegistrationError(null);
      setEndingRegistration(true);
      await endRegistration();
      setProgram((prev: ProgramState | null) =>
        prev ? { ...prev, accepting_registrations: true } : prev,
      );
      setConfirmingEndRegistration(false);
    } catch (error) {
      console.error("Failed to end registration:", error);
      setEndRegistrationError("Failed to end registration. Please try again.");
    } finally {
      setEndingRegistration(false);
    }
  };

  const handleSave = async () => {
    if (!program) return;

    try {
      const programRef = doc(db, "config", "programState");

      const clampedThreshold = Math.min(
        100,
        Math.max(0, Number(autoApprovalThreshold)),
      );

      await updateDoc(programRef, {
        numWeeks: Number(numWeeks),
        maxParticipants: Number(maxParticipants),
        autoApprovalThreshold: clampedThreshold,
      });

      setProgram((prev: ProgramState | null) =>
        prev
          ? {
              ...prev,
              numWeeks: Number(numWeeks),
              maxParticipants: Number(maxParticipants),
              autoApprovalThreshold: clampedThreshold,
            }
          : prev,
      );

      // Check if threshold changed and update match statuses
      if (onThresholdChange && clampedThreshold !== originalThreshold) {
        await onThresholdChange(clampedThreshold);
      }

      close();
    } catch (error) {
      console.error("Failed to update program settings:", error);
    }
  };

  return (
    <Dialog
      open={isOpened}
      onClose={close}
      classes={{ paper: styles.dialogPaper }}
    >
      <div className={styles.settingsContainer}>
        <h3>Program Settings</h3>

        <div className={styles.settingsRow}>
          <p>Number of weeks: </p>
          <input
            className={styles.numberInput}
            max={99}
            min={1}
            type="number"
            value={numWeeks}
            disabled={program?.started}
            onChange={(e) => {
              setNumWeeks(Number(e.target.value));
            }}
          ></input>
        </div>

        <div className={styles.settingsRow}>
          <p>Current Participants: </p>
          <span>{program?.currentParticipants ?? 0}</span>
        </div>

        <div className={styles.settingsRow}>
          <p>Maximum Number of Participants: </p>
          <input
            className={styles.numberInput}
            min={2}
            type="number"
            step={2}
            value={maxParticipants}
            disabled={program?.started || program?.matches_final}
            onChange={(e) => {
              setMaxParticipants(Number(e.target.value));
            }}
          ></input>
        </div>

        <div className={styles.settingsRow}>
          <p>Automatic Approval Threshold (%) : </p>
          <input
            className={styles.numberInput}
            min={0}
            max={100}
            type="number"
            value={autoApprovalThreshold}
            disabled={program?.started || program?.matches_final}
            onChange={(e) => {
              setAutoApprovalThreshold(Number(e.target.value));
            }}
          />
        </div>

        <div className={styles.settingsRow}>
          <p>Accepting Registrations: </p>
          <button
            className={
              program?.accepting_registrations
                ? !program.matches_final
                  ? styles.registrationRowYes
                  : styles.registrationRowNo
                : styles.registrationRowNo
            }
          >
            {program?.accepting_registrations
                ? !program.matches_final
                    ? "YES"
                    : "NO"
                : "NO"}
          </button>
        </div>

        <div className={styles.settingsRow}>
          <p>Registration Form: </p>
          <button
            onClick={() => setConfirmingEndRegistration(true)}
            disabled={!inEditPeriod || endingRegistration}
            title={
              !inEditPeriod
                ? program?.accepting_registrations
                  ? "Registration form is locked and open to the public."
                  : "End Program to begin the registration edit period first."
                : undefined
            }
          >
            {program?.accepting_registrations
              ? "Registration Locked"
              : endingRegistration
                ? "Ending Registration..."
                : "End Registration"}
          </button>
        </div>

        {confirmingEndRegistration && (
          <div className={styles.settingsRow}>
            <p>
              This locks the registration form (no more edits) and opens
              registration to the public. This cannot be undone until the next
              End Program.
            </p>
            <button onClick={handleEndRegistration} disabled={endingRegistration}>
              {endingRegistration ? "Ending..." : "Yes, end registration"}
            </button>
            <button
              onClick={() => setConfirmingEndRegistration(false)}
              disabled={endingRegistration}
            >
              Cancel
            </button>
          </div>
        )}

        {endRegistrationError && (
          <p className={styles.warning}>{endRegistrationError}</p>
        )}

        {program?.started || program?.matches_final ? (
          <p className={styles.warning}>
            One more more settings may not be editable if the program has
            started or matches have been made final.
          </p>
        ) : (
          ""
        )}
      </div>
      <button onClick={handleSave} disabled={!changed}>
        Save
      </button>
      <button onClick={close} className={styles.close}>
        Close
      </button>
    </Dialog>
  );
}
