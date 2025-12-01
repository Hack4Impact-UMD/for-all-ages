import { logger } from '../utils/logger.js';
import { fetchParticipantsByIds } from './participantRetrieval.js';
import {
  cosineSimilarity,
  quantifiableScoreSimilarity,
  calculateFinalScore,
  determineConfidence,
} from '../utils/similarity.js';
import { DEFAULT_MATCHING_CONFIG } from '../types/matching.types.js';
import type { MatchingConfig } from '../types/matching.types.js';

export interface CalculateMatchResult {
  uid1: string;
  uid2: string;
  frqScore: number;
  quantScore: number;
  finalScore: number;
  finalPercentage: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Compute match score for two participants stored in Pinecone.
 * Expects the Pinecone record ids to match the provided uids.
 */
export async function computeMatchScore(
  uid1: string,
  uid2: string,
  config?: Partial<MatchingConfig>
): Promise<CalculateMatchResult> {
  const cfg = { ...DEFAULT_MATCHING_CONFIG, ...(config ?? {}) } as MatchingConfig;

  logger.info(`Computing match score for ${uid1} vs ${uid2}`);

  // Fetch participants from Pinecone
  const participants = await fetchParticipantsByIds([uid1, uid2]);

  if (!participants || participants.length < 2) {
    throw new Error('One or both participants not found in Pinecone');
  }

  const map: Record<string, any> = {};
  participants.forEach((p: any) => {
    // If record id is stored under a different key, adjust here.
    map[p.id] = p;
  });

  const a = map[uid1];
  const b = map[uid2];

  if (!a || !b) {
    throw new Error('One or both participants not found in Pinecone');
  }

  // Compute FRQ (embedding cosine similarity)
  let frqScore = 0;
  try {
    frqScore = cosineSimilarity(a.embedding ?? [], b.embedding ?? []);
  } catch (err) {
    logger.warn('Cosine similarity failed, defaulting frqScore to 0', err);
    frqScore = 0;
  }

  // Compute quantifiable score (SSD normalized)
  const quantScore = quantifiableScoreSimilarity(
    { q1: a.q1, q2: a.q2, q3: a.q3 },
    { q1: b.q1, q2: b.q2, q3: b.q3 },
    cfg
  );

  // Final weighted score
  const finalScore = calculateFinalScore(frqScore, quantScore, cfg);
  const confidence = determineConfidence(finalScore, cfg);

  return {
    uid1,
    uid2,
    frqScore,
    quantScore,
    finalScore,
    finalPercentage: Math.round(finalScore * 100),
    confidence,
  };
}

export default computeMatchScore;