/**
 * Pinecone vector database operations
 */
import { getPineconeClient, getIndexName } from '../config/pinecone.config.js';
import { logger } from '../utils/logger.js';
import type { ParticipantData } from '../utils/validator.js';

const EMBEDDING_DIMENSIONS = 1024; // llama-text-embed-v2 default dimensions
const BATCH_SIZE = 100; // Pinecone's max batch size

/**
 * Initialize or retrieve Pinecone index
 */
export async function initializeIndex(): Promise<void> {
  const client = getPineconeClient();
  const indexName = getIndexName();
  
  logger.info(`Checking Pinecone index: ${indexName}`);
  
  try {
    const indexes = await client.listIndexes();
    const indexExists = indexes.indexes?.some(idx => idx.name === indexName);
    
    if (indexExists) {
      logger.info(`Index ${indexName} already exists`);
      return;
    }
    
    logger.info(`Creating index ${indexName} with ${EMBEDDING_DIMENSIONS} dimensions...`);
    
    let region = process.env.PINECONE_ENVIRONMENT || 'us-east-1';
    region = region.replace('-aws', '').replace('-gcp', '').replace('-azure', '');
    
    logger.info(`Creating index with region: ${region}`);
    
    await client.createIndex({
      name: indexName,
      dimension: EMBEDDING_DIMENSIONS,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: region,
        },
      },
    });
    
    logger.info(`Index ${indexName} created successfully`);
    await waitForIndexReady(indexName);
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Error initializing index: ${errorMsg}`);
    
    if (errorMsg.includes('404')) {
      logger.error('');
      logger.error('⚠️  Possible causes:');
      logger.error('  1. Region mismatch - check PINECONE_ENVIRONMENT matches your account region');
      logger.error('  2. Account limitations - free tier may have restrictions');
      logger.error('  3. Try creating the index manually in Pinecone dashboard first');
      logger.error('  4. Check your Pinecone dashboard: https://app.pinecone.io/');
    }
    
    throw error;
  }
}

/**
 * Wait for index to be ready
 */
async function waitForIndexReady(indexName: string, maxWaitMs: number = 60000): Promise<void> {
  const client = getPineconeClient();
  const startTime = Date.now();
  
  logger.info(`Waiting for index ${indexName} to be ready...`);
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const index = client.index(indexName);
      const stats = await index.describeIndexStats();
      
      if (stats) {
        logger.info(`Index ${indexName} is ready`);
        return;
      }
    } catch (error) {
      logger.debug(`Index not ready yet, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error(`Timeout waiting for index ${indexName} to be ready`);
}

/**
 * Upsert participant embeddings to Pinecone
 */
export async function upsertEmbeddings(
  participants: ParticipantData[],
  embeddings: number[][]
): Promise<void> {
  if (participants.length !== embeddings.length) {
    throw new Error(`Mismatch: ${participants.length} participants but ${embeddings.length} embeddings`);
  }
  
  const client = getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);
  
  logger.info(`Upserting ${participants.length} embeddings to index ${indexName}`);
  
  for (let i = 0; i < participants.length; i += BATCH_SIZE) {
    const batch = participants.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);
    
    logger.info(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(participants.length / BATCH_SIZE)}`);
    
    const vectors = batch.map((participant, idx) => {
      const metadata: Record<string, string | number> = {
        // name: participant.name,
        type: participant.type,
        // participant_id: participant.participantId,
      };
      
      // // Add new format fields
      // if (participant.freeResponse) {
      //   metadata.free_response = participant.freeResponse.substring(0, 200);
      // }
      if (participant.q1 !== undefined) {
        metadata.q1 = participant.q1;
      }
      if (participant.q2 !== undefined) {
        metadata.q2 = participant.q2;
      }
      if (participant.q3 !== undefined) {
        metadata.q3 = participant.q3;
      }
      // if (participant.idealMatch) {
      //   metadata.ideal_match = participant.idealMatch;
      // }
      
      // Add legacy format fields (for backward compatibility)
      if (participant.email) {
        metadata.email = participant.email;
      }
      if (participant.interests) {
        metadata.interests_summary = participant.interests.substring(0, 100);
      }
      
      return {
        id: participant.participantId,
        values: batchEmbeddings[idx],
        metadata: metadata,
      };
    });
    
    try {
      await index.upsert(vectors);
      logger.info(`Successfully upserted batch of ${batch.length} vectors`);
    } catch (error) {
      logger.error(`Error upserting batch: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  logger.info(`Successfully upserted all ${participants.length} embeddings`);
}

/**
 * Check index status
 */
export async function checkIndexStatus(): Promise<{
  totalVectors: number;
  dimension: number;
  indexFull: boolean;
}> {
  const client = getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);
  
  try {
    const stats = await index.describeIndexStats();
    
    return {
      totalVectors: stats.totalRecordCount || 0,
      dimension: EMBEDDING_DIMENSIONS,
      indexFull: false, // Would need to check index capacity
    };
  } catch (error) {
    logger.error(`Error checking index status: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}