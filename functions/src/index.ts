import * as admin from "firebase-admin";
import busboy from "busboy";
// import * as functions from "firebase-functions";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";

import { MatchingConfig } from "./types";
import { MatchingService } from "./matching/src/services/matchingService";

import { upsertFreeResponse } from "./matching/src/services/upsertUser.js";
import computeMatchScoreService from "./matching/src/services/calculateMatchScore.js";
import { deleteUserFromPinecone } from "./matching/src/services/deleteUser.js";

import { Readable } from "stream";

admin.initializeApp();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const PARTICIPANTS = "participants";

type ProgramState = {
  started: boolean;
  matches_final: boolean;
};

function buildNumericScoreRanges(form: any): Record<string, { min: number; max: number }> {
  const scoreRanges: Record<string, { min: number; max: number }> = {};
  const usedKeys = new Set<string>();
  let nextNumericIndex = 1;

  const getNextNumericKey = (): string => {
    while (usedKeys.has(`numeric${nextNumericIndex}`)) {
      nextNumericIndex += 1;
    }
    const key = `numeric${nextNumericIndex}`;
    usedKeys.add(key);
    nextNumericIndex += 1;
    return key;
  };

  if (!form || !Array.isArray(form.sections)) {
    return scoreRanges;
  }

  form.sections.forEach((section: any) => {
    if (!Array.isArray(section.questions)) {
      return;
    }

    section.questions.forEach((q: any) => {
      if (!q.matchable || (q.type !== "Slider" && q.type !== "Number" && typeof q.min !== "number")) {
        return;
      }

      const existingKey =
        typeof q.numericKey === "string" && q.numericKey.trim().length > 0
          ? q.numericKey.trim()
          : "";

      const key =
        existingKey && !usedKeys.has(existingKey)
          ? existingKey
          : getNextNumericKey();

      usedKeys.add(key);
      scoreRanges[key] = {
        min: q.min ?? 1,
        max: q.max ?? 5,
      };
    });
  });

  return scoreRanges;
}

// Helper to fetch dynamic score ranges from the creator's form config
async function getDynamicMatchingConfig(): Promise<Partial<MatchingConfig>> {
  const formSnap = await admin.firestore().doc("config/registrationForm").get();
  let scoreRanges: Record<string, { min: number; max: number }> = {};
  
  if (formSnap.exists) {
    const form = formSnap.data();
    scoreRanges = buildNumericScoreRanges(form);
  }

  return {
    frqWeight: 0.7,
    quantWeight: 0.3,
    scoreRanges
  };
}

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

  // Fetch the dynamically constructed config with the creator's min/max ranges
  const config = await getDynamicMatchingConfig();
  const service = new MatchingService(config as MatchingConfig);
  const result = await service.runMatching();

  res.status(200).json({
    result: result,
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
    const { uid, textResponses, numericResponses, user_type, pronouns } = req.body;

    // Validate using Object.keys since numericResponses is now a Record/Object
    const hasText = textResponses && textResponses.length > 0;
    const hasNumeric = numericResponses && Object.keys(numericResponses).length > 0;

    // If there are no matchable responses, just return success
    if (!hasText && !hasNumeric) {
      res.status(200).json({ message: "No responses to upsert." });
      return;
    }

    await upsertFreeResponse(
      uid,
      textResponses || [],
      numericResponses || {},
      user_type,
      pronouns
    );

    res.status(200).json({ message: "Responses upserted successfully." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export const addToWaitlist = onRequest(async (req, res) => {
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
    const { uid, textResponses, numericResponses, user_type, pronouns } = req.body;

    if (!uid) {
      res.status(400).json({ error: "Missing required field: uid" });
      return;
    }

    const db = admin.firestore();

    // Add to waitlist collection
    await db.collection("waitlist").doc(uid).set({
      uid: uid,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Upsert their data to Pinecone for potential matching
    if ((textResponses && textResponses.length > 0) || 
        (numericResponses && numericResponses.length > 0)) {
      await upsertFreeResponse(
        uid,
        textResponses || [],
        numericResponses || [],
        user_type,
        pronouns
      );
    }

    res.status(200).json({ message: "Participant added to waitlist successfully." });
  } catch (err) {
    console.error("Error adding to waitlist:", err);
    res.status(500).json({ error: String(err) });
  }
});

export const computeMatchScore = onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const { uid1, uid2 } = req.body;

    if (!uid1 || !uid2) {
      res.status(400).json({ error: "Missing required fields: uid1, uid2" });
      return;
    }

    // Fetch the dynamically constructed config with the creator's min/max ranges
    const config = await getDynamicMatchingConfig();
    const result = await computeMatchScoreService(uid1, uid2, config); // Pass config dynamically

    res.status(200).json(result);
  } catch (err) {
    console.error("Error computing match score:", err);
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
      "Missing required field: targetUserId.",
    );
  }

  const trimmedTargetId = targetUserId.trim();
  if (callerUserId === trimmedTargetId) {
    throw new HttpsError("invalid-argument", "Cannot delete your own account.");
  }

  const db = admin.firestore();
  const callerDocRef = db.collection(PARTICIPANTS).doc(callerUserId);
  const callerDoc = await callerDocRef.get();

  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "Profile not found.");
  }

  const callerData = callerDoc.data();
  const callerRole = (
    callerData && typeof callerData.role === "string" ? callerData.role : ""
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

  // Check if user is on waitlist before deleting
  let isOnWaitlist = false;
  let waitlistLookupFailed = false;
  try {
    const waitlistDocRef = db.collection("waitlist").doc(trimmedTargetId);
    const waitlistSnap = await waitlistDocRef.get();
    isOnWaitlist = waitlistSnap.exists;
    if (isOnWaitlist) {
      await waitlistDocRef.delete();
    }
  } catch (err) {
    console.error("Error deleteUser (waitlist):", err);
    errors.push(`Waitlist: ${err}`);
    waitlistLookupFailed = true;
  }

  try {
    const targetDocRef = db.collection(PARTICIPANTS).doc(trimmedTargetId);
    const targetSnap = await targetDocRef.get();
    const targetData = targetSnap.data();
    const targetRole = (
      targetData && typeof targetData.role === "string" ? targetData.role : ""
    ).toLowerCase();
    const isParticipant = !targetRole || targetRole === "participant" || targetRole === "";

    await targetDocRef.delete();

    // Decrement currentParticipants if they were a counted participant (not waitlisted, not admin).
    // Skip decrement if waitlist lookup failed to avoid corrupting the count.
    // Use a transaction to guard against going below 0.
    if (!waitlistLookupFailed && !isOnWaitlist && isParticipant && targetSnap.exists) {
      const configRef = db.doc("config/programState");
      await db.runTransaction(async (txn) => {
        const configSnap = await txn.get(configRef);
        const current = (configSnap.data()?.currentParticipants ?? 0) as number;
        if (current > 0) {
          txn.update(configRef, {
            currentParticipants: admin.firestore.FieldValue.increment(-1),
          });
        }
      });
    }
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
    throw new HttpsError(
      "internal",
      `Partial deletion failure: ${errors.join("; ")}`,
    );
  }

  return { success: true };
});

