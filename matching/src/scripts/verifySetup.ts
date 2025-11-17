/**
 * Verification script to test Pinecone embeddings and Pinecone connectivity
 */
import 'dotenv/config';
import { generateEmbedding } from '../services/embeddingService.js';
import { getPineconeClient, getIndexName } from '../config/pinecone.config.js';
import { initializeIndex, checkIndexStatus } from '../services/vectorService.js';
import { logger } from '../utils/logger.js';

/**
 * Test Pinecone Inference connection and embedding generation
 */
async function testEmbeddings(): Promise<boolean> {
  try {
    logger.info('\n=== Testing Pinecone Inference (Embeddings) ===');
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      logger.error('❌ PINECONE_API_KEY not set in environment');
      return false;
    }
    logger.info('✓ PINECONE_API_KEY is set');
    logger.info('  Testing embedding generation via Pinecone Inference...');
    const testText = 'This is a test text for embedding generation.';
    
    try {
      const embedding = await generateEmbedding(testText);
      
      if (embedding && embedding.length > 0) {
        logger.info(`✓ Successfully generated embedding`);
        logger.info(`  - Dimensions: ${embedding.length}`);
        logger.info(`  - First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
        return true;
      } else {
        logger.error('❌ Generated embedding is empty');
        return false;
      }
    } catch (error) {
      logger.error(`❌ Failed to generate embedding via Pinecone: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
    
  } catch (error) {
    logger.error(`❌ Embeddings test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Test Pinecone connection and index access
 */
async function testPinecone(): Promise<boolean> {
  try {
    logger.info('\n=== Testing Pinecone ===');
    
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      logger.error('❌ PINECONE_API_KEY not set in environment');
      return false;
    }
    
    logger.info('✓ PINECONE_API_KEY is set');
    
    const indexName = getIndexName();
    logger.info(`  Target index: ${indexName}`);
    
    logger.info('  Initializing Pinecone client...');
    try {
      const client = getPineconeClient();
      logger.info('✓ Pinecone client initialized');
      
      logger.info('  Listing available indexes...');
      const indexes = await client.listIndexes();
      logger.info(`✓ Found ${indexes.indexes?.length || 0} index(es)`);
      
      if (indexes.indexes && indexes.indexes.length > 0) {
        logger.info('  Available indexes:');
        indexes.indexes.forEach(idx => {
          logger.info(`    - ${idx.name} (dimensions: ${idx.dimension}, metric: ${idx.metric})`);
        });
      }
      
      // Check if target index exists
      const indexExists = indexes.indexes?.some(idx => idx.name === indexName);
      
      if (!indexExists) {
        logger.warn(`⚠️  Index '${indexName}' does not exist`);
        logger.info('  Attempting to create index...');
        try {
          await initializeIndex();
          logger.info(`✓ Index '${indexName}' created successfully`);
        } catch (error) {
          logger.error(`❌ Failed to create index: ${error instanceof Error ? error.message : String(error)}`);
          return false;
        }
      } else {
        logger.info(`✓ Index '${indexName}' exists`);
      }
      
      // Check index status
      logger.info('  Checking index status...');
      const status = await checkIndexStatus();
      logger.info(`✓ Index is ready`);
      logger.info(`  - Total vectors: ${status.totalVectors}`);
      logger.info(`  - Dimensions: ${status.dimension}`);
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Pinecone connection failed: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.message.includes('401')) {
        logger.error('   This usually means the API key is invalid or unauthorized');
      }
      return false;
    }
    
  } catch (error) {
    logger.error(`❌ Pinecone test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main verification function
 */
async function verifySetup(): Promise<void> {
  logger.info('========================================');
  logger.info('Tea @ 3 Matching Service - Setup Verification');
  logger.info('========================================');
  
  // Check environment variables
  logger.info('\n=== Environment Variables ===');
  const envVars = {
    'PINECONE_API_KEY': process.env.PINECONE_API_KEY ? '✓ Set' : '❌ Missing',
    'PINECONE_INDEX_NAME': process.env.PINECONE_INDEX_NAME || 'tea-mate-matching (default)',
    'PINECONE_ENVIRONMENT': process.env.PINECONE_ENVIRONMENT || 'us-east-1 (default)',
    'LOG_LEVEL': process.env.LOG_LEVEL || 'info (default)',
  };
  
  Object.entries(envVars).forEach(([key, value]) => {
    logger.info(`  ${key}: ${value}`);
  });
  
  // Test Embeddings
  const embeddingsOk = await testEmbeddings();
  
  // Test Pinecone
  const pineconeOk = await testPinecone();
  
  // Summary
  logger.info('\n========================================');
  logger.info('Verification Summary');
  logger.info('========================================');
  logger.info(`Embeddings API: ${embeddingsOk ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Pinecone DB:    ${pineconeOk ? '✅ PASS' : '❌ FAIL'}`);
  logger.info('========================================');
  
  if (embeddingsOk && pineconeOk) {
    logger.info('\n✅ All systems ready! You can proceed with data ingestion.');
    process.exit(0);
  } else {
    logger.error('\n❌ Some systems failed verification. Please check the errors above.');
    process.exit(1);
  }
}

// Run verification
verifySetup().catch(error => {
  logger.error('Fatal error during verification:', error);
  process.exit(1);
});

