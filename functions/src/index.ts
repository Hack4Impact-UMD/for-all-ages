import * as admin from "firebase-admin";
// import * as functions from "firebase-functions";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { MatchingConfig } from "./types";
import { MatchingService } from "./matching/src/services/matchingService";

import { upsertFreeResponse } from './matching/src/services/upsertUser.js';
import computeMatchScoreService from './matching/src/services/calculateMatchScore.js';
import { deleteUserFromPinecone } from './matching/src/services/deleteUser.js';

admin.initializeApp();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const PARTICIPANTS = "participants";

type ProgramState = {
  started: boolean;
  matches_final: boolean;
  week: number;
};


export const matchAll = onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", CORS_ORIGIN);
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

export const upsertUser = onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", CORS_ORIGIN);
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


// run to deply to cloud --> firebase deploy --only functions:incrementProgramWeek
// Cron job to run matching every day at midnight
export const incrementProgramWeek = onSchedule(
  // Saturday at 11:59 PM Eastern Time "59 23 * * 6"
  // FOR TESTING PURPOSES ONLY: runs every 1 min "*/1 * * * *" 
  { schedule: "59 23 * * 6", timeZone: "America/New_York" },
  async () => {

    console.log("HERE*****");
    const ref = admin.firestore().doc("config/programState");

    await admin.firestore().runTransaction(async (tx) => {

      const snap = await tx.get(ref);
      if (!snap.exists) return;

      const data = snap.data() as ProgramState;

      // ONLY RUN IF PROGRAM HAS STARTED
      if (!data.started) return;

      const currentWeek = data.week ?? 1;
      const nextWeek = currentWeek + 1; // optionally cap this

      tx.update(ref, {
        week: nextWeek,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
    });
  }
);

export const computeMatchScore = onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', CORS_ORIGIN);
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

export const deleteUser = onCall(async (request) => {
  const callerUserId = request.auth?.uid;
  if (!callerUserId) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const targetUserId = request.data?.targetUserId;
  if (typeof targetUserId !== "string" || targetUserId.trim() === "") {
    throw new HttpsError(
      "invalid-argument",
      "Missing required field: targetUserId."
    );
  }

  const trimmedTargetId = targetUserId.trim();
  if (callerUserId === trimmedTargetId) {
    throw new HttpsError(
      "invalid-argument",
      "Cannot delete your own account."
    );
  }

  const db = admin.firestore();
  const callerDocRef = db.collection(PARTICIPANTS).doc(callerUserId);
  const callerDoc = await callerDocRef.get();

  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "Profile not found.");
  }

  const callerData = callerDoc.data();
  const callerRole =
    (callerData && typeof callerData.role === "string"
      ? callerData.role
      : ""
    ).toLowerCase();

  const isAdmin =
    callerRole === "admin" ||
    callerRole === "subadmin" ||
    callerRole === "sub-admin";

  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  const errors: string[] = [];

  try {
    await admin.auth().deleteUser(trimmedTargetId);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "auth/user-not-found") {
      console.warn(`Auth user ${trimmedTargetId} already deleted, continuing.`);
    } else {
      console.error("Error deleteUser (auth):", err);
      errors.push(`Auth: ${err}`);
    }
  }

  try {
    const targetDocRef = db.collection(PARTICIPANTS).doc(trimmedTargetId);
    await targetDocRef.delete();
  } catch (err) {
    console.error("Error deleteUser (firestore):", err);
    errors.push(`Firestore: ${err}`);
  }

  try {
    const matchesRef = db.collection("matches");

    let snapshot = await matchesRef
      .where("participant1_id", "==", trimmedTargetId)
      .limit(1)
      .get();

    //check participant2 if not found yet
    if (snapshot.empty) {
      snapshot = await matchesRef
        .where("participant2_id", "==", trimmedTargetId)
        .limit(1)
        .get();
    }

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }

  } catch (err) {
    console.error("Error deleteUser (matches):", err);
    errors.push(`Matches: ${err}`);
  }

  try {
    await deleteUserFromPinecone(trimmedTargetId);
  } catch (err) {
    console.error("Error deleteUser (pinecone):", err);
    errors.push(`Pinecone: ${err}`);
  }

  if (errors.length > 0) {
    throw new HttpsError("internal", `Partial deletion failure: ${errors.join("; ")}`);
  }

  return { success: true };
});
