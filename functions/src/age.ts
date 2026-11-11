// Age rules for self-registration. src/utils/age.ts is the client copy.

export const MIN_AGE = 14;
export const MAX_AGE = 110;

export type UserType = "student" | "adult";

/** Age in whole years from a YYYY-MM-DD string, or null if it doesn't parse. */
export function computeAge(dob: unknown, today: Date = new Date()): number | null {
  if (typeof dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [year, month, day] = dob.split("-").map(Number);
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return null;
  let age = today.getUTCFullYear() - year;
  const m = today.getUTCMonth() - (month - 1);
  if (m < 0 || (m === 0 && today.getUTCDate() < day)) age--;
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
