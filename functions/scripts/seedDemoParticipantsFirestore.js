const admin = require("firebase-admin");
const { demoParticipants } = require("./demoParticipants.js");

const dryRun = process.argv.includes("--dry-run");
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "for-all-ages-8a4e2";

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = dryRun ? null : admin.firestore();
const timestamp = admin.firestore.FieldValue.serverTimestamp();

async function seedParticipant(person) {
  if (dryRun) {
    console.log(`[dry-run] Would seed ${person.uid} (${person.displayName})`);
    return;
  }

  const participantRef = db.collection("participants").doc(person.uid);
  const formResponseRef = db.collection("FormResponse").doc(person.uid);

  const participantSnap = await participantRef.get();
  const formResponseSnap = await formResponseRef.get();

  const participantDoc = {
    ...person.participantDoc,
    updatedAt: timestamp,
    ...(!participantSnap.exists ? { createdAt: timestamp } : {}),
  };

  const formResponseDoc = {
    ...person.formResponseDoc,
    updatedAt: timestamp,
    ...(!formResponseSnap.exists ? { createdAt: timestamp } : {}),
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(participantRef, participantDoc, { merge: true });
    transaction.set(formResponseRef, formResponseDoc, { merge: true });
  });

  console.log(`Seeded Firestore docs for ${person.uid} (${person.displayName})`);
}

async function main() {
  console.log(
    `${dryRun ? "Checking" : "Seeding"} ${demoParticipants.length} demo participants in Firestore...`,
  );

  for (const person of demoParticipants) {
    await seedParticipant(person);
  }

  console.log(dryRun ? "Dry run complete." : "Firestore seeding complete.");
}

main().catch((error) => {
  console.error("Failed to seed demo participants in Firestore:", error);
  process.exitCode = 1;
});
