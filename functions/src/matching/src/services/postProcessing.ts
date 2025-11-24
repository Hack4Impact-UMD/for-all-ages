/**
 * Post-processing service for match results
 * Handles sorting, enrichment, and statistics calculation
 */
import { logger } from '../utils/logger.js';
import { determineConfidence } from '../utils/similarity.js';
import type { Match, MatchingStatistics, MatchingConfig } from '../types/matching.types.js';

/**
 * Sort matches by final score (descending)
 * 
 * @param matches Array of matches
 * @returns Sorted array of matches
 */
export function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => b.scores.finalScore - a.scores.finalScore);
}

/**
 * Add metadata to matches (confidence levels and ranks)
 * 
 * @param matches Array of matches
 * @param config Matching configuration
 * @returns Enriched matches with confidence and rank
 */
export function enrichMatches(matches: Match[], config: MatchingConfig): Match[] {
  logger.info('Enriching matches with metadata...');
  
  // Sort first to assign ranks
  const sortedMatches = sortMatches(matches);
  
  // Add confidence levels and ranks
  const enrichedMatches = sortedMatches.map((match, index) => ({
    ...match,
    confidence: determineConfidence(match.scores.finalScore, config),
    rank: index + 1,
  }));
  
  // Log confidence distribution
  const highCount = enrichedMatches.filter(m => m.confidence === 'high').length;
  const mediumCount = enrichedMatches.filter(m => m.confidence === 'medium').length;
  const lowCount = enrichedMatches.filter(m => m.confidence === 'low').length;
  
  logger.info(`Confidence distribution: High=${highCount}, Medium=${mediumCount}, Low=${lowCount}`);
  
  return enrichedMatches;
}

/**
 * Calculate statistics for matching results
 * 
 * @param matches Array of matches
 * @returns Statistics object
 */
export function calculateStatistics(matches: Match[]): MatchingStatistics {
  logger.info('Calculating match statistics...');
  
  if (matches.length === 0) {
    return {
      totalMatches: 0,
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      averageFrqScore: 0,
      averageQuantScore: 0,
      standardDeviation: 0,
      confidenceDistribution: {
        high: 0,
        medium: 0,
        low: 0,
      },
    };
  }
  
  // Calculate basic statistics
  const finalScores = matches.map(m => m.scores.finalScore);
  const frqScores = matches.map(m => m.scores.frqScore);
  const quantScores = matches.map(m => m.scores.quantScore);
  
  const averageScore = finalScores.reduce((sum, s) => sum + s, 0) / finalScores.length;
  const minScore = Math.min(...finalScores);
  const maxScore = Math.max(...finalScores);
  
  const averageFrqScore = frqScores.reduce((sum, s) => sum + s, 0) / frqScores.length;
  const averageQuantScore = quantScores.reduce((sum, s) => sum + s, 0) / quantScores.length;
  
  // Calculate standard deviation
  const squaredDiffs = finalScores.map(score => Math.pow(score - averageScore, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / finalScores.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Calculate confidence distribution
  const highCount = matches.filter(m => m.confidence === 'high').length;
  const mediumCount = matches.filter(m => m.confidence === 'medium').length;
  const lowCount = matches.filter(m => m.confidence === 'low').length;
  
  const statistics: MatchingStatistics = {
    totalMatches: matches.length,
    averageScore: Number(averageScore.toFixed(4)),
    minScore: Number(minScore.toFixed(4)),
    maxScore: Number(maxScore.toFixed(4)),
    averageFrqScore: Number(averageFrqScore.toFixed(4)),
    averageQuantScore: Number(averageQuantScore.toFixed(4)),
    standardDeviation: Number(standardDeviation.toFixed(4)),
    confidenceDistribution: {
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
  };
  
  // Log statistics
  logger.info('Match Statistics:');
  logger.info(`  Total Matches: ${statistics.totalMatches}`);
  logger.info(`  Average Score: ${statistics.averageScore}`);
  logger.info(`  Score Range: ${statistics.minScore} - ${statistics.maxScore}`);
  logger.info(`  Std Deviation: ${statistics.standardDeviation}`);
  logger.info(`  Avg FRQ Score: ${statistics.averageFrqScore}`);
  logger.info(`  Avg Quant Score: ${statistics.averageQuantScore}`);
  
  return statistics;
}

/**
 * Format match for display/export
 * 
 * @param match Match object
 * @returns Formatted string
 */
export function formatMatch(match: Match): string {
  return [
    `Match #${match.rank || '?'}:`,
    `  Student: ${match.studentName} (${match.studentId})`,
    `  Senior: ${match.seniorName} (${match.seniorId})`,
    `  Final Score: ${match.scores.finalScore.toFixed(4)}`,
    `  FRQ Score: ${match.scores.frqScore.toFixed(4)}`,
    `  Quant Score: ${match.scores.quantScore.toFixed(4)}`,
    `  Confidence: ${match.confidence.toUpperCase()}`,
  ].join('\n');
}

/**
 * Export matches to CSV format
 * 
 * @param matches Array of matches
 * @returns CSV string
 */
export function exportMatchesToCSV(matches: Match[]): string {
  const headers = [
    'Rank',
    'Student ID',
    'Student Name',
    'Senior ID',
    'Senior Name',
    'Final Score',
    'FRQ Score',
    'Quant Score',
    'Confidence',
  ];
  
  const rows = matches.map(match => [
    match.rank || '',
    match.studentId,
    match.studentName,
    match.seniorId,
    match.seniorName,
    match.scores.finalScore.toFixed(4),
    match.scores.frqScore.toFixed(4),
    match.scores.quantScore.toFixed(4),
    match.confidence,
  ]);
  
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ];
  
  return csvLines.join('\n');
}

/**
 * Generate summary report
 * 
 * @param matches Array of matches
 * @param statistics Statistics object
 * @param config Matching configuration
 * @returns Formatted report string
 */
export function generateSummaryReport(
  matches: Match[],
  statistics: MatchingStatistics,
  config: MatchingConfig
): string {
  const lines = [
    '='.repeat(60),
    'MATCHING RESULTS SUMMARY',
    '='.repeat(60),
    '',
    'Configuration:',
    `  FRQ Weight: ${config.frqWeight}`,
    `  Quant Weight: ${config.quantWeight}`,
    '',
    'Statistics:',
    `  Total Matches: ${statistics.totalMatches}`,
    `  Average Score: ${statistics.averageScore}`,
    `  Score Range: ${statistics.minScore} - ${statistics.maxScore}`,
    `  Standard Deviation: ${statistics.standardDeviation}`,
    `  Average FRQ Score: ${statistics.averageFrqScore}`,
    `  Average Quant Score: ${statistics.averageQuantScore}`,
    '',
    'Confidence Distribution:',
    `  High Confidence: ${statistics.confidenceDistribution.high} matches`,
    `  Medium Confidence: ${statistics.confidenceDistribution.medium} matches`,
    `  Low Confidence: ${statistics.confidenceDistribution.low} matches`,
    '',
    '='.repeat(60),
    '',
  ];
  
  return lines.join('\n');
}
