import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { ProgramState } from "../types";

export type { ProgramState } from "../types";

const programStateRef = doc(db, "config", "programState");

export function subscribeToProgramState(callback: (state: ProgramState | null) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    programStateRef,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snap.data() as ProgramState);
    },
    (err) => {
      console.error("ProgramState subscription error", err);
      onError?.(err);
    },
  );
}

export async function startProgram() {
  await updateDoc(programStateRef, {
    started: true,
    startDate: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function endProgram() {
  await updateDoc(programStateRef, {
    started: false,
    accepting_registrations: false,
  });
}

export async function endRegistration() {
  await updateDoc(programStateRef, {
    accepting_registrations: true,
  });
}

export async function finalizeMatches() {
  await updateDoc(programStateRef, {
    matches_final: true,
    updatedAt: serverTimestamp(),
  });
}

export async function unfinalizeMatches() {
  await updateDoc(programStateRef, {
    matches_final: false,
    updatedAt: serverTimestamp(),
  });
}

/**
 * The registration form is only editable during the "edit period" — after
 * End Program has run and before End Registration has been clicked.
 */
export async function isRegistrationFormEditable(): Promise<boolean> {
  const snap = await getDoc(programStateRef);
  const data = snap.data();
  if (!data) {
    throw new Error("Program state data not found.");
  }
  return !data.started && !data.accepting_registrations;
}

export async function getRegistrationStatus() {
  const programState = await getDoc(programStateRef);
  const programStateData = programState.data();
  if (!programStateData) {
    throw new Error("Program state data not found.");
  }
  if (programStateData.accepting_registrations === undefined) {
    throw new Error("accepting_registrations is not set in Firestore.");
  }
  if (!programStateData.accepting_registrations) {
    console.log("false");
    return false;
  } else {
    console.log("true");
    return true;
  }
}
