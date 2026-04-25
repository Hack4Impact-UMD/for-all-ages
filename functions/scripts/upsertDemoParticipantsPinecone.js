const { demoParticipants } = require("./demoParticipants.js");

const DEFAULT_UPSERT_USER_URL =
  "https://us-central1-for-all-ages-8a4e2.cloudfunctions.net/upsertUser";

const dryRun = process.argv.includes("--dry-run");
const upsertUserUrl = process.env.UPSERT_USER_URL || DEFAULT_UPSERT_USER_URL;

async function upsertParticipant(person) {
  if (dryRun) {
    console.log(
      `[dry-run] Would upsert ${person.uid} with payload: ${JSON.stringify(person.pineconePayload)}`,
    );
    return;
  }

  const response = await fetch(upsertUserUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(person.pineconePayload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`upsertUser failed for ${person.uid}: ${response.status} ${body}`);
  }

  const body = await response.json().catch(() => ({}));
  console.log(`Upserted Pinecone vector for ${person.uid}: ${JSON.stringify(body)}`);
}

async function main() {
  console.log(
    `${dryRun ? "Checking" : "Upserting"} ${demoParticipants.length} demo participants via ${upsertUserUrl}...`,
  );

  for (const person of demoParticipants) {
    await upsertParticipant(person);
  }

  console.log(dryRun ? "Dry run complete." : "Pinecone upsert complete.");
}

main().catch((error) => {
  console.error("Failed to upsert demo participants in Pinecone:", error);
  process.exitCode = 1;
});
