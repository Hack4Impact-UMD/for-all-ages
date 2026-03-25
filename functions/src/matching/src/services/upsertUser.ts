import { getPineconeClient, getIndexName } from "../config/pinecone.config.js";
import { logger } from "../utils/logger.js";

export async function upsertFreeResponse(
  uid: string,
  textResponses: string[],
  numericResponses: number[],
  user_type: string,
  pronouns?: string
): Promise<void> {
  logger.info(`Upserting matchable responses for uid=${uid}`);

  if (!uid || typeof uid !== "string") {
    throw new Error("Invalid uid provided to upsertFreeResponse");
  }

  if (!Array.isArray(textResponses)) {
    throw new Error("Invalid textResponses provided to upsertFreeResponse");
  }

  if (!Array.isArray(numericResponses)) {
    throw new Error("Invalid numericResponses provided to upsertFreeResponse");
  }

  if (!user_type || typeof user_type !== "string") {
    throw new Error("Invalid user_type provided to upsertFreeResponse");
  }

  const client = await getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);

  try {
    // Build metadata object with dynamic responses
    const metadata: Record<string, any> = {
      user_type,
    };

    // Add numeric responses with naming convention: numeric1, numeric2, etc.
    numericResponses.forEach((value, index) => {
      metadata[`numeric${index + 1}`] = value;
    });

    // Combine all text responses for embedding. If none are provided, use a
    // deterministic fallback so numeric-only responses are still upserted.
    const allTextResponses = textResponses.join(" ");
    const embeddingInput =
      allTextResponses.trim().length > 0
        ? allTextResponses
        : `uid:${uid} user_type:${user_type}`;

    // Generate embedding for combined text responses
    const embedResult = await client.inference.embed(
      "llama-text-embed-v2",
      [embeddingInput],
      {
        inputType: "passage",
        truncate: "END",
      }
    );

    const embedding = (embedResult as any).data[0].values as number[];

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Failed to generate embedding from Pinecone inference");
    }

    // Add individual text responses with naming convention: text1, text2, etc.
    textResponses.forEach((response, index) => {
      metadata[`text${index + 1}`] = response.substring(0, 1000);
    });
    
    if (pronouns) {
      metadata.pronouns = pronouns;
    }

    const vector = {
      id: uid,
      values: embedding,
      metadata,
    };

    await index.upsert([vector]);

    logger.info(
      `Successfully upserted vector for uid=${uid} into index=${indexName}`
    );
  } catch (err) {
    logger.error("Error in upsertFreeResponse:", err);
    throw err;
  }
}