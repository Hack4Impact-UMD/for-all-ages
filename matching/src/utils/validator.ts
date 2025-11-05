/**
 * Zod schemas for validating Excel data structure
 */
import { z } from 'zod';

/**
 * Schema matching the new simplified Excel structure
 */
export const SimplifiedRowSchema = z.object({
  'id': z.string().min(1),
  'type': z.string().min(1),
  'name': z.string().min(1),
  'free-response': z.string().optional(),
  'Q1': z.coerce.number().optional(),
  'Q2': z.coerce.number().optional(),
  'Q3': z.coerce.number().optional(),
  'ideal_match': z.string().optional(),
});

/**
 * Schema matching the JotForm Excel structure (legacy)
 */
export const JotFormRowSchema = z.object({
  'Young or Older': z.enum(['Y', 'O', 'y', 'o']).transform(val => val.toUpperCase()),
  'Date of birth ': z.coerce.date(),
  'Submission Date': z.coerce.date().optional(),
  'Full Name': z.string().min(1),
  'Street Address': z.string().optional(),
  'Street Address Line 2': z.string().optional(),
  'City': z.string().optional(),
  'State / Province': z.string().optional(),
  'Postal / Zip Code': z.string().optional(),
  'Phone Number': z.string().optional(),
  'E-mail': z.string().email().optional(),
  'Phone Number (confirm)': z.string().optional(),
  'Email (confirm)': z.string().optional(),
  'How did you hear about this program?': z.string().optional(),
  'Please tell us why you are interested; what you hope to get out of your participation in this program.': z.string().optional(),
  'What language do you use for casual conversation? (Primary language spoken at home.)': z.string().optional(),
  'What type of tea do you prefer?': z.string().optional(),
  'Tell us about you! Include any interests that you think will help us make a better match with your Tea-Mate.': z.string().optional(),
  'If you are a college student, what college are you attending?': z.string().optional(),
  'Your preferred pronouns (for example: she/her, he/him, they/them).': z.string().optional(),
  'Please confirm that you agree to PRIORITIZE a weekly conversation with your Tea-Mate for 12 weeks. (It\'s important for us to know that your Tea-Mate can count on you!)': z.string().optional(),
  'Please tell us about any special circumstances or limitations, physical or otherwise, that may prevent you from fully engaging in this Community.': z.string().optional(),
  'Please confirm that you have read and agree with the disclaimer below.': z.string().optional(),
});

/**
 * Processed participant data structure
 */
export const ParticipantDataSchema = z.object({
  participantId: z.string(),
  type: z.string(),
  name: z.string(),
  freeResponse: z.string().optional(),
  q1: z.number().optional(),
  q2: z.number().optional(),
  q3: z.number().optional(),
  idealMatch: z.string().optional(),
  // Legacy fields (optional for backward compatibility)
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.date().optional(),
  pronouns: z.string().optional(),
  college: z.string().optional(),
  language: z.string().optional(),
  teaPreference: z.string().optional(),
  interests: z.string().optional(),
  motivation: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    streetLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
  }).optional(),
});

export type SimplifiedRow = z.infer<typeof SimplifiedRowSchema>;
export type JotFormRow = z.infer<typeof JotFormRowSchema>;
export type ParticipantData = z.infer<typeof ParticipantDataSchema>;

