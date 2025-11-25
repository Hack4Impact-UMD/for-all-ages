/**
 * Pinecone client configuration and initialization
 */
import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger.js';
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

let pineconeClient: Pinecone | null = null;
const secretClient = new SecretManagerServiceClient();

/**
 * Initialize Pinecone client
 */
export async function initializePineconeClient(): Promise<Pinecone> {
  if (pineconeClient) {
    return pineconeClient;
  }
  
  const name = `projects/for-all-ages-8a4e2/secrets/pinecone_api_key/versions/latest`;
  const [version] = await secretClient.accessSecretVersion({ name });
  const apiKey = version.payload?.data?.toString();
  
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
export function getPineconeClient(): Promise<Pinecone> {
  return initializePineconeClient();
}

/**
 * Get index name from environment or use default
 */
export function getIndexName(): string {
  return process.env.PINECONE_INDEX_NAME || 'matches-v1';
}

