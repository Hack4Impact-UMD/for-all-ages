/**
 * Service for calculating pairwise similarity scores
 */
import { logger } from '../utils/logger.js';
import { cosineSimilarity, quantifiableScoreSimilarity, calculateFinalScore } from '../utils/similarity.js';
import type { ParticipantWithEmbedding, SimilarityScore, MatchingConfig } from '../types/matching.types.js';

/**
 * Calculate all pairwise similarity scores between students and seniors
 * 
 * @param students Array of student participants
 * @param seniors Array of senior participants
 * @param config Matching configuration
 * @returns Array of similarity scores (students.length × seniors.length)
 */
export function calculateAllPairwiseScores(
  students: ParticipantWithEmbedding[],
  seniors: ParticipantWithEmbedding[],
  config: MatchingConfig
): SimilarityScore[] {
  logger.info(`Calculating pairwise scores for ${students.length} students × ${seniors.length} seniors...`);
  
  const scores: SimilarityScore[] = [];
  let calculatedCount = 0;
  const totalPairs = students.length * seniors.length;
  
  // Nested loop: for each student, calculate score with each senior
  for (const student of students) {
    for (const senior of seniors) {
      try {
        // Calculate FRQ score (embedding similarity)
        const frqScore = cosineSimilarity(student.embedding, senior.embedding);
        
        // Calculate quantifiable score (Q1, Q2, Q3 similarity)
        const quantScore = quantifiableScoreSimilarity(
          { q1: student.q1, q2: student.q2, q3: student.q3 },
          { q1: senior.q1, q2: senior.q2, q3: senior.q3 },
          config
        );
        
        // Calculate final weighted score
        const finalScore = calculateFinalScore(frqScore, quantScore, config);
        
        scores.push({
          studentId: student.id,
          seniorId: senior.id,
          frqScore,
          quantScore,
          finalScore,
        });
        
        calculatedCount++;
        
        // Log progress for large datasets
        if (calculatedCount % 1000 === 0) {
          const progress = ((calculatedCount / totalPairs) * 100).toFixed(1);
          logger.info(`Progress: ${calculatedCount}/${totalPairs} (${progress}%)`);
        }
      } catch (error) {
        logger.error(
          `Error calculating score for ${student.id} - ${senior.id}:`,
          error instanceof Error ? error.message : String(error)
        );
        // Continue with other pairs even if one fails
      }
    }
  }
  
  logger.info(`Successfully calculated ${scores.length} pairwise scores`);
  
  // Log score statistics
  if (scores.length > 0) {
    const avgFrq = scores.reduce((sum, s) => sum + s.frqScore, 0) / scores.length;
    const avgQuant = scores.reduce((sum, s) => sum + s.quantScore, 0) / scores.length;
    const avgFinal = scores.reduce((sum, s) => sum + s.finalScore, 0) / scores.length;
    
    logger.info(`Score averages: FRQ=${avgFrq.toFixed(3)}, Quant=${avgQuant.toFixed(3)}, Final=${avgFinal.toFixed(3)}`);
  }
  
  return scores;
}

/**
 * Create score matrix (2D array) from score array
 * Useful for visualization and certain algorithms
 * 
 * @param scores Array of similarity scores
 * @param students Array of students
 * @param seniors Array of seniors
 * @returns 2D matrix where matrix[i][j] = score for student_i and senior_j
 */
export function createScoreMatrix(
  scores: SimilarityScore[],
  students: ParticipantWithEmbedding[],
  seniors: ParticipantWithEmbedding[]
): SimilarityScore[][] {
  logger.info('Creating score matrix...');
  
  // Create index mappings
  const studentIndexMap = new Map(students.map((s, idx) => [s.id, idx]));
  const seniorIndexMap = new Map(seniors.map((s, idx) => [s.id, idx]));
  
  // Initialize matrix
  const matrix: SimilarityScore[][] = Array(students.length)
    .fill(null)
    .map(() => Array(seniors.length).fill(null));
  
  // Fill matrix
  for (const score of scores) {
    const studentIdx = studentIndexMap.get(score.studentId);
    const seniorIdx = seniorIndexMap.get(score.seniorId);
    
    if (studentIdx !== undefined && seniorIdx !== undefined) {
      matrix[studentIdx][seniorIdx] = score;
    }
  }
  
  logger.info(`Created ${students.length}×${seniors.length} score matrix`);
  
  return matrix;
}

/**
 * Get top N matches for a specific participant
 * 
 * @param participantId ID of the participant
 * @param scores Array of all similarity scores
 * @param topN Number of top matches to return
 * @param isStudent Whether the participant is a student
 * @returns Top N scores sorted by finalScore
 */
export function getTopMatchesForParticipant(
  participantId: string,
  scores: SimilarityScore[],
  topN: number = 5,
  isStudent: boolean = true
): SimilarityScore[] {
  const relevantScores = scores.filter(score =>
    isStudent ? score.studentId === participantId : score.seniorId === participantId
  );
  
  return relevantScores
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topN);
}
