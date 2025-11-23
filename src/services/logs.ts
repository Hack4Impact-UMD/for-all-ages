import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Logs } from '../types';
import { addCallToWeek } from './weeks';

export async function submitLog(log: Logs, matchId?: string): Promise<void> {
  try {
    const logDocId = `${log.week}_${log.uid}`;
    const logRef = doc(db, 'logs', logDocId);
    await setDoc(logRef, log);

    // Automatically add match_id to Week.calls when at least one user submits a log
    // This ensures the Week collection is updated whenever a log is submitted
    if (matchId) {
      await addCallToWeek(log.week, matchId);
    }
  } catch (error) {
    console.error('Error submitting log:', error);
    throw new Error('Failed to submit log');
  }
}

export async function getLogForParticipantWeek(uid: string, week: number): Promise<Logs | null> {
  try {
    const logDocId = `${week}_${uid}`;
    const logRef = doc(db, 'logs', logDocId);
    const logDoc = await getDoc(logRef);

    if (!logDoc.exists()) {
      return null;
    }

    const data = logDoc.data();
    return {
      week: data.week,
      uid: data.uid,
      duration: data.duration,
      rating: data.rating,
      concerns: data.concerns,
    };
  } catch (error) {
    console.error('Error fetching log:', error);
    throw new Error('Failed to fetch log');
  }
}

export async function getLogsByWeek(weekNumber: number): Promise<Logs[]> {
  try {
    const logsRef = collection(db, 'logs');
    const q = query(logsRef, where('week', '==', weekNumber));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        week: data.week,
        uid: data.uid,
        duration: data.duration,
        rating: data.rating,
        concerns: data.concerns,
      };
    });
  } catch (error) {
    console.error('Error fetching logs by week:', error);
    throw new Error('Failed to fetch logs by week');
  }
}

export async function getLogsByParticipant(uid: string): Promise<Logs[]> {
  try {
    const logsRef = collection(db, 'logs');
    const q = query(logsRef, where('uid', '==', uid));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        week: data.week,
        uid: data.uid,
        duration: data.duration,
        rating: data.rating,
        concerns: data.concerns,
      };
    }).sort((a, b) => a.week - b.week);
  } catch (error) {
    console.error('Error fetching logs by participant:', error);
    throw new Error('Failed to fetch logs by participant');
  }
}

export async function getAllLogs(): Promise<Logs[]> {
  try {
    const logsRef = collection(db, 'logs');
    const snapshot = await getDocs(logsRef);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        week: data.week,
        uid: data.uid,
        duration: data.duration,
        rating: data.rating,
        concerns: data.concerns,
      };
    }).sort((a, b) => a.week - b.week);
  } catch (error) {
    console.error('Error fetching all logs:', error);
    throw new Error('Failed to fetch all logs');
  }
}
