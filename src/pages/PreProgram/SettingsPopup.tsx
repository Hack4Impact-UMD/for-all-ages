import Dialog from "@mui/material/Dialog";
import styles from "./PreProgram.module.css";
import type { ProgramState } from "../../types";
import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Button from "../../components/Button";

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

    useEffect(() => {
        setNumWeeks(program?.numWeeks);
        setMaxParticipants(program?.maxParticipants);
        setChanged(false);
    }, [program, isOpened]);

    useEffect(() => {
        if (program && (numWeeks != program.numWeeks || maxParticipants != program.maxParticipants)) {
            setChanged(true);
        }
    }, [numWeeks, maxParticipants]);

    const handleSave = async () => {
        if (!program) return;

        try {
            const programRef = doc(db, "config", "programState");

            await updateDoc(programRef, {
                numWeeks: Number(numWeeks),
                maxParticipants: Number(maxParticipants),
            });

            setProgram((prev: ProgramState | null) =>
                prev
                    ? {
                        ...prev,
                        numWeeks: Number(numWeeks),
                        maxParticipants: Number(maxParticipants),
                    }
                    : prev
            );

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
