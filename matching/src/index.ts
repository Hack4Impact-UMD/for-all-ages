/**
 * CLI entry point for the matching service
 */
import 'dotenv/config';
import { ingestData } from './scripts/ingestData.js';
import { logger } from './utils/logger.js';

/**
 * Parse command line arguments
 */
function parseArgs(): { filePath: string } {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  
  if (fileIndex === -1 || fileIndex === args.length - 1) {
    logger.error('Usage: npm run ingest -- --file <path-to-excel-file>');
    process.exit(1);
  }
  
  const filePath = args[fileIndex + 1];
  return { filePath };
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    logger.info('Tea @ 3 Matching Service - Data Ingestion');
    logger.info('==========================================');
    
    // Validate environment variables
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    
    // Parse command line arguments
    const { filePath } = parseArgs();
    
    // Run ingestion
    await ingestData(filePath);
    
    logger.info('Ingestion completed successfully');
    process.exit(0);
    
  } catch (error) {
    logger.error('Fatal error:', error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }
    
    process.exit(1);
  }
}

// Run main function
main();

