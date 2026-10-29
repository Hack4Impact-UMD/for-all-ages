import { writeBatch, type Firestore, type WriteBatch } from "firebase/firestore";

// Firestore rejects a batch with more than 500 operations.
const MAX_BATCH_OPS = 500;

export type BatchOp = (batch: WriteBatch) => void;

/**
 * Commits the operations in batches of at most 500, in order. Not atomic
 * across chunks: callers should order ops so a partial failure is safe to
 * retry.
 */
export async function commitInChunks(db: Firestore, ops: BatchOp[]) {
  for (let i = 0; i < ops.length; i += MAX_BATCH_OPS) {
    const batch = writeBatch(db);
    ops.slice(i, i + MAX_BATCH_OPS).forEach((op) => op(batch));
    await batch.commit();
  }
}
