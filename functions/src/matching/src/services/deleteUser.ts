import { getPineconeClient, getIndexName } from "../config/pinecone.config.js";
import { logger } from "../utils/logger.js";

/**
 * Delete a user's vector from Pinecone by Firebase uid.
 * Vectors are stored in the default namespace with id = uid.
 */
export async function deleteUserFromPinecone(uid: string): Promise<void> {
  logger.info(`Deleting user vector for uid=${uid}`);

  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    throw new Error("Invalid uid provided to deleteUserFromPinecone");
  }

  const client = await getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);

  try {
    const ns = index.namespace("");
    await ns.deleteOne(uid);

    logger.info(
      `Successfully deleted vector for uid=${uid} from index=${indexName}`
    );
  } catch (err) {
    logger.error("Error in deleteUserFromPinecone:", err);
    throw err;
  }
}

/**
 * Delete every vector in the default namespace. Used when an admin ends the
 * program so the next cohort's matching run doesn't see last cohort's users.
 */
export async function deleteAllUsersFromPinecone(): Promise<void> {
  const client = await getPineconeClient();
  const indexName = getIndexName();
  const index = client.index(indexName);

  try {
    await index.namespace("").deleteAll();
    logger.info(`Deleted all vectors from index=${indexName}`);
  } catch (err) {
    // Deleting from an empty namespace returns 404; there's nothing to clear.
    if ((err as { name?: string }).name === "PineconeNotFoundError") {
      logger.info(`Index=${indexName} namespace already empty`);
      return;
    }
    logger.error("Error in deleteAllUsersFromPinecone:", err);
    throw err;
  }
}
