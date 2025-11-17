/**
 * Pinecone client configuration and initialization
 */
import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger.js';

let pineconeClient: Pinecone | null = null;

/**
 * Initialize Pinecone client
 */
export function initializePineconeClient(): Pinecone {
  if (pineconeClient) {
    return pineconeClient;
  }
  
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error('PINECONE_API_KEY environment variable is not set');
  }
  
  logger.info('Initializing Pinecone client...');
  
  pineconeClient = new Pinecone({
    apiKey: apiKey,
  });
  
  logger.info('Pinecone client initialized successfully');
  return pineconeClient;
}

/**
 * Get Pinecone client (initializes if not already initialized)
 */
export function getPineconeClient(): Pinecone {
  return initializePineconeClient();
}

/**
 * Get index name from environment or use default
 */
export function getIndexName(): string {
  return process.env.PINECONE_INDEX_NAME || 'tea-mate-matching';
}

