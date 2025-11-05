/**
 * Pinecone Inference integration for generating embeddings
 */
import { getPineconeClient } from '../config/pinecone.config.js';
import { logger } from '../utils/logger.js';

/**
 * Generate embedding for a single text using Pinecone Inference API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    logger.debug(`Generating embedding for text (length: ${text.length})`);
    
    const pc = getPineconeClient();
    
    // Use Pinecone SDK's inference.embed() method with llama-text-embed-v2 model
    const result = await pc.inference.embed(
      'llama-text-embed-v2',
      [text],
      { inputType: 'passage', truncate: 'END' }
    );
    
    const embedding = result[0]?.values;
    
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Failed to generate embedding: invalid response structure');
    }
    
    logger.debug(`Generated embedding with ${embedding.length} dimensions`);
    return embedding;
    
  } catch (error) {
    logger.error(`Error generating embedding: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 96,
  delayMs: number = 500
): Promise<number[][]> {
  logger.info(`Generating embeddings for ${texts.length} texts in batches of ${batchSize}`);
  
  const embeddings: number[][] = [];
  const pc = getPineconeClient();
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
    
    try {
      // Use Pinecone SDK's inference.embed() method for batch processing with llama-text-embed-v2 model
      const result = await pc.inference.embed(
        'llama-text-embed-v2',
        batch,
        { inputType: 'passage', truncate: 'END' }
      );

      const batchVectors = result.map(item => {
        if (!item.values || !Array.isArray(item.values)) {
          throw new Error('Invalid embedding response: missing values');
        }
        return item.values;
      });
      
      if (batchVectors.length !== batch.length) {
        throw new Error(`Embeddings count mismatch: expected ${batch.length}, got ${batchVectors.length}`);
      }

      embeddings.push(...batchVectors);
      
      // Add delay between batches to avoid rate limiting
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

