import db from "../config/firebaseAdmin";
import type { ParticipantData } from "../utils/validator";
import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { createParticipantProfileText } from '../utils/textProcessor.js';
import { generateEmbeddingsBatch } from './embeddingService.js';
import { initializeIndex, upsertEmbeddings, checkIndexStatus } from './vectorService.js';


type FirebaseParticipant = {
  name: string;
  dateOfBirth: string;
  interests: string;
  quant1: number;
  quant2: number;
  quant3: number;
};

// internal type that includes Firestore doc ID
type FirebaseParticipantWithId = FirebaseParticipant & { id: string };

function calculateAge(dateOfBirth: string | any): number {
  let birthDate: Date;
  
  if (dateOfBirth?.toDate) {
    birthDate = dateOfBirth.toDate();
  } else if (typeof dateOfBirth === 'string') {
    birthDate = new Date(dateOfBirth);
  } else {
    console.warn('Invalid dateOfBirth format:', dateOfBirth);
    return 0;
  }
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}


/**
 * Converts Firebase participant to ParticipantData format
 */
function transformFirebaseToParticipantData(
  firebaseData: FirebaseParticipantWithId
): ParticipantData {
  const frqResponse = firebaseData.interests;
  const participantType = calculateAge(firebaseData.dateOfBirth) < 50 ? "student" : "senior";

  return {
    name: firebaseData.name,
    participantId: firebaseData.id,
    type: participantType,
    freeResponse: frqResponse,
    q1: firebaseData.quant1,
    q2: firebaseData.quant2,
    q3: firebaseData.quant3,
  };
}

/**
 * Fetches all participants from Firebase and transforms them
 */
export async function getParticipantsForPinecone(
  collectionName: string = "participants-test"
): Promise<ParticipantData[]> {
  try {
    console.log(
      `Fetching participants from Firebase collection: ${collectionName}`
    );

    const snapshot = await db.firestore().collection(collectionName).get();

    const firebaseParticipants: FirebaseParticipantWithId[] = snapshot.docs.map(
      (doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data() as FirebaseParticipant;
        return { id: doc.id, ...data };
      }
    );

    console.log(
      `Fetched ${firebaseParticipants.length} participants from Firebase`
    );

    const participantData = firebaseParticipants.map(
      transformFirebaseToParticipantData
    );

    const youngCount = participantData.filter((p) => p.type === "young").length;
    const olderCount = participantData.filter((p) => p.type === "older").length;

    console.log(`Transformed ${participantData.length} participants:`);
    console.log(`  - Young (< 50): ${youngCount}`);
    console.log(`  - Older (>= 50): ${olderCount}`);

    return participantData;
  } catch (error) {
    console.error("Error fetching participants from Firebase:", error);
    throw error;
  }
}

/**
 * Complete Firebase to Pinecone pipeline
 */
export async function ingestFromFirebase(
  collectionName: string = "participants-test"
): Promise<void> {
  try {
    console.log("=== Starting Firebase → Pinecone Ingestion ===");

    const participants = await getParticipantsForPinecone(collectionName);

    if (participants.length === 0) {
      console.warn("No participants found in Firebase");
      return;
    }

    console.log(`Ready to process ${participants.length} participants`);
    
    // Step 1: Create profile texts
    console.log("\n1. Creating participant profile texts...");
    const profileTexts = participants.map((participant) =>
      createParticipantProfileText(participant)
    );
    console.log(`✓ Created ${profileTexts.length} profile texts`);

    // Step 2: Generate embeddings
    console.log("\n2. Generating embeddings...");
    const embeddings = await generateEmbeddingsBatch(profileTexts);
    console.log(`✓ Generated ${embeddings.length} embeddings`);

    // Step 3: Initialize index
    console.log("\n3. Initializing Pinecone index...");
    await initializeIndex();
    console.log("✓ Index initialized");

    // Step 4: Check index status
    console.log("\n4. Checking index status...");
    const indexStatus = await checkIndexStatus();
    console.log(`✓ Index status: ${JSON.stringify(indexStatus)}`);

    // Step 5: Upsert embeddings
    console.log("\n5. Upserting embeddings to Pinecone...");
    await upsertEmbeddings(participants, embeddings);
    console.log(`✓ Upserted ${participants.length} embeddings`);

    console.log("\n=== Firebase → Pinecone Ingestion Complete ===");
  } catch (error) {
    console.error("Firebase ingestion failed:", error);
    throw error;
  }
}