import { logger } from '../utils/logger.js';
import { fetchAllParticipants } from './participantRetrieval.js';
import { calculateAllPairwiseScores } from './scoreCalculation.js';
import { hungarianMatching, getUnmatchedParticipants } from '../algorithms/hungarianMatching.js';
import { enrichMatches, calculateStatistics } from './postProcessing.js';
import { loadCohortProfiles } from './pastPartners.js';
import { buildPastPairSet, removePastPairs } from '../utils/pastPairs.js';
import type { MatchingConfig, MatchingResult } from '../types/matching.types.js';
import { DEFAULT_MATCHING_CONFIG } from '../types/matching.types.js';

export class MatchingInputError extends Error {}

export class MatchingService {
  private config: MatchingConfig;

  constructor(config?: Partial<MatchingConfig>) {
    this.config = {
      ...DEFAULT_MATCHING_CONFIG,
      ...config,
    };

    // Validate configuration
    this.validateConfig();
  }

  /**
   * @param excludeIds Participants to leave out of this run (e.g. people who
   *   already have a manually approved match that must be kept).
   */
  async runMatching(excludeIds: string[] = []): Promise<MatchingResult> {
    const startTime = Date.now();
    logger.info('='.repeat(60));
    logger.info('STARTING MATCHING PIPELINE');
    logger.info('='.repeat(60));

    try {
      logger.info('\n[Phase 1] Configuration');
      logger.info(`  Weights: FRQ=${this.config.frqWeight}, Quant=${this.config.quantWeight}`);

      logger.info('\n[Phase 2] Data Retrieval');
      const fetched = await fetchAllParticipants();
      const excludeSet = new Set(excludeIds);
      const { excluded } = fetched;
      if (excludeSet.size > 0) {
        logger.info(`  Excluding ${excludeSet.size} already-matched participants`);
      }

      // Pinecone has no pastPartners, and a vector can outlive End Program
      // (if clearing the index failed). Read each participant's doc: skip
      // past participants who haven't re-registered, and collect past pairs.
      const profiles = await loadCohortProfiles(
        [...fetched.students, ...fetched.seniors].map(p => p.id)
      );
      const isActive = (id: string) => {
        if (excludeSet.has(id)) return false;
        const profile = profiles.get(id);
        if (profile && !profile.inCohort) {
          excluded.push({ id, reason: 'Not registered for the current cohort' });
          return false;
        }
        return true;
      };
      const students = fetched.students.filter(p => isActive(p.id));
      const seniors = fetched.seniors.filter(p => isActive(p.id));
      const pastPairs = buildPastPairSet(
        profiles, students.map(s => s.id), seniors.map(s => s.id)
      );
      
      if (students.length === 0 || seniors.length === 0) {
        throw new MatchingInputError('No participants found for matching');
      }

      logger.info(`  Retrieved: ${students.length} students, ${seniors.length} seniors`);

      logger.info('\n[Phase 3] Score Calculation');
      // Drop past pairs before the cost matrix: a pair with no score costs
      // far more than any real pair, so the solver only lands on one when
      // nothing else is left, and such assignments are discarded.
      const { kept: scores, blocked: blockedScores } = removePastPairs(
        calculateAllPairwiseScores(students, seniors, this.config), pastPairs
      );
      if (blockedScores > 0) {
        logger.info(`  Blocked ${blockedScores} past-partner pairs`);
      }

      if (scores.length === 0) {
        throw new MatchingInputError('No similarity scores calculated');
      }

      logger.info(`  Calculated ${scores.length} pairwise scores`);

      logger.info('\n[Phase 4] Hungarian Matching');
      // Safety net: a past pair never comes back as a match. Both people end
      // up unmatched instead.
      const { kept: matches, blocked: blockedMatches } = removePastPairs(
        hungarianMatching(scores, students, seniors), pastPairs
      );
      if (blockedMatches > 0) {
        logger.warn(`  Removed ${blockedMatches} past-partner matches after assignment`);
      }
      logger.info(`  Created ${matches.length} matches`);

      logger.info('\n[Phase 5] Post-Processing');
      const enrichedMatches = enrichMatches(matches, this.config);
      const statistics = calculateStatistics(enrichedMatches);
      const { unmatchedStudents, unmatchedSeniors } = getUnmatchedParticipants(
        enrichedMatches, students, seniors
      );

      logger.info('\n[Phase 6] Formatting Results');
      const result: MatchingResult = {
        matches: enrichedMatches,
        statistics,
        config: this.config,
        timestamp: new Date(),
        unmatchedStudents: unmatchedStudents.length > 0 ? unmatchedStudents : undefined,
        unmatchedSeniors: unmatchedSeniors.length > 0 ? unmatchedSeniors : undefined,
        excludedParticipants: excluded.length > 0 ? excluded : undefined,
      };

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info('\n' + '='.repeat(60));
      logger.info('MATCHING PIPELINE COMPLETE');
      logger.info('='.repeat(60));
      logger.info(`Duration: ${duration}s`);
      logger.info(`Total Matches: ${result.matches.length}`);
      logger.info(`Average Score: ${result.statistics.averageScore}`);

      if (unmatchedStudents.length > 0 || unmatchedSeniors.length > 0) {
        logger.warn(`Unmatched: ${unmatchedStudents.length} students, ${unmatchedSeniors.length} seniors`);
      }

      return result;

    } catch (error) {
      logger.error('\n' + '='.repeat(60));
      logger.error('MATCHING PIPELINE FAILED');
      logger.error('='.repeat(60));
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  updateConfig(config: Partial<MatchingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    this.validateConfig();
  }

  getConfig(): MatchingConfig {
    return { ...this.config };
  }

  private validateConfig(): void {
    const { frqWeight, quantWeight } = this.config;
    if (frqWeight < 0 || frqWeight > 1) {
      throw new Error(`Invalid frqWeight: ${frqWeight}. Must be between 0 and 1`);
    }

    if (quantWeight < 0 || quantWeight > 1) {
      throw new Error(`Invalid quantWeight: ${quantWeight}. Must be between 0 and 1`);
    }

    const totalWeight = frqWeight + quantWeight;
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new Error(`Weights must sum to 1.0. Current sum: ${totalWeight}`);
    }
  }
}

export async function runMatching(config?: Partial<MatchingConfig>): Promise<MatchingResult> {
  const service = new MatchingService(config);
  return await service.runMatching();
}
