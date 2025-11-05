/**
 * Script to delete all vectors from the Pinecone index
 */
import 'dotenv/config';
import { getPineconeClient, getIndexName } from '../config/pinecone.config.js';
import { logger } from '../utils/logger.js';

/**
 * Delete all vectors from the index
 */
async function deleteAllVectors(): Promise<void> {
  try {
    logger.info('========================================');
    logger.info('Delete All Vectors - Pinecone Index');
    logger.info('========================================');
    
    const client = getPineconeClient();
    const indexName = getIndexName();
    const index = client.index(indexName);
    
    logger.info(`Target index: ${indexName}`);
    
    // Get current stats
    const statsBefore = await index.describeIndexStats();
    const totalVectorsBefore = statsBefore.totalRecordCount || 0;
    
    logger.info(`Current vectors in index: ${totalVectorsBefore}`);
    
    if (totalVectorsBefore === 0) {
      logger.info('✓ Index is already empty. Nothing to delete.');
      return;
    }
    
    // Confirm deletion
    logger.warn('⚠️  WARNING: This will delete ALL vectors from the index!');
    logger.info('Proceeding with deletion in 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Delete all vectors by deleting all records
    logger.info('Deleting all vectors...');
    await index.deleteAll();
    
    logger.info('✓ Delete command sent successfully');
    
    // Wait a bit for deletion to process
    logger.info('Waiting for deletion to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify deletion
    const statsAfter = await index.describeIndexStats();
    const totalVectorsAfter = statsAfter.totalRecordCount || 0;
    
    logger.info('========================================');
    logger.info('Deletion Summary');
    logger.info('========================================');
    logger.info(`Vectors before: ${totalVectorsBefore}`);
    logger.info(`Vectors after: ${totalVectorsAfter}`);
    
    if (totalVectorsAfter === 0) {
      logger.info('✅ All vectors deleted successfully!');
    } else {
      logger.warn(`⚠️  ${totalVectorsAfter} vectors still remain (deletion may still be processing)`);
    }
    
  } catch (error) {
    logger.error('❌ Failed to delete vectors');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Run deletion
deleteAllVectors()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
