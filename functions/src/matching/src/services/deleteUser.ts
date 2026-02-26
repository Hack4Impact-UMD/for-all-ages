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
