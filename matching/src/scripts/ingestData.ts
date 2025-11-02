/**
 * Main data ingestion pipeline
 * Processes Excel file → generates embeddings → stores in Pinecone
 */
import { parseExcelFile, validateFilePath } from '../services/dataProcessor.js';
import { createParticipantProfileText } from '../utils/textProcessor.js';
import { generateEmbeddingsBatch } from '../services/embeddingService.js';
import { initializeIndex, upsertEmbeddings, checkIndexStatus } from '../services/vectorService.js';
import { logger } from '../utils/logger.js';
import type { ParticipantData } from '../utils/validator.js';

/**
 * Main ingestion function
 */
export async function ingestData(filePath: string): Promise<void> {
  try {
    logger.info('=== Starting Data Ingestion Pipeline ===');
    
    // Step 1: Validate file path
    logger.info(`Step 1: Validating file path: ${filePath}`);
    const fileExists = await validateFilePath(filePath);
    if (!fileExists) {
      throw new Error(`File not found: ${filePath}`);
    }
    logger.info('✓ File path validated');
    
    // Step 2: Parse Excel file
    logger.info('Step 2: Parsing Excel file...');
    const participants = await parseExcelFile(filePath);
    
    if (participants.length === 0) {
      logger.warn('No participants found in file');
      return;
    }
    
    logger.info(`✓ Parsed ${participants.length} participants`);
    logger.info(`  - Young: ${participants.filter(p => p.type === 'young').length}`);
    logger.info(`  - Older: ${participants.filter(p => p.type === 'older').length}`);
    
    // Step 3: Create profile texts
    logger.info('Step 3: Creating participant profile texts...');
    const profileTexts = participants.map(participant => 
      createParticipantProfileText(participant)
    );
    logger.info(`✓ Created ${profileTexts.length} profile texts`);
    
    // Step 4: Initialize Pinecone index
    logger.info('Step 4: Initializing Pinecone index...');
    await initializeIndex();
    logger.info('✓ Pinecone index ready');
    
    // Step 5: Generate embeddings
    logger.info('Step 5: Generating embeddings...');
    const embeddings = await generateEmbeddingsBatch(profileTexts, 10, 500);
    logger.info(`✓ Generated ${embeddings.length} embeddings`);
    
    // Log embedding dimensions
    if (embeddings.length > 0) {
      logger.info(`  - Embedding dimensions: ${embeddings[0].length}`);
    }
    
    // Step 6: Upsert to Pinecone
    logger.info('Step 6: Upserting embeddings to Pinecone...');
    await upsertEmbeddings(participants, embeddings);
    logger.info('✓ Embeddings stored in Pinecone');
    
    // Step 7: Check final status
    logger.info('Step 7: Checking index status...');
    const status = await checkIndexStatus();
    logger.info(`✓ Index status: ${status.totalVectors} total vectors`);
    
    logger.info('=== Data Ingestion Complete ===');
    logger.info(`Successfully processed and stored ${participants.length} participants`);
    
  } catch (error) {
    logger.error('=== Data Ingestion Failed ===');
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

