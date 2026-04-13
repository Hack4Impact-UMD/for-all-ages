export interface ParticipantWithEmbedding {
  id: string;
  name: string;
  type: 'young' | 'older' | string;
  pronouns?: string;
  embedding: number[];
  q1?: number;
  q2?: number;
  q3?: number;
  idealMatch?: string;
  metadata?: Record<string, unknown>;
}

export interface SimilarityScore {
  studentId: string;
  seniorId: string;
  frqScore: number;
  quantScore: number;
  finalScore: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Match {
  studentId: string;
  seniorId: string;
  studentName: string;
  seniorName: string;
  scores: {
    frqScore: number;
    quantScore: number;
    finalScore: number;
  };
  confidence: ConfidenceLevel;
  rank?: number;
}

export interface MatchingConfig {
  frqWeight: number;
  quantWeight: number;
  scoreRanges: Record<string, { min: number; max: number }>;
  confidenceThresholds: {
    high: number;
    medium: number;
  };
}

export interface MatchingStatistics {
  totalMatches: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  averageFrqScore: number;
  averageQuantScore: number;
  standardDeviation: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface MatchingResult {
  matches: Match[];
  statistics: MatchingStatistics;
  config: MatchingConfig;
  timestamp: Date;
  unmatchedStudents?: string[];
  unmatchedSeniors?: string[];
  excludedParticipants?: Array<{
    id: string;
    reason: string;
  }>;
}

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  frqWeight: 0.7,
  quantWeight: 0.3,
  scoreRanges: {}, // Should be hydrated dynamically from Firebase config
  confidenceThresholds: {
    high: 0.8,
    medium: 0.6,
  },
};