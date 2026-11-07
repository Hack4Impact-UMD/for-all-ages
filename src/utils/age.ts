import type { Question } from "../types";

// Self-registration only accepts dates of birth in this age range; anything
// outside it is almost certainly a typo. Admin manual entry skips the check.
// Keep in sync with functions/src/age.ts.
export const MIN_AGE = 14;
export const MAX_AGE = 110;

export type UserType = "student" | "adult";

export function isDateOfBirthQuestion(question: Question): boolean {
  if (question.lockedKey === "date of birth") return true;
  const title = question.title.toLowerCase();
  return title.includes("date of birth") || title.includes("birthday") || title === "dob";
}

/** Format a date as YYYY-MM-DD in local time (toISOString would use UTC). */
export function toLocalDateString(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The date exactly `years` years before today, as YYYY-MM-DD in local time. */
export function yearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return toLocalDateString(date);
}

/** Age in whole years from a YYYY-MM-DD string, or null if it doesn't parse. */
export function computeAge(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const birth = new Date(`${dob}T00:00:00`);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function isPlausibleAge(age: number): boolean {
  return age >= MIN_AGE && age <= MAX_AGE;
}

/** 55+ are adults, under 36 are students; 36-54 wait for an admin to decide. */
export function userTypeForAge(age: number): UserType | null {
  if (age >= 55) return "adult";
  if (age >= 36) return null;
  return "student";
}
