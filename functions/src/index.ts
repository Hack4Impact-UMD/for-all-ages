import * as functions from "firebase-functions";

import { MatchingConfig } from "./types";
import { MatchingService } from "./matching/src/services/matchingService";

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





