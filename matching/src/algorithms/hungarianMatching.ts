import { logger } from '../utils/logger.js';
import type { SimilarityScore, Match, ParticipantWithEmbedding } from '../types/matching.types.js';
import { createRequire } from 'module';

const requireModule = createRequire(import.meta.url);

export function hungarianMatching(
  scores: SimilarityScore[],
  students: ParticipantWithEmbedding[],
  seniors: ParticipantWithEmbedding[]
): Match[] {
  logger.info('Starting Hungarian algorithm matching...');
  
  let munkres: any;
  try {
    const mod = requireModule('munkres-js');
    munkres = (mod && (mod.default ?? mod));
  } catch (error) {
    throw new Error('munkres-js package required. Run: npm install munkres-js');
  }
  
  const { costMatrix, studentIds, seniorIds } = createCostMatrix(scores, students, seniors);
  logger.info(`Created ${studentIds.length}x${seniorIds.length} cost matrix`);
  
  const assignments = munkres(costMatrix);
  logger.info(`Found ${assignments.length} assignments`);
  
  const matches = convertAssignmentsToMatches(
    assignments, scores, students, seniors, studentIds, seniorIds
  );
  
  const totalScore = matches.reduce((sum, match) => sum + match.scores.finalScore, 0);
  logger.info(`Total score: ${totalScore.toFixed(4)} (avg: ${(totalScore / matches.length).toFixed(4)})`);
  
  return matches;
}

function createCostMatrix(
  scores: SimilarityScore[],
  students: ParticipantWithEmbedding[],
  seniors: ParticipantWithEmbedding[]
): {
  costMatrix: number[][];
  studentIds: string[];
  seniorIds: string[];
} {
  const studentIds = students.map(s => s.id);
  const seniorIds = seniors.map(s => s.id);
  
  const scoreMap = new Map<string, SimilarityScore>();
  for (const score of scores) {
    scoreMap.set(`${score.studentId}:${score.seniorId}`, score);
  }
  
  const n = Math.max(studentIds.length, seniorIds.length);
  const costMatrix: number[][] = [];
  
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i < studentIds.length && j < seniorIds.length) {
        const key = `${studentIds[i]}:${seniorIds[j]}`;
        const score = scoreMap.get(key);
        row.push(score ? 1 - score.finalScore : 1.0);
      } else {
        row.push(999999);
      }
    }
    costMatrix.push(row);
  }
  
  return { costMatrix, studentIds, seniorIds };
}

function convertAssignmentsToMatches(
  assignments: number[][],
  scores: SimilarityScore[],
  students: ParticipantWithEmbedding[],
  seniors: ParticipantWithEmbedding[],
  studentIds: string[],
  seniorIds: string[]
): Match[] {
  const matches: Match[] = [];
  
  const scoreMap = new Map<string, SimilarityScore>();
  for (const score of scores) {
    scoreMap.set(`${score.studentId}:${score.seniorId}`, score);
  }
  
  const studentMap = new Map(students.map(s => [s.id, s]));
  const seniorMap = new Map(seniors.map(s => [s.id, s]));
  
  for (const [studentIdx, seniorIdx] of assignments) {
    if (studentIdx >= studentIds.length || seniorIdx >= seniorIds.length) continue;
    
    const studentId = studentIds[studentIdx];
    const seniorId = seniorIds[seniorIdx];
    const score = scoreMap.get(`${studentId}:${seniorId}`);
    const student = studentMap.get(studentId);
    const senior = seniorMap.get(seniorId);
    
    if (!score || !student || !senior) continue;
    
    matches.push({
      studentId,
      seniorId,
      studentName: student.name ?? "",
      seniorName: senior.name ?? "",
      scores: {
        frqScore: score.frqScore,
        quantScore: score.quantScore,
        finalScore: score.finalScore,
      },
      confidence: 'medium',
    });
  }
  
  return matches;
}

export function getUnmatchedParticipants(
  matches: Match[],
  students: ParticipantWithEmbedding[],
  seniors: ParticipantWithEmbedding[]
): { unmatchedStudents: string[]; unmatchedSeniors: string[] } {
  const matchedStudents = new Set(matches.map(m => m.studentId));
  const matchedSeniors = new Set(matches.map(m => m.seniorId));
  
  return {
    unmatchedStudents: students.filter(s => !matchedStudents.has(s.id)).map(s => s.id),
    unmatchedSeniors: seniors.filter(s => !matchedSeniors.has(s.id)).map(s => s.id),
  };
}
