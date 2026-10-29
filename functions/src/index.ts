import * as admin from "firebase-admin";
import busboy from "busboy";
// import * as functions from "firebase-functions";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";

import { MatchingConfig } from "./types";
import { MatchingService } from "./matching/src/services/matchingService";

import { upsertFreeResponse } from "./matching/src/services/upsertUser.js";
import computeMatchScoreService from "./matching/src/services/calculateMatchScore.js";
import {
  deleteUserFromPinecone,
  deleteAllUsersFromPinecone,
} from "./matching/src/services/deleteUser.js";

import { buildMatchablePayload } from "./matchablePayload";
import { assignNumericKeys, getFormQuestions } from "./numericKeys";
import { getCallerRole, isAdminRole, isFullAdminRole, normalizeRole } from "./roles";

import { Readable } from "stream";

admin.initializeApp({
  projectId: "for-all-ages-prd", 
});

const CORS_ORIGIN = "https://hack4impact-umd.github.io";
const PARTICIPANTS = "participants";

type Caller = { uid: string; isAdmin: boolean; isFullAdmin: boolean };

/**
 * Verifies the Firebase ID token in the Authorization header and looks up the
 * caller's role. Sends a 401 and returns null if the token is missing or
 * invalid. CORS only restricts browsers, so every HTTP function must call this.
 */
