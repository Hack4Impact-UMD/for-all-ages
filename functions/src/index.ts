import * as admin from "firebase-admin";
// import * as functions from "firebase-functions";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { MatchingConfig } from "./types";
import { MatchingService } from "./matching/src/services/matchingService";

import { upsertFreeResponse } from './matching/src/services/upsertUser.js';
import computeMatchScoreService from './matching/src/services/calculateMatchScore.js';

admin.initializeApp();


type ProgramState = {
  started: boolean;
  matches_final: boolean;
  week: number;
};


export const matchAll = onRequest(async (req, res) => {
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

export const upsertUser = onRequest(async (req, res) => {
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

const PARTICIPANTS_COLLECTION = "participants";

/** Allowed roles for calling deleteUser (admin-only action). */
function isAdminRole(role: string | undefined | null): boolean {
  const r = (role ?? "").toString().trim().toLowerCase();
  return r === "admin" || r === "subadmin" || r === "sub-admin";
}

type DeleteUserRequest = {
  auth?: { uid: string };
  data?: { targetUserId?: string };
};

/**
 * Callable: delete a user (Auth + Firestore participants doc).
 * Caller must be authenticated and have role Admin or Subadmin.
 * Only production collection "participants" is used.
 */
export const deleteUser = onCall(async (request: DeleteUserRequest) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in to delete a user.");
  }

  const targetUserId = request.data?.targetUserId;
  if (typeof targetUserId !== "string" || !targetUserId.trim()) {
    throw new HttpsError("invalid-argument", "Missing or invalid targetUserId.");
  }
  const targetUid = targetUserId.trim();

  if (callerUid === targetUid) {
    throw new HttpsError("invalid-argument", "You cannot delete your own account.");
  }

  const firestore = admin.firestore();
  const callerDoc = await firestore.doc(`${PARTICIPANTS_COLLECTION}/${callerUid}`).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "Your profile was not found.");
  }
  const callerRole = (callerDoc.data() as { role?: string })?.role;
  if (!isAdminRole(callerRole)) {
    throw new HttpsError("permission-denied", "Only admins can delete users.");
  }

  try {
    await admin.auth().deleteUser(targetUid);
  } catch (authErr: unknown) {
    const msg = authErr instanceof Error ? authErr.message : String(authErr);
    console.error("deleteUser: Auth delete failed", { targetUid, msg });
    throw new HttpsError("internal", "Failed to delete user account.");
  }

  try {
    await firestore.doc(`${PARTICIPANTS_COLLECTION}/${targetUid}`).delete();
  } catch (firestoreErr: unknown) {
    console.error("deleteUser: Firestore delete failed", { targetUid, firestoreErr });
    throw new HttpsError("internal", "User account was removed but profile cleanup failed.");
  }

  return { success: true };
});
