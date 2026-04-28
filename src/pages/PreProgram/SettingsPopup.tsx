import Dialog from "@mui/material/Dialog";
import styles from "./PreProgram.module.css";
import type { ProgramState } from "../../types";
import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Button from "../../components/Button";
import { setAcceptingRegistrations } from "../../services/programState";

interface SettingsPopupProps {
    isOpened: boolean;
    close: () => void;
    program: ProgramState | null;
    setProgram: Function;
    programStarted: boolean;
    matchesFinalized: boolean;
    programStateLoading: boolean;
    startingProgram: boolean;
    finalizing: boolean;
    onToggleProgram: () => void;
    onLockMatches: () => void;
}

export default function SettingsPopup({
    isOpened,
    close,
    program,
    setProgram,
    programStarted,
    matchesFinalized,
    programStateLoading,
    startingProgram,
    finalizing,
    onToggleProgram,
    onLockMatches,
}: SettingsPopupProps) {
    const [numWeeks, setNumWeeks] = useState(program?.numWeeks);
    const [maxParticipants, setMaxParticipants] = useState(program?.maxParticipants);
    const [changed, setChanged] = useState(false);
    const [togglingRegistrations, setTogglingRegistrations] = useState(false);

    // Default to open (true) unless matches are finalized or the field is explicitly false
    const acceptingRegistrations = program?.accepting_registrations ?? !matchesFinalized;

    useEffect(() => {
        setNumWeeks(program?.numWeeks);
        setMaxParticipants(program?.maxParticipants);
        setChanged(false);
    }, [program, isOpened]);

    useEffect(() => {
        if (program && (numWeeks != program.numWeeks || maxParticipants != program.maxParticipants)) {
            setChanged(true);
        } else {
            setChanged(false);
        }
    }, [numWeeks, maxParticipants]);

    const handleToggleRegistrations = async () => {
        if (!program || matchesFinalized || togglingRegistrations) return;
        setTogglingRegistrations(true);
        try {
            await setAcceptingRegistrations(!acceptingRegistrations);
            setProgram((prev: ProgramState | null) =>
                prev ? { ...prev, accepting_registrations: !acceptingRegistrations } : prev
            );
        } catch (error) {
            console.error("Failed to update accepting registrations:", error);
        } finally {
            setTogglingRegistrations(false);
        }
    };

    const handleSave = async () => {
        if (!program) return;

        try {
            const programRef = doc(db, "config", "programState");

            const clampedThreshold = Math.min(100, Math.max(0, Number(autoApprovalThreshold)));

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
                    : prev
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
        <Dialog open={isOpened} onClose={close} classes={{ paper: styles.dialogPaper }}>
            <div className={styles.settingsContainer}>
                <h3>Program Settings</h3>

                <div className={styles.settingsRow}>
                    <p>Accepting Registrations</p>
                    <label className={`${styles.toggle} ${matchesFinalized ? styles.toggleDisabled : ""}`}>
                        <input
                            type="checkbox"
                            checked={acceptingRegistrations}
                            disabled={matchesFinalized || togglingRegistrations}
                            onChange={handleToggleRegistrations}
                        />
                        <span className={`${styles.toggleSlider} ${acceptingRegistrations ? styles.toggleOn : styles.toggleOff}`} />
                    </label>
                </div>

                <div className={styles.settingsRow}>
                    <p>Number of weeks: </p>
                    <input
                        className={styles.numberInput}
                        max={99}
                        min={1}
                        type="number"
                        value={numWeeks}
                        disabled={program?.started}
                        onChange={(e) => setNumWeeks(Number(e.target.value))}
                    />
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
                        onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    />
                </div>

                {program?.started || program?.matches_final ? (
                    <p className={styles.warning}>
                        One or more settings may not be editable if the program has started or matches have been made final.
                    </p>
                ) : ""}

                <div className={styles.settingsActions}>
                    <Button
                        type={programStarted ? "Danger" : "Primary"}
                        text={
                            programStarted
                                ? "End Program"
                                : startingProgram
                                    ? "Starting..."
                                    : "Start Program"
                        }
                        height={48}
                        width={240}
                        fontSize={15}
                        disabled={programStateLoading || startingProgram}
                        onClick={onToggleProgram}
                    />
                    <Button
                        type="Outline"
                        text={
                            matchesFinalized
                                ? "Matches Locked"
                                : finalizing
                                    ? "Locking..."
                                    : "Lock All Matches"
                        }
                        height={48}
                        width={240}
                        fontSize={15}
                        disabled={programStateLoading || finalizing || matchesFinalized}
                        onClick={onLockMatches}
                    />
                </div>
            </div>
            <button onClick={handleSave} disabled={!changed}>Save</button>
            <button onClick={close} className={styles.close}>Close</button>
        </Dialog>
    );
}
