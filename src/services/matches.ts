import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Match } from '../types';

function documentToMatch(doc: QueryDocumentSnapshot<DocumentData>): Match & { id: string } {
  const data = doc.data();
  
  return {
    id: doc.id,
    participant1_id: data.participant1_id,
    participant2_id: data.participant2_id,
    day_of_call: typeof data.day_of_call === 'number' ? data.day_of_call : 1, // Default to Monday (1) if missing/invalid
    similarity: data.similarity,
  };
}

export async function createMatch(match: Match): Promise<string> {
  try {
    const matchesRef = collection(db, 'matches');
    const docRef = await addDoc(matchesRef, match);
    return docRef.id;
  } catch (error) {
    console.error('Error creating match:', error);
    throw new Error('Failed to create match');
  }
}

export async function getMatchById(matchId: string): Promise<(Match & { id: string }) | null> {
  try {
    const matchRef = doc(db, 'matches', matchId);
    const matchDoc = await getDoc(matchRef);

    if (!matchDoc.exists()) {
      return null;
    }

    return documentToMatch(matchDoc as QueryDocumentSnapshot<DocumentData>);
  } catch (error) {
    console.error('Error fetching match:', error);
    throw new Error('Failed to fetch match');
  }
}

export async function getMatchesByParticipant(participantId: string): Promise<(Match & { id: string })[]> {
  try {
    const matchesRef = collection(db, 'matches-test');
    const q1 = query(matchesRef, where('participant1_id', '==', participantId));
    const q2 = query(matchesRef, where('participant2_id', '==', participantId));

    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q1),
      getDocs(q2),
    ]);

    const matches1 = snapshot1.docs.map(documentToMatch);
    const matches2 = snapshot2.docs.map(documentToMatch);
    // Sort by day of call
    return [...matches1, ...matches2].sort((a, b) => a.day_of_call - b.day_of_call);
  } catch (error) {
    console.error('Error fetching matches by participant:', error);
    throw new Error('Failed to fetch matches by participant');
  }
}

export async function getAllMatches(): Promise<(Match & { id: string })[]> {
  try {
    const matchesRef = collection(db, 'matches-test');
    const snapshot = await getDocs(matchesRef);

    return snapshot.docs.map(documentToMatch).sort((a, b) => a.day_of_call - b.day_of_call);
  } catch (error) {
    console.error('Error fetching all matches:', error);
    throw new Error('Failed to fetch all matches');
  }
}

export function getPartnerId(match: Match, currentParticipantId: string): string {
  if (match.participant1_id === currentParticipantId) {
    return match.participant2_id;
  } else {
    return match.participant1_id;
  }
}

export async function updateMatchDayOfWeek(matchId: string, dayOfWeek: number): Promise<void> {
  try {
    const matchRef = doc(db, 'matches', matchId);
    await updateDoc(matchRef, {
      day_of_call: dayOfWeek,
    });
  } catch (error) {
    throw new Error('Failed to update match day of week');
  }
}
