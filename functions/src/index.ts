import * as admin from "firebase-admin";
// import * as functions from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { MatchingConfig } from "./types";
import { MatchingService } from "./matching/src/services/matchingService";

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
