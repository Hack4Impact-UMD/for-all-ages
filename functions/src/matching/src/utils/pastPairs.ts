/**
 * Past partners: End Program records everyone a participant was paired with
 * on participants/{uid}.pastPartners. Matching never pairs them again.
 *
 * Pure helpers (unit-tested); services/pastPartners.ts reads Firestore.
 */

export type PairLike = { studentId: string; seniorId: string };

/** What matching needs from a participant's Firestore doc. */
export type CohortProfile = {
  pastPartners: string[];
  /**
   * False for a past participant who kept their profile after End Program
   * but hasn't registered for this cohort (no type and no user_type).
   */
  inCohort: boolean;
};

const pairKey = (studentId: string, seniorId: string) => `${studentId}|${seniorId}`;

export function readPastPartners(data: { pastPartners?: unknown } | undefined): string[] {
  const raw = data?.pastPartners;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string' && v !== '');
}

/** A doc with neither `type` nor `user_type` belongs to no current cohort. */
export function isInCohort(data: { type?: unknown; user_type?: unknown }): boolean {
  return data.type != null || data.user_type != null;
}

/**
 * "studentId|seniorId" keys for every student/senior pair in this run who
 * were partners before. Either side's list is enough, in case one doc was
 * written and the other wasn't.
 */
export function buildPastPairSet(
  profiles: ReadonlyMap<string, Pick<CohortProfile, 'pastPartners'>>,
  studentIds: readonly string[],
  seniorIds: readonly string[],
): Set<string> {
  const students = new Set(studentIds);
  const seniors = new Set(seniorIds);
  const keys = new Set<string>();
  for (const [id, profile] of profiles) {
    for (const partner of profile.pastPartners) {
      if (students.has(id) && seniors.has(partner)) keys.add(pairKey(id, partner));
      if (seniors.has(id) && students.has(partner)) keys.add(pairKey(partner, id));
    }
  }
  return keys;
}

/** Drops every pair in `pastPairs`, returning the rest and how many were dropped. */
export function removePastPairs<T extends PairLike>(
  pairs: readonly T[],
  pastPairs: ReadonlySet<string>,
): { kept: T[]; blocked: number } {
  if (pastPairs.size === 0) return { kept: [...pairs], blocked: 0 };
  const kept = pairs.filter((p) => !pastPairs.has(pairKey(p.studentId, p.seniorId)));
  return { kept, blocked: pairs.length - kept.length };
}