export const removeProfilePicture = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    console.log("removeProfilePicture body:", req.body);

    const { uid } = req.body;

    if (!uid) {
      res.status(400).send("Missing uid");
      return;
    }

    const bucket = admin.storage().bucket("for-all-ages-cdn");
    const filePath = `profile-pictures/${uid}`;
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    console.log("exists:", exists, "path:", filePath);

    if (!exists) {
      res.status(404).send("Profile picture not found");
      return;
    }

    await file.delete();

    res.status(200).json({ message: "Profile picture removed" });
  } catch (err) {
    console.error("Remove error:", err);
    res.status(500).send(`Remove failed: ${err}`);
  }
});

export const uploadProfilePicture = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const bb = busboy({ headers: req.headers });
  let uid: string | null = null;
  let fileBuffer: Buffer | null = null;
  let fileMimeType = "image/jpeg";

  bb.on("field", (name: any, value: any) => {
    if (name === "uid") uid = value;
  });

  bb.on("file", (_: any, file: any, info: any) => {
    fileMimeType = info.mimeType;
    const chunks: Buffer[] = [];
    file.on("data", (chunk: any) => chunks.push(chunk));
    file.on("end", () => {
      fileBuffer = Buffer.concat(chunks);
    });
  });

  bb.on("finish", async () => {
    console.log(
      "busboy finished, uid=",
      uid,
      "buffer length=",
      fileBuffer?.length,
    );
    if (!uid || !fileBuffer) {
      console.warn("missing uid or fileBuffer", { uid, fileBuffer });
      res.status(400).send("Missing uid or file.");
      return;
    }

    try {
      const bucket = admin.storage().bucket("for-all-ages-cdn");
      const file = bucket.file(`profile-pictures/${uid}`);

      // uniform bucket-level access is enabled for this bucket, which
      // prohibits setting per-object ACLs (the `public: true` flag you
      // were previously using).
      //
      // Instead, ensure that the bucket's IAM policy grants
      // `roles/storage.objectViewer` to `allUsers` (or whatever principal
      // you need) so that objects are publicly readable. If you want to
      // make a single object public programmatically you can still call
      // `await file.makePublic();` after saving, but it may be unnecessary
      // if the bucket is already globally readable.
      await file.save(fileBuffer, {
        metadata: { contentType: fileMimeType },
        // no `public: true` option when uniform access is on
      });
      // if you do need to ensure the specific object is publicly readable,
      // uncomment the next line. it will succeed under uniform access.
      // await file.makePublic();

      res.status(200).json({
        url: `https://storage.googleapis.com/for-all-ages-cdn/profile-pictures/${uid}`,
      });
    } catch (err) {
      console.error("Upload error:", err);
      // send the full error message back so the client can inspect it
      res.status(500).send(`Upload failed: ${err}`);
    }
  });

  const readable = new Readable();
  readable.push(req.rawBody);
  readable.push(null);
  readable.pipe(bb);
});
