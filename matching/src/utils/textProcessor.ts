/**
 * Text processing utilities - converts structured data to embedding-ready text
 */
import { type ParticipantData } from './validator.js';
import { logger } from './logger.js';

/**
 * Combine participant data into structured text for embedding
 */
export function createParticipantProfileText(participant: ParticipantData): string {
  const parts: string[] = [];
  
  parts.push('Profile:');
  
  // Interests and about me (primary matching field)
  if (participant.interests) {
    parts.push(`Interests and About Me: ${participant.interests.trim()}`);
  }
  
  // Motivation (secondary matching field)
  if (participant.motivation) {
    parts.push(`Motivation: ${participant.motivation.trim()}`);
  }
  
  // Language preference
  if (participant.language) {
    parts.push(`Language: ${participant.language.trim()}`);
  }
  
  // Tea preference
  if (participant.teaPreference) {
    parts.push(`Tea Preference: ${participant.teaPreference.trim()}`);
  }
  
  // College (if student)
  if (participant.type === 'young' && participant.college) {
    parts.push(`College: ${participant.college.trim()}`);
  }
  
  const profileText = parts.join('\n');
  
  // Validate we have meaningful content
  if (profileText.length < 10) {
    logger.warn(`Participant ${participant.participantId} has minimal profile text`);
  }
  
  return profileText;
}

/**
 * Normalize text for embedding (clean and standardize)
 */
export function normalizeText(text: string): string {
  return text
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters but keep basic punctuation
    .replace(/[^\w\s.,!?;:()'-]/g, '')
    // Trim
    .trim()
    // Convert to lowercase for consistency
    .toLowerCase();
}

/**
 * Create a clean, normalized version of profile text
 */
export function createNormalizedProfileText(participant: ParticipantData): string {
  const rawText = createParticipantProfileText(participant);
  return normalizeText(rawText);
}

