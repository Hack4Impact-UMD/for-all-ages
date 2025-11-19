/**
 * Script to insert dummy match data into Firestore
 *
 * IMPORTANT: This is a ONE-TIME script for testing. Run carefully!
 *
 * Usage:
 * 1. Ensure Firebase is configured
 * 2. Run: npm run dev
 * 3. Import and call insertDummyMatches() from console or component
 *
 * This will:
 * - Fetch 2 real participants from Firestore
 * - Create 8 match documents with random days for calls
 * - Use realistic similarity scores
 */

import { collection, addDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import type { Match } from '../types';

/**
 * Insert dummy matches between real participants
 * SAFE: Only creates ~8 match documents
 */
export async function insertDummyMatches(): Promise<string[]> {
  try {
    console.log('Fetching real participants from Firestore...');

    // Query for participants (not admins)
    const participantsRef = collection(db, 'participants');
    const participantQuery = query(
      participantsRef,
      where('type', '==', 'Participant'),
      limit(2)
    );

    const snapshot = await getDocs(participantQuery);

    if (snapshot.empty || snapshot.docs.length < 2) {
      console.error('  Error: Need at least 2 participants in the database');
      console.log('Please create participants first by registering users');
      return [];
    }

    const participant1 = snapshot.docs[0];
    const participant2 = snapshot.docs[1];

    const p1Data = participant1.data();
    const p2Data = participant2.data();

    console.log(`  Found participants:`);
    console.log(`   - ${p1Data.displayName || 'Participant 1'} (${participant1.id})`);
    console.log(`   - ${p2Data.displayName || 'Participant 2'} (${participant2.id})`);

    // Create 8 matches with random days of the week
    // Each match gets a different day (Monday = 0, Sunday = 6)
    const matchesToCreate: Match[] = [
      {
        participant1_id: participant1.id,
        participant2_id: participant2.id,
        day_of_call: getRandomDayThisWeek(1), // Monday
        similarity: 0.87,
      },
      {
        participant1_id: participant1.id,
        participant2_id: participant2.id,
        day_of_call: getRandomDayThisWeek(2), // Tuesday
        similarity: 0.85,
      },
      {
        participant1_id: participant1.id,
        participant2_id: participant2.id,
        day_of_call: getRandomDayThisWeek(3), // Wednesday
        similarity: 0.82,
      },
      {
        participant1_id: participant1.id,
        participant2_id: participant2.id,
        day_of_call: getRandomDayThisWeek(4), // Thursday
        similarity: 0.79,
      },
      {
        participant1_id: participant1.id,
        participant2_id: participant2.id,
        day_of_call: getRandomDayThisWeek(5), // Friday
        similarity: 0.76,
      },
      {
        participant1_id: participant1.id,
        participant2_id: participant2.id,
        day_of_call: getRandomDayThisWeek(6), // Saturday
        similarity: 0.88,
      },
      {
        participant1_id: participant1.id,
        participant2_id: participant2.id,
        day_of_call: getRandomDayThisWeek(0), // Sunday
        similarity: 0.74,
      },
      {
        participant1_id: participant1.id,
        participant2_id: participant2.id,
        day_of_call: getRandomDayThisWeek(1), // Monday (different week)
        similarity: 0.81,
      },
    ];

    console.log(`\nCreating ${matchesToCreate.length} match documents...`);

    const matchesRef = collection(db, 'matches');
    const createdMatchIds: string[] = [];

    for (const match of matchesToCreate) {
      const docRef = await addDoc(matchesRef, match);
      createdMatchIds.push(docRef.id);
      console.log(`✓ Created match for ${match.day_of_call.toDateString()} - ID: ${docRef.id}`);
    }

    console.log(`\n✅ Successfully created ${createdMatchIds.length} matches!`);
    console.log(`\nMatch IDs (save these for creating logs):`);
    createdMatchIds.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });

    return createdMatchIds;

  } catch (error) {
    console.error('  Error inserting dummy matches:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

/**
 * Helper function to get a random date for a specific day of the week
 * @param dayOfWeek - 0 (Sunday) to 6 (Saturday)
 * @returns Date object set to that day of this or next week
 */
function getRandomDayThisWeek(dayOfWeek: number): Date {
  const today = new Date();
  const currentDay = today.getDay();

  // Calculate days until target day
  let daysUntilTarget = dayOfWeek - currentDay;
  if (daysUntilTarget < 0) {
    daysUntilTarget += 7; // Next week
  }

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntilTarget);
  targetDate.setHours(14, 0, 0, 0); // Set to 2 PM for consistency

  return targetDate;
}

