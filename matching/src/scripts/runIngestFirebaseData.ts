import { ingestFromFirebase } from "../services/ingestFirebaseData.js";

ingestFromFirebase("participants-test")
  .then(() => {
    console.log("Ingestion completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Ingestion failed:", error);
    process.exit(1);
  });