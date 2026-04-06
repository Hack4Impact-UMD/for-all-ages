import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAPDsR_t-09BU8UI-MANrjz_gMGe0ejjKM",
  authDomain: "for-all-ages-prd.firebaseapp.com",
  projectId: "for-all-ages-prd",
  storageBucket: "for-all-ages-prd.firebasestorage.app",
  messagingSenderId: "1042249208676",
  appId: "1:1042249208676:web:b79984db47d61aad1be071",
  measurementId: "G-8FYKX9LMC0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let analytics;

if (typeof window !== "undefined") {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      // No-op if analytics not supported
    });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export { analytics };

// FUNCTIONS
const MATCHING_URL =
  // "https://us-central1-for-all-ages-8a4e2.cloudfunctions.net/matchAllWithGender";
  "https://us-central1-for-all-ages-prd.cloudfunctions.net/matchAll";
export async function matchAll(body: any = {}) {
  const res = await fetch(MATCHING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }

  return res.json();
}


const UPSERT_USER_URL =
  "https://us-central1-for-all-ages-prd.cloudfunctions.net/upsertUser";
export async function upsertUser(body: {
  uid: string;
  textResponses?: string[];  // array of free-form text responses
  numericResponses?: number[];  // array of numeric responses
  user_type: string;
  pronouns: string;
}) {
  const res = await fetch(UPSERT_USER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upsertUser HTTP error ${res.status}: ${text}`);
  }

  return res.json().catch(() => ({}));
}


const COMPUTE_MATCH_SCORE_URL = 
  "https://us-central1-for-all-ages-prd.cloudfunctions.net/computeMatchScore";
export async function computeMatchScore(body: { uid1: string; uid2: string }) {
  const res = await fetch(COMPUTE_MATCH_SCORE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`computeMatchScore HTTP error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function deleteUser(targetUserId: string) {
  const callable = httpsCallable(functions, "deleteUser");
  const result = await callable({ targetUserId });
  return result.data;
}

export async function getUser(uid: string) {
  const userRef = doc(db, "participants", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error(`User with uid ${uid} not found`);
  }

  return snapshot.data();
}
