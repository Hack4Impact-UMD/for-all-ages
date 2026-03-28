export interface ParticipantWithEmbedding {
  id: string;
  user_type: 'student' | 'adult' | string;
  embedding: number[];
  numericResponses: number[];
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
  scoreRanges: Array<{
    min: number;
    max: number;
  }>;
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
  scoreRanges: [{ min: 1, max: 5 }, { min: 1, max: 5 }, { min: 1, max: 5 }],
  confidenceThresholds: {
    high: 0.8,
    medium: 0.6,
  },
};