async function authenticate(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<Caller | null> {
  const header = req.headers.authorization;
  const match =
    typeof header === "string" ? header.match(/^Bearer (.+)$/) : null;
  if (!match) {
    res.status(401).json({ error: "Missing Authorization bearer token." });
    return null;
  }

  let uid: string;
  try {
    uid = (await admin.auth().verifyIdToken(match[1])).uid;
  } catch {
    res.status(401).json({ error: "Invalid or expired ID token." });
    return null;
  }

  const role = await getCallerRole(uid);
  return {
    uid,
    isFullAdmin: isFullAdminRole(role),
    isAdmin: isAdminRole(role),
  };
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;

function buildNumericScoreRanges(form: any): Record<string, { min: number; max: number }> {
  const scoreRanges: Record<string, { min: number; max: number }> = {};
  assignNumericKeys(getFormQuestions(form)).forEach((key, q) => {
    scoreRanges[key] = {
      min: q.min ?? 1,
      max: q.max ?? 5,
    };
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
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const caller = await authenticate(req, res);
  if (!caller) return;
  if (!caller.isFullAdmin) {
    res.status(403).json({ error: "Admins only." });
    return;
  }

  // Fetch the dynamically constructed config with the creator's min/max ranges
  const config = await getDynamicMatchingConfig();
  const service = new MatchingService(config as MatchingConfig);
  const excludeIds: string[] = Array.isArray(req.body?.excludeIds)
    ? req.body.excludeIds.filter((id: unknown) => typeof id === "string")
    : [];
  const result = await service.runMatching(excludeIds);

  res.status(200).json({
    result: result,
  });
});

export const upsertUser = onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const caller = await authenticate(req, res);
  if (!caller) return;

  try {
    const { uid, textResponses, numericResponses, user_type, pronouns } = req.body;

    if (!uid || (uid !== caller.uid && !caller.isAdmin)) {
      res.status(403).json({ error: "You can only update your own profile." });
      return;
    }

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
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const caller = await authenticate(req, res);
  if (!caller) return;
  if (!caller.isAdmin) {
    res.status(403).json({ error: "Admins only." });
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
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const caller = await authenticate(req, res);
  if (!caller) return;
  if (!caller.isFullAdmin) {
    res.status(403).json({ error: "Admins only." });
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

  const callerRole = normalizeRole(callerDoc.data()?.role);

  if (!isAdminRole(callerRole)) {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  // Only full admins may delete admin or sub-admin accounts.
  if (!isFullAdminRole(callerRole)) {
    const targetSnap = await db.collection(PARTICIPANTS).doc(trimmedTargetId).get();
    const targetData = targetSnap.data();
    if (targetData?.type === "Admin" || isAdminRole(targetData?.role)) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can delete admin or sub-admin accounts.",
      );
    }
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
    const targetRole = normalizeRole(targetSnap.data()?.role);
    const isParticipant = targetRole === "" || targetRole === "participant";

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
    // Delete every match the user is in, on either side, so none is left
    // pointing at a deleted participant.
    const matchesRef = db.collection("matches");
    const snapshots = await Promise.all([
      matchesRef.where("participant1_id", "==", trimmedTargetId).get(),
      matchesRef.where("participant2_id", "==", trimmedTargetId).get(),
    ]);
    await Promise.all(
      snapshots.flatMap((snap) => snap.docs.map((d) => d.ref.delete())),
    );
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

// Lets an admin place a participant who registered without a group (ages
// 36-54, or no date of birth) as a student or older adult, and adds them to
// Pinecone so they can be matched.
export const assignUserType = onCall(async (request) => {
  const callerUserId = request.auth?.uid;
  if (!callerUserId) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  if (!isAdminRole(await getCallerRole(callerUserId))) {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  const db = admin.firestore();

  const targetUserId = request.data?.targetUserId;
  const userType = request.data?.userType;
  if (typeof targetUserId !== "string" || targetUserId.trim() === "") {
    throw new HttpsError("invalid-argument", "Missing required field: targetUserId.");
  }
  if (userType !== "student" && userType !== "adult") {
    throw new HttpsError("invalid-argument", "userType must be 'student' or 'adult'.");
  }

  const targetRef = db.collection(PARTICIPANTS).doc(targetUserId);
  const targetSnap = await targetRef.get();
  if (targetSnap.data()?.type !== "Participant") {
    throw new HttpsError("not-found", "Participant not found.");
  }

  const [formSnap, responseSnap] = await Promise.all([
    db.doc("config/registrationForm").get(),
    db.collection("FormResponse").doc(targetUserId).get(),
  ]);
  const { textResponses, numericResponses, pronouns } = buildMatchablePayload(
    formSnap.data(),
    responseSnap.data()?.questions ?? [],
  );

  // Upsert before setting user_type so a failure doesn't leave someone who
  // looks placed but can't be matched. Like registration, this upserts even
  // with no matchable answers (upsertFreeResponse embeds a placeholder).
  await upsertFreeResponse(targetUserId, textResponses, numericResponses, userType, pronouns);

  await targetRef.update({
    user_type: userType,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// Clears every participant vector from Pinecone. Called by End Program so the
// next cohort's matching run doesn't return last cohort's (deleted) users.
export const clearMatchingIndex = onCall(async (request) => {
  const callerUserId = request.auth?.uid;
  if (!callerUserId) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  if (!isFullAdminRole(await getCallerRole(callerUserId))) {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  try {
    await deleteAllUsersFromPinecone();
  } catch (err) {
    console.error("Error clearMatchingIndex:", err);
    throw new HttpsError("internal", `Failed to clear matching index: ${err}`);
  }

  return { success: true };
});

export const removeProfilePicture = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

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

    const caller = await authenticate(req, res);
    if (!caller) return;

    const { uid } = req.body;

    if (!uid) {
      res.status(400).send("Missing uid");
      return;
    }

    if (uid !== caller.uid && !caller.isAdmin) {
      res.status(403).send("You can only change your own profile picture.");
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
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const caller = await authenticate(req, res);
  if (!caller) return;

  const bb = busboy({
    headers: req.headers,
    limits: { files: 1, fileSize: MAX_PROFILE_PICTURE_BYTES },
  });
  let uid: string | null = null;
  let fileBuffer: Buffer | null = null;
  let fileMimeType = "image/jpeg";
  let fileTooLarge = false;

  bb.on("field", (name: any, value: any) => {
    if (name === "uid") uid = value;
  });

  bb.on("file", (_: any, file: any, info: any) => {
    fileMimeType = info.mimeType;
    const chunks: Buffer[] = [];
    file.on("data", (chunk: any) => chunks.push(chunk));
    file.on("limit", () => {
      fileTooLarge = true;
    });
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

    if (uid !== caller.uid && !caller.isAdmin) {
      res.status(403).send("You can only change your own profile picture.");
      return;
    }

    if (fileTooLarge) {
      res.status(413).send("File is too large (max 5 MB).");
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(fileMimeType)) {
      res.status(415).send("Only JPEG, PNG, WebP or GIF images are allowed.");
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
