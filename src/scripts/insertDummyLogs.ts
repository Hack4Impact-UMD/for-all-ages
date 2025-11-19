/**
 * Script to insert dummy log and week data into Firestore
 *
 * IMPORTANT: Run this AFTER insertDummyMatches.ts
 *
 * Usage:
 * 1. First run insertDummyMatches() to create matches and get match IDs
 * 2. Then run insertDummyLogs(matchIds) to create logs and update weeks
 *
 * This will:
 * - Create sample logs for different weeks
 * - Initialize Week documents (weeks 1-4)
 * - Add match_ids to Week.calls array when at least one participant logs
 */

import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import type { Logs } from '../types';
import { submitLog } from '../services/logs';
import { initializeWeek } from '../services/weeks';

/**
 * Insert dummy logs and update Week documents
 * SAFE: Only creates 5-6 log documents and 4 week documents
 * @param matchIds - Array of match IDs returned from insertDummyMatches()
 */
export async function insertDummyLogs(matchIds: string[]): Promise<void> {
  try {
    if (!matchIds || matchIds.length < 4) {
      console.error('❌ Error: Need at least 4 match IDs');
      console.log('Please run insertDummyMatches() first and pass the returned match IDs');
      return;
    }

    console.log('📝 Initializing Week documents...');

    // Initialize weeks 1-4
    for (let week = 1; week <= 4; week++) {
      await initializeWeek(week);
      console.log(`✓ Initialized Week ${week}`);
    }

    console.log('\n📝 Creating logs...');

    // Get 2 participant IDs
    const participantsRef = collection(db, 'participants');
    const snapshot = await getDocs(participantsRef);

    if (snapshot.empty || snapshot.docs.length < 2) {
      console.error('❌ Error: Need at least 2 participants');
      return;
    }

    const participant1Id = snapshot.docs[0].id;
    const participant2Id = snapshot.docs[1].id;

    const logsToCreate: Logs[] = [];

    // Scenario 1: Week 1 - Both participants logged (should add match to Week.calls)
    logsToCreate.push({
      week: 1,
      uid: participant1Id,
      duration: 45,
      rating: 5,
      concerns: 'Great conversation! Looking forward to next week.',
    });

    logsToCreate.push({
      week: 1,
      uid: participant2Id,
      duration: 45,
      rating: 4,
      concerns: 'Really enjoyed our chat.',
    });

    // Scenario 2: Week 2 - Only one participant logged (should still add match to Week.calls)
    logsToCreate.push({
      week: 2,
      uid: participant1Id,
      duration: 30,
      rating: 4,
      concerns: 'Nice call, but shorter this time.',
    });

    // Scenario 3: Week 3 - Short call
    logsToCreate.push({
      week: 3,
      uid: participant2Id,
      duration: 20,
      rating: 3,
      concerns: 'Had to reschedule due to conflict.',
    });

    // Scenario 4: Week 4 - Both participants with different ratings
    logsToCreate.push({
      week: 4,
      uid: participant1Id,
      duration: 35,
      rating: 3,
      concerns: 'Struggled to find common topics.',
    });

    logsToCreate.push({
      week: 4,
      uid: participant2Id,
      duration: 35,
      rating: 4,
      concerns: 'It was okay, hoping for better next time.',
    });

    // Submit logs (uses upsert logic)
    // match_id is automatically added to Week.calls when submitLog is called
    // Week 1: matchIds[0] (both participants logged)
    await submitLog(logsToCreate[0], matchIds[0]);
    console.log(`✓ Created log for Week ${logsToCreate[0].week}, Participant ${logsToCreate[0].uid.substring(0, 8)}...`);
    
    await submitLog(logsToCreate[1], matchIds[0]);
    console.log(`✓ Created log for Week ${logsToCreate[1].week}, Participant ${logsToCreate[1].uid.substring(0, 8)}...`);

    // Week 2: matchIds[1] (one participant logged)
    await submitLog(logsToCreate[2], matchIds[1]);
    console.log(`✓ Created log for Week ${logsToCreate[2].week}, Participant ${logsToCreate[2].uid.substring(0, 8)}...`);

    // Week 3: matchIds[2] (one participant logged)
    await submitLog(logsToCreate[3], matchIds[2]);
    console.log(`✓ Created log for Week ${logsToCreate[3].week}, Participant ${logsToCreate[3].uid.substring(0, 8)}...`);

    // Week 4: matchIds[3] (both participants logged)
    await submitLog(logsToCreate[4], matchIds[3]);
    console.log(`✓ Created log for Week ${logsToCreate[4].week}, Participant ${logsToCreate[4].uid.substring(0, 8)}...`);
    
    await submitLog(logsToCreate[5], matchIds[3]);
    console.log(`✓ Created log for Week ${logsToCreate[5].week}, Participant ${logsToCreate[5].uid.substring(0, 8)}...`);

    console.log(`\n✅ Successfully created ${logsToCreate.length} logs and updated 4 weeks!`);
    console.log('\nScenarios created:');
    console.log('   1. Week 1: Both participants logged - GREEN');
    console.log('   2. Week 2: One participant logged - GREEN');
    console.log('   3. Week 3: One participant logged - GREEN');
    console.log('   4. Week 4: Both participants logged - GREEN');
    console.log('   5. Weeks 5+: No logs yet - GOLD/ROSE (depending on date)');

  } catch (error) {
    console.error('❌ Error inserting dummy logs:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

