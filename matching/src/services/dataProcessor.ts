/**
 * Data processor for Excel files - parses JotForm Excel exports
 */
import XLSX from 'xlsx';
import { logger } from '../utils/logger.js';
import { JotFormRowSchema, ParticipantDataSchema, type ParticipantData, type JotFormRow } from '../utils/validator.js';

/**
 * Parse Excel file and extract participant data
 */
export async function parseExcelFile(filePath: string): Promise<ParticipantData[]> {
  try {
    logger.info(`Reading Excel file: ${filePath}`);
    
    // Read the workbook
    const workbook = XLSX.readFile(filePath);
    
    // Get the first sheet (JotForm typically exports to Sheet1)
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      throw new Error(`No sheet found in Excel file: ${filePath}`);
    }
    
    // Convert sheet to JSON with header row
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    
    if (rows.length === 0) {
      logger.warn('Excel file contains no data rows');
      return [];
    }
    
    logger.info(`Found ${rows.length} rows in Excel file`);
    
    // Process and validate each row
    const participants: ParticipantData[] = [];
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < rows.length; i++) {
      try {
        // Validate row structure
        const validatedRow = JotFormRowSchema.parse(rows[i]);
        const participant = transformToParticipantData(validatedRow, i + 1);
        
        // Validate transformed participant
        const validatedParticipant = ParticipantDataSchema.parse(participant);
        participants.push(validatedParticipant);
        processedCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Error processing row ${i + 1}:`, error instanceof Error ? error.message : String(error));
        // Continue processing other rows
      }
    }
    
    logger.info(`Successfully processed ${processedCount} participants, ${errorCount} errors`);
    return participants;
    
  } catch (error) {
    logger.error(`Failed to parse Excel file: ${filePath}`, error);
    throw error;
  }
}

/**
 * Transform JotForm row data to ParticipantData structure
 */
function transformToParticipantData(row: JotFormRow, rowIndex: number): ParticipantData {
  const type = row['Young or Older'] === 'Y' ? 'young' : 'older';
  
  // Generate participant ID (using email if available, otherwise name + row index)
  const participantId = row['E-mail'] 
    ? `participant_${row['E-mail'].replace(/[@.]/g, '_')}` 
    : `participant_${row['Full Name'].replace(/\s+/g, '_')}_${rowIndex}`;
  
  // Extract address components
  const address = row['Street Address'] ? {
    street: row['Street Address'],
    streetLine2: row['Street Address Line 2'],
    city: row['City'],
    state: row['State / Province'],
    zipCode: row['Postal / Zip Code'],
  } : undefined;
  
  return {
    participantId,
    type,
    name: row['Full Name'],
    email: row['E-mail'],
    phoneNumber: row['Phone Number'],
    dateOfBirth: row['Date of birth '],
    pronouns: row['Your preferred pronouns (for example: she/her, he/him, they/them).'],
    college: row['If you are a college student, what college are you attending?'],
    language: row['What language do you use for casual conversation? (Primary language spoken at home.)'],
    teaPreference: row['What type of tea do you prefer?'],
    interests: row['Tell us about you! Include any interests that you think will help us make a better match with your Tea-Mate.'],
    motivation: row['Please tell us why you are interested; what you hope to get out of your participation in this program.'],
    address,
  };
}

/**
 * Validate that a file path exists and is readable
 */
export async function validateFilePath(filePath: string): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

