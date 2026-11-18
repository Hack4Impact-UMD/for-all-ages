// One-off backfill: copies each student's school answer from FormResponse onto
// participants/{uid}.school, which campus rosters read.
//
// Dry run (default, prints what would change):
//   node scripts/backfill-school.mjs --project <project-id>
// Apply:
//   node scripts/backfill-school.mjs --project <project-id> --write
//
// Uses application default credentials (gcloud auth application-default login).

import admin from "firebase-admin";

const args = process.argv.slice(2);
const projectIndex = args.indexOf("--project");
const projectId = projectIndex >= 0 ? args[projectIndex + 1] : undefined;
const write = args.includes("--write");

if (!projectId || projectId.startsWith("--")) {
  console.error("Usage: node scripts/backfill-school.mjs --project <project-id> [--write]");
  process.exit(1);
}

admin.initializeApp({ projectId });
const db = admin.firestore();

const normalize = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

async function findSchoolQuestionTitle() {
  const formSnap = await db.doc("config/registrationForm").get();
  const form = formSnap.data() ?? {};
  // Older forms stored a flat questions list instead of sections.
  const sections = Array.isArray(form.sections)
    ? form.sections
    : [{ questions: form.questions ?? [] }];
  for (const section of sections) {
    for (const question of section.questions ?? []) {
      if (question.lockedKey === "school") return question.title;
    }
  }
  return null;
}

async function main() {
  console.log(`Project: ${projectId}${write ? " (WRITING)" : " (dry run)"}`);

  const schoolTitle = await findSchoolQuestionTitle();
  if (!schoolTitle) {
    console.error("No question with lockedKey \"school\" in config/registrationForm.");
    process.exit(1);
  }
  console.log(`School question: "${schoolTitle}"`);
  const titleKey = normalize(schoolTitle);

  const responses = await db.collection("FormResponse").get();
  let changed = 0;
  let unchanged = 0;
  let noAnswer = 0;
  let noParticipant = 0;

  const answers = [];
  for (const responseDoc of responses.docs) {
    const questions = responseDoc.get("questions");
    const entry = Array.isArray(questions)
      ? questions.find((q) => normalize(q?.title) === titleKey)
      : undefined;
    const school =
      typeof entry?.answer === "string" && entry.answer.trim()
        ? entry.answer.trim()
        : null;
    if (school) {
      answers.push({ id: responseDoc.id, school });
    } else {
      noAnswer += 1;
    }
  }

  // Read participants in batches and write through a BulkWriter rather than
  // one round trip per response.
  const writer = write ? db.bulkWriter() : null;
  const BATCH = 300;
  for (let i = 0; i < answers.length; i += BATCH) {
    const batch = answers.slice(i, i + BATCH);
    const snaps = await db.getAll(
      ...batch.map(({ id }) => db.collection("participants").doc(id)),
    );
    snaps.forEach((participantSnap, index) => {
      const { id, school } = batch[index];
      if (!participantSnap.exists) {
        noParticipant += 1;
        return;
      }
      const current = participantSnap.get("school") ?? null;
      if (current === school) {
        unchanged += 1;
        return;
      }
      console.log(`${id}: ${JSON.stringify(current)} -> ${JSON.stringify(school)}`);
      writer?.set(participantSnap.ref, { school }, { merge: true });
      changed += 1;
    });
  }
  await writer?.close();

  console.log("");
  console.log(`FormResponse docs:        ${responses.size}`);
  console.log(`${write ? "Updated" : "Would update"}: ${changed}`);
  console.log(`Already correct:          ${unchanged}`);
  console.log(`No school answer:         ${noAnswer}`);
  console.log(`No participant doc:       ${noParticipant}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
