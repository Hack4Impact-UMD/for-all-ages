/**
 * Admin Dashboard Services - READ-ONLY Firestore operations
 * IMPORTANT: This service only performs READ operations (getDocs, getDoc).
 * No write/update/delete operations are performed.
 */

import { collection, doc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserLog, MatchLogPair } from '../types';

// ============================================================================
// TYPES
// ============================================================================

type DayKey = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thurs' | 'Fri' | 'Sat';

export type PersonAssignment = {
    names: string[];
    variant?: 'rose' | 'green' | 'gold';
    participantIds: string[];
};

export type WeekSchedule = Record<DayKey, PersonAssignment[]>;

/** Firestore Log document structure */
interface FirestoreLog {
    uid: string;
    week: number;
    duration: number;
    rating: number;
    concerns: string;
}

/** Firestore Match document structure */
interface FirestoreMatch {
    participant1_id: string;
    participant2_id: string;
    day_of_call: number | { toDate: () => Date } | Date;  // Can be day index (0-6), Timestamp, or Date
    similarity?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Converts a day index (0-6) or Date to a DayKey */
function getDayKey(dayOrDate: number | Date): DayKey {
    const keys: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat'];
    if (typeof dayOrDate === 'number') {
        // day_of_call is stored as 0=Sun, 1=Mon, ..., 6=Sat
        return keys[dayOrDate] ?? 'Sun';
    }
    return keys[dayOrDate.getDay()];
}

/** Fetches a participant's display name from the participants collection. */
async function getParticipantName(uid: string): Promise<string> {
    const docRef = doc(db, 'participants', uid);
    const snapshot = await getDoc(docRef);
    
    if (snapshot.exists()) {
        const data = snapshot.data();
        return data.displayName || data.name || 
               `${data.firstName || ''} ${data.lastName || ''}`.trim() || 
               'Unknown';
    }
    return 'Unknown';
}

// ============================================================================
// MATCHES
// ============================================================================

/**
 * Fetches all matches from Firestore and builds a week schedule.
 * READ-ONLY: Only uses getDocs/getDoc.
 */
export async function getAllMatches(): Promise<WeekSchedule> {
    const result: WeekSchedule = {
        Sun: [], Mon: [], Tue: [], Wed: [], Thurs: [], Fri: [], Sat: []
    };

    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);

    const assignments = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
            const m = docSnap.data() as FirestoreMatch;

            const [name1, name2] = await Promise.all([
                getParticipantName(m.participant1_id),
                getParticipantName(m.participant2_id),
            ]);

            // Handle different day_of_call formats: number (0-6), Timestamp, or Date
            const raw = m.day_of_call;
            let dayKey: DayKey;
            if (typeof raw === 'number') {
                dayKey = getDayKey(raw);
            } else if (raw && typeof raw === 'object' && 'toDate' in raw && typeof raw.toDate === 'function') {
                dayKey = getDayKey(raw.toDate());
            } else {
                dayKey = getDayKey(raw as Date);
            }
            
            const assignment: PersonAssignment = {
                names: [name1, name2],
                variant: undefined,
                participantIds: [m.participant1_id, m.participant2_id],
            };

            return { dayKey, assignment };
        })
    );

    for (const { dayKey, assignment } of assignments) {
        result[dayKey].push(assignment);
    }

    return result;
}

// ============================================================================
// LOGS
// ============================================================================

/**
 * Fetches logs for a match by querying each participant's log for the given week.
 * READ-ONLY: Only uses getDocs/getDoc.
 */
export async function getMatchLogs(
    participantIds: string[],
    weekNumber: number
): Promise<MatchLogPair> {
    const logsRef = collection(db, 'logs');
    
    const logs: UserLog[] = await Promise.all(
        participantIds.map(async (uid) => {
            const q = query(
                logsRef,
                where('uid', '==', uid),
                where('week', '==', weekNumber)
            );
            
            const snapshot = await getDocs(q);
            const name = await getParticipantName(uid);
            
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data() as FirestoreLog;
                return {
                    name,
                    hasSubmitted: true,
                    callComplete: true,
                    duration: data.duration,
                    satisfactionScore: data.rating,
                    meetingNotes: data.concerns
                };
            }
            
            return { name, hasSubmitted: false };
        })
    );

    return { 
        matchId: participantIds.join('-'), 
        weekNumber, 
        logs 
    };
}
