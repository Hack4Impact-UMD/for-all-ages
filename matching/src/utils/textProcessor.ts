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

  // New simplified format: use free-response
  if (participant.freeResponse) {
    parts.push(`About: ${participant.freeResponse.trim()}`);
  }

  // Legacy format fields (for backward compatibility)
  if (participant.interests) {
    parts.push(`Interests and About Me: ${participant.interests.trim()}`);
  }

  if (participant.motivation) {
    parts.push(`Motivation: ${participant.motivation.trim()}`);
  }

  if (participant.language) {
    parts.push(`Language: ${participant.language.trim()}`);
  }

  if (participant.teaPreference) {
    parts.push(`Tea Preference: ${participant.teaPreference.trim()}`);
  }

  if (participant.type === 'student' && participant.college) {
    parts.push(`College: ${participant.college.trim()}`);
  }

  const profileText = parts.join('\n');

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
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:()'-]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Create a clean, normalized version of profile text
 */
export function createNormalizedProfileText(participant: ParticipantData): string {
  const rawText = createParticipantProfileText(participant);
  return normalizeText(rawText);
}

