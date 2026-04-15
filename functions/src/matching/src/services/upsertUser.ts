import { getPineconeClient, getIndexName } from "../config/pinecone.config.js";
import { logger } from "../utils/logger.js";

function normalizeUserTypeForPinecone(userType: string): "Student" | "Adult" {
  return userType.trim().toLowerCase() === "adult" ? "Adult" : "Student";
}

export async function upsertFreeResponse(
  uid: string,
  textResponses: string[],
  numericResponses: Record<string, number>,
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

  if (!numericResponses || typeof numericResponses !== "object") {
    throw new Error("Invalid numericResponses provided to upsertFreeResponse");
  }

  if (!user_type || typeof user_type !== "string") {
    throw new Error("Invalid user_type provided to upsertFreeResponse");
  }

  const client = await getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);

  try {
    const normalizedUserType = normalizeUserTypeForPinecone(user_type);
    const metadata: Record<string, any> = {
      user_type: normalizedUserType,
    };

    // Store numeric responses keyed by stable question ID directly into metadata
    for (const [key, value] of Object.entries(numericResponses)) {
      metadata[key] = value;
    }

    // Combine text responses for embedding
    const combinedText = textResponses.join("\n\n");
    const embeddingInput =
      combinedText.trim().length > 0
        ? combinedText
        : `uid:${uid} user_type:${normalizedUserType}`;

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

    metadata.full_text_length = combinedText.length;
    
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
