/**
 * Reads what matching needs from participants/{uid}: past partners and
 * whether they're registered for the current cohort.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { isInCohort, readPastPartners, type CohortProfile } from '../utils/pastPairs.js';

// Firestore's getAll is fine with large batches, but keep requests modest.
const GET_ALL_CHUNK = 300;

/**
 * Reads participants/{id} for each id. Ids without a doc are left out of the
 * map (a stale vector); the caller decides what to do with them.
 */
export async function loadCohortProfiles(ids: readonly string[]): Promise<Map<string, CohortProfile>> {
  const db = getFirestore();
  const profiles = new Map<string, CohortProfile>();
  for (let i = 0; i < ids.length; i += GET_ALL_CHUNK) {
    const refs = ids.slice(i, i + GET_ALL_CHUNK).map((id) => db.collection('participants').doc(id));
    if (refs.length === 0) continue;
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data() ?? {};
      profiles.set(snap.id, {
        pastPartners: readPastPartners(data),
        inCohort: isInCohort(data),
      });
    }
  }
  return profiles;
}
