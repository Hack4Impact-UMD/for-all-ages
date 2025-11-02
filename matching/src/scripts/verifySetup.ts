/**
 * Verification script to test Gemini embeddings and Pinecone connectivity
 */
import 'dotenv/config';
import { initializeGeminiClient, generateEmbedding } from '../services/embeddingService.js';
import { getPineconeClient, getIndexName } from '../config/pinecone.config.js';
import { initializeIndex, checkIndexStatus } from '../services/vectorService.js';
import { logger } from '../utils/logger.js';

/**
 * Test Gemini API connection and embedding generation
 */
async function testGemini(): Promise<boolean> {
  try {
    logger.info('\n=== Testing Gemini API ===');
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error('❌ GEMINI_API_KEY not set in environment');
      return false;
    }
    
    // Check if key looks valid (Gemini keys usually don't start with 'pcsk')
    if (apiKey.startsWith('pcsk_')) {
      logger.warn('⚠️  WARNING: Gemini API key appears to be a Pinecone key format!');
      logger.warn('   Gemini keys usually look different. Please verify you have the correct key.');
    }
    
    logger.info('✓ GEMINI_API_KEY is set');
    logger.info('  Attempting to initialize Gemini client...');
    
    try {
      initializeGeminiClient();
      logger.info('✓ Gemini client initialized');
    } catch (error) {
      logger.error(`❌ Failed to initialize Gemini client: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
    
    logger.info('  Testing embedding generation...');
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
      logger.error(`❌ Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.message.includes('401')) {
        logger.error('   This usually means the API key is invalid or unauthorized');
      } else if (error instanceof Error && error.message.includes('404')) {
        logger.error('   This might mean the embedding model endpoint has changed');
      }
      return false;
    }
    
  } catch (error) {
    logger.error(`❌ Gemini test failed: ${error instanceof Error ? error.message : String(error)}`);
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
    'PINECONE_ENVIRONMENT': process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws (default)',
    'GEMINI_API_KEY': process.env.GEMINI_API_KEY ? '✓ Set' : '❌ Missing',
    'LOG_LEVEL': process.env.LOG_LEVEL || 'info (default)',
  };
  
  Object.entries(envVars).forEach(([key, value]) => {
    logger.info(`  ${key}: ${value}`);
  });
  
  // Test Gemini
  const geminiOk = await testGemini();
  
  // Test Pinecone
  const pineconeOk = await testPinecone();
  
  // Summary
  logger.info('\n========================================');
  logger.info('Verification Summary');
  logger.info('========================================');
  logger.info(`Gemini API:     ${geminiOk ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Pinecone DB:    ${pineconeOk ? '✅ PASS' : '❌ FAIL'}`);
  logger.info('========================================');
  
  if (geminiOk && pineconeOk) {
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

