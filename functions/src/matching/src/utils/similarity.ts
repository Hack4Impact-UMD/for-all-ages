/**
 * Similarity calculation utilities for matching algorithm
 */
import { logger } from './logger.js';
import type { MatchingConfig } from '../types/matching.types.js';

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns a value between -1 and 1 (typically 0 to 1 for text embeddings)
 * 
 * @param vector1 First embedding vector
 * @param vector2 Second embedding vector
 * @returns Cosine similarity score [0-1]
 */
export function cosineSimilarity(vector1: number[], vector2: number[]): number {
  // Validate inputs
  if (!vector1 || !vector2) {
    throw new Error('Both vectors must be provided');
  }
  
  if (vector1.length !== vector2.length) {
    throw new Error(`Vector dimension mismatch: ${vector1.length} vs ${vector2.length}`);
  }
  
  if (vector1.length === 0) {
    throw new Error('Vectors cannot be empty');
  }
  
  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
  }
  
  // Calculate magnitudes
  let magnitude1 = 0;
  let magnitude2 = 0;
  for (let i = 0; i < vector1.length; i++) {
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  // Handle zero vectors
  if (magnitude1 === 0 || magnitude2 === 0) {
    logger.warn('Zero vector detected in cosine similarity calculation');
    return 0;
  }
  
  // Calculate cosine similarity
  const similarity = dotProduct / (magnitude1 * magnitude2);
  
  // Clamp to [0, 1] range (in case of floating point errors)
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Calculate quantifiable score similarity based on Q1, Q2, Q3
 * Uses Sum of Squared Differences (SSD) normalized to [0-1]
 * 
 * @param scores1 First participant's scores {q1, q2, q3}
 * @param scores2 Second participant's scores {q1, q2, q3}
 * @param config Matching configuration with score ranges
 * @returns Similarity score [0-1] where 1 = identical, 0 = maximally different
 */
export function quantifiableScoreSimilarity(
  scores1: Record<string, number> = {},
  scores2: Record<string, number> = {},
  config: MatchingConfig
): number {
  const { scoreRanges } = config;
  
  let totalSimilarity = 0;
  let sharedQuestions = 0;

  for (const questionId in scores1) {
    // Only score overlapping numeric questions that are configured
    if (questionId in scores2 && scoreRanges[questionId]) {
      const a = scores1[questionId];
      const b = scores2[questionId];
      const { min, max } = scoreRanges[questionId];
      
      const range = max - min;
      if (range > 0) {
        // similarity_q = 1 - |a - b| / (max_q - min_q)
        const similarity = 1 - (Math.abs(a - b) / range);
        // Clamp between 0 and 1 in case of unexpected values outside ranges
        totalSimilarity += Math.max(0, Math.min(1, similarity));
      } else {
        // Fallback if max == min
        totalSimilarity += (a === b ? 1 : 0);
      }
      
      sharedQuestions++;
    }
  }

  // If there are no overlapping questions, default to 0 similarity
  if (sharedQuestions === 0) {
    return 0;
  }

  // Calculate the final average across shared numeric questions
  return totalSimilarity / sharedQuestions;
}

/**
 * Calculate final weighted score combining FRQ and quantifiable scores
 * 
 * @param frqScore Free-response similarity score [0-1]
 * @param quantScore Quantifiable similarity score [0-1]
 * @param config Matching configuration with weights
 * @returns Final weighted score [0-1]
 */
export function calculateFinalScore(
  frqScore: number,
  quantScore: number,
  config: MatchingConfig
): number {
  const { frqWeight, quantWeight } = config;
  
  // Validate weights sum to 1
  const totalWeight = frqWeight + quantWeight;
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    logger.warn(`Weights do not sum to 1.0: frqWeight=${frqWeight}, quantWeight=${quantWeight}`);
  }
  
  // Calculate weighted score
  const finalScore = (frqWeight * frqScore) + (quantWeight * quantScore);
  
  return Math.max(0, Math.min(1, finalScore));
}

/**
 * Determine confidence level based on final score
 * 
 * @param finalScore Final weighted score [0-1]
 * @param config Matching configuration with thresholds
 * @returns Confidence level
 */
export function determineConfidence(
  finalScore: number,
  config: MatchingConfig
): 'high' | 'medium' | 'low' {
  const { confidenceThresholds } = config;
  
  if (finalScore > confidenceThresholds.high) {
    return 'high';
  } else if (finalScore > confidenceThresholds.medium) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Validate that an embedding vector is valid (not all zeros, correct dimensions)
 * 
 * @param embedding Embedding vector to validate
 * @param expectedDimensions Expected number of dimensions
 * @returns true if valid, false otherwise
 */
export function isValidEmbedding(
  embedding: number[],
  expectedDimensions: number = 1024
): boolean {
  if (!embedding || !Array.isArray(embedding)) {
    return false;
  }
  
  if (embedding.length !== expectedDimensions) {
    return false;
  }
  
  // Check if all zeros
  const isAllZeros = embedding.every(val => val === 0);
  if (isAllZeros) {
    return false;
  }
  
  // Check for NaN or Infinity
  const hasInvalidValues = embedding.some(val => !isFinite(val));
  if (hasInvalidValues) {
    return false;
  }
  
  return true;
}
