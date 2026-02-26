import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ProgramState } from "../types";

export type { ProgramState } from "../types";

const programStateRef = doc(db, "config", "programState");


export function subscribeToProgramState(
  callback: (state: ProgramState | null) => void,
  onError?: (error: Error) => void
) {
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
    }
  );
}


export async function startProgram() {
  await updateDoc(programStateRef, {
    started: true,
    updatedAt: serverTimestamp(),
  });
}

export async function finalizeMatches() {
  await updateDoc(programStateRef, {
    matches_final: true,
    updatedAt: serverTimestamp(),
  });
}

export async function setCurrentWeek(week: number) {
  await updateDoc(programStateRef, {
    week,
    updatedAt: serverTimestamp(),
  });
}