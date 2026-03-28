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
  
  const client = await getPineconeClient();
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
    allParticipants.forEach((p)=>{
      console.log(p)
    })
    const students = allParticipants.filter(p => 
      p.user_type === 'student'
    );
    const seniors = allParticipants.filter(p => 
      p.user_type === 'adult'
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
  
  const client = await getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);
  
  try {
    const participants: ParticipantWithEmbedding[] = [];
    
    // Fetch in batches (Pinecone limit is typically 1000 per request)
    const batchSize = 1000;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      
      const fetchResult = await index.fetch(batchIds);
      
      for (const [id, record] of Object.entries(fetchResult.records)) {
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

  const numericResponses: number[] = Object.keys(metadata)
    .filter(key => key.startsWith('q_'))
    .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
    .map(key => Number(metadata[key]));
  
  return {
    id: match.id,
    user_type: metadata.user_type || 'unknown',
    embedding: match.values || [],
    numericResponses,
    metadata: metadata,
  };
}

/**
 * Parse participant data from Pinecone fetch record
 */
function parseParticipantFromRecord(id: string, record: any): ParticipantWithEmbedding {
  const metadata = record.metadata || {};
  
  const numericResponses: number[] = Object.keys(metadata)
    .filter(key => /^q_\d+$/.test(key)) 
    .sort((a, b) => {
      const indexA = parseInt(a.split('_')[1], 10);
      const indexB = parseInt(b.split('_')[1], 10);
      return indexA - indexB;
    })
    .map(key => Number(metadata[key]));

  return {
    id: record.id,
    user_type: metadata.user_type || 'unknown',
    embedding: record.values || [],
    numericResponses, // Extracted dynamic array
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
  if (allParticipants.length === 0) return;

  // 1. Validate embedding dimensions consistency
  const expectedDim = allParticipants[0].embedding.length;
  const hasInconsistentEmbeddings = allParticipants.some(
    p => p.embedding.length !== expectedDim
  );
  
  if (hasInconsistentEmbeddings) {
    logger.error('Inconsistent embedding dimensions detected');
    throw new Error('Embedding dimension mismatch across participant records');
  }

  // 2. Validate numeric response consistency
  // We check if all users have the same number of answers. 
  // If not, the similarity algorithm will handle it, but we log it here.
  const expectedNumericCount = allParticipants[0].numericResponses.length;
  const inconsistentUsers = allParticipants.filter(
    p => p.numericResponses.length !== expectedNumericCount
  );

  if (inconsistentUsers.length > 0) {
    logger.warn(
      `${inconsistentUsers.length} participants have a different number of responses than the baseline (${expectedNumericCount}). ` +
      `Matching will proceed using the overlapping indices.`
    );
  } else {
    logger.info(`All participants have a consistent set of ${expectedNumericCount} numeric responses.`);
  }
}
