/**
 * Service for retrieving participant data from Pinecone
 */
import * as admin from 'firebase-admin';
import { getPineconeClient, getIndexName } from '../config/pinecone.config.js';
import { logger } from '../utils/logger.js';
import { isValidEmbedding } from '../utils/similarity.js';
import type { ParticipantWithEmbedding } from '../types/matching.types.js';

function normalizeStoredUserType(userType: unknown): 'Student' | 'Adult' | 'unknown' {
  if (typeof userType !== 'string') {
    return 'unknown';
  }

  const normalized = userType.trim().toLowerCase();
  if (normalized === 'student') {
    return 'Student';
  }
  if (normalized === 'adult') {
    return 'Adult';
  }
  return 'unknown';
}

/**
 * Fetch waitlisted participant IDs from Firebase
 * 
 * @returns Set of waitlisted participant IDs
 */
async function getWaitlistedIds(): Promise<Set<string>> {
  try {
    const db = admin.firestore();
    const waitlistSnap = await db.collection('waitlist').get();
    const waitlistedIds = new Set<string>();
    
    waitlistSnap.forEach((doc) => {
      waitlistedIds.add(doc.id);
    });
    
    logger.info(`Fetched ${waitlistedIds.size} waitlisted participant IDs from Firebase`);
    return waitlistedIds;
  } catch (error) {
    logger.error('Error fetching waitlisted IDs:', error);
    // Return empty set if fetch fails, to allow matching to continue
    return new Set();
  }
}

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
    
    // Fetch waitlisted IDs to exclude from matching
    const waitlistedIds = await getWaitlistedIds();
    
    // Process each match
    for (const match of queryResults.matches) {
      try {
        // Skip waitlisted participants
        if (waitlistedIds.has(match.id)) {
          logger.info(`Skipping waitlisted participant ${match.id}`);
          excluded.push({
            id: match.id,
            reason: 'Participant is on the waitlist',
          });
          continue;
        }
        
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
      p.user_type === 'Student'
    );
    const seniors = allParticipants.filter(p => 
      p.user_type === 'Adult'
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
 * Helper to extract dynamic numeric answers from metadata
 */
function extractNumericAnswers(metadata: Record<string, any>): Record<string, number> {
  const numericAnswers: Record<string, number> = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Collect purely numeric values (avoiding reserved keys)
    if (typeof value === 'number' && key !== 'full_text_length') {
      numericAnswers[key] = value;
    }
  }
  return numericAnswers;
}

/**
 * Parse participant data from Pinecone query match
 */
function parseParticipantFromMatch(match: any): ParticipantWithEmbedding {
  const metadata = match.metadata || {};
  
  return {
    id: match.id,
    user_type: normalizeStoredUserType(metadata.user_type),
    pronouns: metadata.pronouns || undefined,
    embedding: match.values || [],
    numericAnswers: extractNumericAnswers(metadata),
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
    user_type: normalizeStoredUserType(metadata.user_type),
    embedding: record.values || [],
    pronouns: metadata.pronouns || undefined,
    numericAnswers: extractNumericAnswers(metadata),
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
  }
  
  // Check for missing Q scores
  const missingQScores = allParticipants.filter(
    p => !p.numericAnswers || Object.keys(p.numericAnswers).length === 0
  );
  
  if (missingQScores.length > 0) {
    logger.warn(
      `${missingQScores.length} participants have no parsed numeric answers.`
    );
  }
}
