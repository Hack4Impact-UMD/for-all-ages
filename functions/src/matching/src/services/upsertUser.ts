import { getPineconeClient, getIndexName } from "../config/pinecone.config.js";
import { logger } from "../utils/logger.js";

export async function upsertFreeResponse(
  uid: string,
  freeResponse: string,
  q1: number,
  q2: number,
  q3: number,
  user_type: string,
  pronouns?: string
): Promise<void> {
  logger.info(`Upserting free response for uid=${uid}`);

  if (!uid || typeof uid !== "string") {
    throw new Error("Invalid uid provided to upsertFreeResponse");
  }

  if (!freeResponse || typeof freeResponse !== "string") {
    throw new Error("Invalid freeResponse provided to upsertFreeResponse");
  }

  if (!user_type || typeof user_type !== "string") {
    throw new Error("Invalid user_type provided to upsertFreeResponse");
  }

  const client = await getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);

  try {
    const embedResult = await client.inference.embed(
      "llama-text-embed-v2",
      [freeResponse],
      {
        inputType: "passage",
        truncate: "END",
      }
    );

    const embedding = (embedResult as any).data[0].values as number[];

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Failed to generate embedding from Pinecone inference");
    }

    const vector = {
      id: uid,
      values: embedding,
      metadata: {
        free_response: freeResponse.substring(0, 1000),
        q1: q1,
        q2: q2,
        q3: q3,
        user_type,
        pronouns: pronouns || "",
      },
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