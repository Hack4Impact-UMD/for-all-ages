/**
 * Gemini API integration for generating embeddings
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initialize Gemini client
 */
export function initializeGeminiClient(): GoogleGenerativeAI {
  if (genAI) {
    return genAI;
  }
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  
  logger.info('Initializing Gemini client...');
  genAI = new GoogleGenerativeAI(apiKey);
  logger.info('Gemini client initialized successfully');
  
  return genAI;
}

/**
 * Generate embedding for a text string using Gemini
 * 
 * Using Gemini's embedding-001 model via REST API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    initializeGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }
    
    logger.debug(`Generating embedding for text (length: ${text.length})`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: text }]
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as { embedding?: { values?: number[] } };
    const embedding = data.embedding?.values;
    
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Failed to generate embedding: invalid response structure');
    }
    
    logger.debug(`Generated embedding with ${embedding.length} dimensions`);
    return embedding as number[];
    
  } catch (error) {
    logger.error(`Error generating embedding: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && (
      error.message.includes('rate limit') || 
      error.message.includes('429')
    )) {
      logger.warn('Rate limit hit, waiting 2 seconds before retry...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateEmbedding(text);
    }
    
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 10,
  delayMs: number = 500
): Promise<number[][]> {
  logger.info(`Generating embeddings for ${texts.length} texts in batches of ${batchSize}`);
  
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
    
    try {
      const batchPromises = batch.map(text => generateEmbedding(text));
      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
      
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
    } catch (error) {
      logger.error(`Error processing batch starting at index ${i}:`, error);
      throw error;
    }
  }
  
  logger.info(`Successfully generated ${embeddings.length} embeddings`);
  return embeddings;
}

