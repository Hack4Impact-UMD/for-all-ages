/**
 * Express API server for matching service
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pinecone } from "@pinecone-database/pinecone";
import { upsertEmbeddings } from "./services/vectorService.js";
import { logger } from "./utils/logger.js";
import type { ParticipantData } from "./utils/validator.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "matching-api" });
});

/**
 * POST /api/participants/upsert-vector
 * Upsert a single participant's embedding to Pinecone
 */
app.post("/api/participants/upsert-vector", async (req, res) => {
  try {
    const { uid, freeResponse } = req.body;

    if (!uid || typeof uid !== "string") {
      return res.status(400).json({ error: "Valid uid is required" });
    }

    if (
      !freeResponse ||
      typeof freeResponse !== "string" ||
      !freeResponse.trim()
    ) {
      return res.status(400).json({ error: "Valid freeResponse is required" });
    }

    logger.info(`Upserting vector for participant: ${uid}`);

    // Generate embedding
    const embedding = await generateEmbedding(freeResponse.trim());

    // Create participant data
    const participantData: ParticipantData[] = [
      {
        participantId: uid,
        name: "",
        type: "Participant",
        freeResponse: freeResponse.trim(),
      },
    ];

    // Upsert to Pinecone
    await upsertEmbeddings(participantData, [embedding]);

    logger.info(`Successfully upserted vector for participant: ${uid}`);
    res.status(200).json({
      success: true,
      message: "Vector upserted successfully",
      participantId: uid,
    });
  } catch (error) {
    logger.error(
      `Error upserting vector: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    res.status(500).json({
      error: "Failed to upsert vector",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Generate embedding using Pinecone's inference API via SDK
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const PINECONE_EMBEDDING_MODEL =
    process.env.PINECONE_EMBEDDING_MODEL || "multilingual-e5-large";

  try {
    const embeddings = await pinecone.inference.embed(
      PINECONE_EMBEDDING_MODEL,
      [text],
      { inputType: "passage", truncate: "END" }
    );

    if (!embeddings || embeddings.length === 0 || !embeddings[0].values) {
      throw new Error("Pinecone returned empty embedding");
    }

    return embeddings[0].values;
  } catch (error) {
    logger.error(
      `Embedding generation failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

// Error handling
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(`Unhandled error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
);

// Start server
app.listen(PORT, () => {
  logger.info(`Matching API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
