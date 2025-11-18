/**
 * Service for retrieving participant data from Pinecone
 */
import { getPineconeClient, getIndexName } from '../config/pinecone.config.js';
import { logger } from '../utils/logger.js';
import { isValidEmbedding } from '../utils/similarity.js';
import type { ParticipantWithEmbedding } from '../types/matching.types.js';

/**
 * Fetch all participants from Pinecone index
 * 
 * @returns Object with students and seniors arrays
 */
export async function fetchAllParticipants(): Promise<{
  students: ParticipantWithEmbedding[];
  seniors: ParticipantWithEmbedding[];
  excluded: Array<{ id: string; reason: string }>;
}> {
  logger.info('Fetching all participants from Pinecone...');
  
  const client = getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);
  
  try {
    // Get index statistics to determine total vectors
    const stats = await index.describeIndexStats();
    const totalVectors = stats.totalRecordCount || 0;
    
    logger.info(`Total vectors in index: ${totalVectors}`);
    
    if (totalVectors === 0) {
      logger.warn('No vectors found in index');
      return { students: [], seniors: [], excluded: [] };
    }
    
    // Fetch all vectors using listPaginated
    const allParticipants: ParticipantWithEmbedding[] = [];
    const excluded: Array<{ id: string; reason: string }> = [];
    
    // Query with a dummy vector to get all results
    // We'll use namespace iteration if available, otherwise query approach
    const queryResults = await index.query({
      vector: new Array(1024).fill(0),
      topK: 10000, // Max allowed
      includeMetadata: true,
      includeValues: true,
    });
    
    logger.info(`Retrieved ${queryResults.matches.length} vectors from query`);
    
    // Process each match
    for (const match of queryResults.matches) {
      try {
        const participant = parseParticipantFromMatch(match);
        
        // Validate embedding
        if (!isValidEmbedding(participant.embedding)) {
          logger.warn(`Invalid embedding for participant ${participant.id}`);
          excluded.push({
            id: participant.id,
            reason: 'Invalid or zero embedding vector',
          });
          continue;
        }
        
        allParticipants.push(participant);
      } catch (error) {
        logger.error(`Error parsing participant ${match.id}:`, error);
        excluded.push({
          id: match.id,
          reason: error instanceof Error ? error.message : 'Parse error',
        });
      }
    }
    
    // Separate into students and seniors
    const students = allParticipants.filter(p => 
      p.type === 'young' || p.type === 'student'
    );
    const seniors = allParticipants.filter(p => 
      p.type === 'older' || p.type === 'senior' || p.type === 'teacher'
    );
    
    logger.info(`Separated participants: ${students.length} students, ${seniors.length} seniors`);
    
    if (excluded.length > 0) {
      logger.warn(`Excluded ${excluded.length} participants due to validation errors`);
    }
    
    // Validate data completeness
    validateParticipantData(students, seniors);
    
    return { students, seniors, excluded };
    
  } catch (error) {
    logger.error('Error fetching participants from Pinecone:', error);
    throw error;
  }
}

/**
 * Fetch specific participants by IDs
 * 
 * @param ids Array of participant IDs to fetch
 * @returns Array of participants
 */
export async function fetchParticipantsByIds(
  ids: string[]
): Promise<ParticipantWithEmbedding[]> {
  logger.info(`Fetching ${ids.length} specific participants...`);
  
  try {
    const client = getPineconeClient();
    const indexName = getIndexName();   
    const index = client.index(indexName);
    const participants: ParticipantWithEmbedding[] = [];
    
    // Fetch in batches (Pinecone limit is typically 1000 per request)
    const batchSize = 1000;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);      
      const fetchResult = await index.fetch(batchIds);      
      const records = (fetchResult as any).records ?? (fetchResult as any).vectors ?? {};
      
      for (const [id, record] of Object.entries(records)) {
        try {
          const participant = parseParticipantFromRecord(id, record);
          participants.push(participant);
        } catch (error) {
          logger.error(`Error parsing participant ${id}:`, error);
        }
      }
    }
    
    logger.info(`Successfully fetched ${participants.length} participants`);
    return participants;
    
  } catch (error) {
    logger.error('Error fetching participants by IDs:', error);
    throw error;
  }
}


/**
 * Parse participant data from Pinecone query match
 */
function parseParticipantFromMatch(match: any): ParticipantWithEmbedding {
  const metadata = match.metadata || {};
  
  return {
    id: match.id,
    name: metadata.name || 'Unknown',
    type: metadata.type || 'unknown',
    embedding: match.values || [],
    q1: metadata.q1 !== undefined ? Number(metadata.q1) : undefined,
    q2: metadata.q2 !== undefined ? Number(metadata.q2) : undefined,
    q3: metadata.q3 !== undefined ? Number(metadata.q3) : undefined,
    idealMatch: metadata.ideal_match,
    metadata: metadata,
  };
}

/**
 * Parse participant data from Pinecone fetch record
 */
function parseParticipantFromRecord(id: string, record: any): ParticipantWithEmbedding {
  const metadata = record.metadata || {};
  
  return {
    id: id,
    name: metadata.name || 'Unknown',
    type: metadata.type || 'unknown',
    embedding: record.values || [],
    q1: metadata.q1 !== undefined ? Number(metadata.q1) : undefined,
    q2: metadata.q2 !== undefined ? Number(metadata.q2) : undefined,
    q3: metadata.q3 !== undefined ? Number(metadata.q3) : undefined,
    idealMatch: metadata.ideal_match,
    interests: metadata.interests || [],
    metadata: metadata,
  };
}

/**
 * Validate participant data completeness and consistency
 */
function validateParticipantData(
  students: ParticipantWithEmbedding[],
  seniors: ParticipantWithEmbedding[]
): void {
  // Check for empty arrays
  if (students.length === 0) {
    logger.warn('No students found in dataset');
  }
  
  if (seniors.length === 0) {
    logger.warn('No seniors found in dataset');
  }
  
  // Check for unequal numbers
  if (students.length !== seniors.length) {
    logger.warn(
      `Unequal participant counts: ${students.length} students vs ${seniors.length} seniors`
    );
  }
  
  // Validate embedding dimensions consistency
  const allParticipants = [...students, ...seniors];
  if (allParticipants.length > 0) {
    const firstDimension = allParticipants[0].embedding.length;
    const inconsistentDimensions = allParticipants.some(
      p => p.embedding.length !== firstDimension
    );
    
    if (inconsistentDimensions) {
      logger.error('Inconsistent embedding dimensions detected across participants');
      throw new Error('Embedding dimension mismatch');
    }
    
    logger.info(`All embeddings have consistent dimensions: ${firstDimension}`);
  }
  
  // Check for missing Q scores
  const missingQScores = allParticipants.filter(
    p => p.q1 === undefined || p.q2 === undefined || p.q3 === undefined
  );
  
  if (missingQScores.length > 0) {
    logger.warn(
      `${missingQScores.length} participants have missing Q scores (will use defaults)`
    );
  }
}
