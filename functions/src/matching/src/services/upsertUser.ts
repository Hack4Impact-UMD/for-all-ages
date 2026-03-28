import { getPineconeClient, getIndexName } from "../config/pinecone.config.js";
import { logger } from "../utils/logger.js";

export async function upsertFreeResponse(
  uid: string,
  textResponses: string[],
  numericResponses: number[],
  user_type: string
): Promise<void> {
  logger.info(`Upserting free response for uid=${uid}`);

  const combinedText = textResponses.join("\n\n");

  const client = await getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);

  try {
    const embedResult = await client.inference.embed(
      "llama-text-embed-v2",
      [combinedText],
      {
        inputType: "passage",
        truncate: "END",
      }
    );

    const embedding = (embedResult as any).data[0].values as number[];
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Failed to generate embedding from Pinecone inference");
    }

    const metadata: Record<string, any> = {
      user_type,
      full_text_length: combinedText.length,
    }

    numericResponses.forEach((val, idx) => {
      metadata[`q_${idx}`] = val;
    });

    await index.upsert([{
      id: uid,
      values: embedding,
      metadata,
    }]);

    logger.info(
      `Successfully upserted vector for uid=${uid}`
    );
  } catch (err) {
    logger.error("Error in upsertFreeResponse:", err);
    throw err;
  }
}