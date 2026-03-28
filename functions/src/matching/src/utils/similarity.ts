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
  responses1: number[],
  responses2: number[],
  config: MatchingConfig
): number {
  const { scoreRanges } = config;

  const numQuestions = Math.min(responses1.length, responses2.length, scoreRanges.length);

  if (numQuestions === 0) {
    return 0.5;
  }

  let totalSSD = 0;
  let totalMaxSSD = 0;

  for (let i = 0; i < numQuestions; i++) {
    const range = scoreRanges[i];
    const val1 = clamp(responses1[i], range.min, range.max);
    const val2 = clamp(responses2[i], range.min, range.max);
    
    const diff = val1 - val2;
    const maxDiff = range.max - range.min;

    totalSSD += (diff * diff);
    totalMaxSSD += (maxDiff * maxDiff);
  }

  if (totalMaxSSD === 0) {
    return 1;
  }

  const similarity = 1 - (totalSSD / totalMaxSSD);

  return Math.max(0, Math.min(1, similarity));
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
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
