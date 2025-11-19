import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Week } from '../types';

export async function getWeek(weekNumber: number): Promise<Week | null> {
  try {
    const weekRef = doc(db, 'weeks', weekNumber.toString());
    const weekDoc = await getDoc(weekRef);

    if (!weekDoc.exists()) {
      return null;
    }

    const data = weekDoc.data();
    return {
      week: data.week,
      calls: data.calls || [],
    };
  } catch (error) {
    console.error('Error fetching week:', error);
    throw new Error('Failed to fetch week');
  }
}

export async function initializeWeek(weekNumber: number): Promise<void> {
  try {
    const weekRef = doc(db, 'weeks', weekNumber.toString());
    const weekDoc = await getDoc(weekRef);

    if (!weekDoc.exists()) {
      await setDoc(weekRef, {
        week: weekNumber,
        calls: [],
      });
    }
  } catch (error) {
    console.error('Error initializing week:', error);
    throw new Error('Failed to initialize week');
  }
}

export async function addCallToWeek(weekNumber: number, matchId: string): Promise<void> {
  try {
    const weekRef = doc(db, 'weeks', weekNumber.toString());
    const weekDoc = await getDoc(weekRef);

    if (weekDoc.exists()) {
      await updateDoc(weekRef, { calls: arrayUnion(matchId) });
    } else {
      await setDoc(weekRef, { week: weekNumber, calls: [matchId] });
    }
  } catch (error) {
    console.error('Error adding call to week:', error);
    throw new Error('Failed to add call to week');
  }
}

export async function isCallCompleted(weekNumber: number, matchId: string): Promise<boolean> {
  try {
    const week = await getWeek(weekNumber);

    if (!week) {
      return false;
    }

    return week.calls.includes(matchId);
  } catch (error) {
    console.error('Error checking if call is completed:', error);
    throw new Error('Failed to check if call is completed');
  }
}
