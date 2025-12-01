import * as functions from "firebase-functions";

import { MatchingConfig } from "./types";
import { MatchingService } from "./matching/src/services/matchingService";

import { upsertFreeResponse } from './matching/src/services/upsertUser.js';

export const matchAll = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "http://localhost:5173");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  let frqWeight = 0.7;
  let quantWeight = 0.3;

  const config: Partial<MatchingConfig> = { frqWeight, quantWeight };
  const service = new MatchingService(config);
  const result = await service.runMatching();

  res.status(200).json({
    result: result
  });
});

export const upsertUser = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "http://localhost:5173");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const { uid, freeResponse, q1, q2, q3, user_type } = req.body;

    if (!uid || !freeResponse || !user_type) {
      res.status(400).json({ error: "Missing required fields: uid, freeResponse, user_type" });
      return;
    }

    await upsertFreeResponse(uid, freeResponse, q1, q2, q3, user_type);

    res.status(200).json({ message: "Free response upserted successfully." });
  } catch (err) {res.status(500).json({ error: String(err) });
  }
});





