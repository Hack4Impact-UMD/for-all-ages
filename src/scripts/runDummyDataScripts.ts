/**
 * Helper file to run dummy data scripts
 *
 * IMPORTANT: Only use this in development!
 *
 * Usage in browser console:
 * ```
 * // Simple way - run everything at once:
 * runDummyDataScripts()
 * 
 * // Or run individually:
 * const matchIds = await insertDummyMatches()
 * await insertDummyLogs(matchIds)
 * ```
 * 
 * These functions are automatically exposed to the window object when the app loads.
 */

import { insertDummyMatches } from './insertDummyMatches';
import { insertDummyLogs } from './insertDummyLogs';

/**
 * Run all dummy data scripts in the correct order
 */
export async function runAllDummyDataScripts(): Promise<void> {
  console.log('🚀 Starting dummy data insertion...\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Insert matches
    console.log('\n📋 STEP 1: Creating dummy matches...');
    const matchIds = await insertDummyMatches();

    if (!matchIds || matchIds.length === 0) {
      throw new Error('Failed to create matches');
    }

    console.log('\n⏳ Waiting 2 seconds before creating logs...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Insert logs and update weeks
    console.log('\n📋 STEP 2: Creating dummy logs and weeks...');
    await insertDummyLogs(matchIds);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All dummy data created successfully!');
    console.log('\nNext steps:');
    console.log('   1. Check Firestore console to verify data');
    console.log('   2. Test the LogCallForm to submit logs');
    console.log('   3. View AdminDashboard to see the calendar with statuses');

  } catch (error) {
    console.error('\n❌ Error running dummy data scripts:', error);
    console.log('\nTroubleshooting:');
    console.log('   - Ensure you have at least 2 participants registered');
    console.log('   - Check Firebase console for permission errors');
    console.log('   - Verify your Firebase configuration');
  }
}

// Export individual functions for granular control
export { insertDummyMatches } from './insertDummyMatches';
export { insertDummyLogs } from './insertDummyLogs';

// Expose functions to window object for browser console access
// This allows calling functions from the browser console without import statements
if (typeof window !== 'undefined') {
  (window as any).runDummyDataScripts = async () => {
    const { insertDummyMatches } = await import('./insertDummyMatches');
    const { insertDummyLogs } = await import('./insertDummyLogs');
    
    console.log('🚀 Starting dummy data insertion...\n');
    console.log('='.repeat(60));

    try {
      // Step 1: Insert matches
      console.log('\n📋 STEP 1: Creating dummy matches...');
      const matchIds = await insertDummyMatches();

      if (!matchIds || matchIds.length === 0) {
        throw new Error('Failed to create matches');
      }

      console.log('\n⏳ Waiting 2 seconds before creating logs...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Insert logs and update weeks
      console.log('\n📋 STEP 2: Creating dummy logs and weeks...');
      await insertDummyLogs(matchIds);

      console.log('\n' + '='.repeat(60));
      console.log('✅ All dummy data created successfully!');
      console.log('\nNext steps:');
      console.log('   1. Check Firestore console to verify data');
      console.log('   2. Test the LogCallForm to submit logs');
      console.log('   3. View AdminDashboard to see the calendar with statuses');

    } catch (error) {
      console.error('\n❌ Error running dummy data scripts:', error);
      console.log('\nTroubleshooting:');
      console.log('   - Ensure you have at least 2 participants registered');
      console.log('   - Check Firebase console for permission errors');
      console.log('   - Verify your Firebase configuration');
    }
  };
  
  (window as any).insertDummyMatches = async () => {
    const { insertDummyMatches } = await import('./insertDummyMatches');
    return await insertDummyMatches();
  };
  
  (window as any).insertDummyLogs = async (matchIds: string[]) => {
    const { insertDummyLogs } = await import('./insertDummyLogs');
    return await insertDummyLogs(matchIds);
  };
  
  console.log('✅ Dummy data scripts are now available in the console!');
  console.log('   Use: runDummyDataScripts()');
  console.log('   Or: insertDummyMatches() then insertDummyLogs(matchIds)');
}
