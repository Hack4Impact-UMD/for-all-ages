import type { ProgramState } from "../types";

/**
 * Whether new participants can't complete registration right now. Mirrors the
 * "Accepting registrations" status in the program settings: open only once
 * registration is locked in and matches aren't final.
 */
export function signupsClosed(
  programState: Pick<ProgramState, "matches_final" | "accepting_registrations"> | null | undefined,
): boolean {
  if (!programState) return false;
  return programState.matches_final === true || programState.accepting_registrations !== true;
}
