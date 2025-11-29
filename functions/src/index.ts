import * as functions from "firebase-functions";

import { MatchingConfig } from "./types";
import { MatchingService } from "./matching/src/services/matchingService";

import { upsertFreeResponse } from './matching/src/services/upsertUser.js';
import computeMatchScoreService from './matching/src/services/calculateMatchScore.js';

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

export const computeMatchScore = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { uid1, uid2 } = req.body;

    if (!uid1 || !uid2) {
      res.status(400).json({ error: 'Missing required fields: uid1, uid2' });
      return;
    }

    const result = await computeMatchScoreService(uid1, uid2);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error computing match score:', err);
    res.status(500).json({ error: String(err) });
  }
});





