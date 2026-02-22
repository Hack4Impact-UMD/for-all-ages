import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCeqsJjGwKfdlwgIl0u9GcTlEKh1vLC7J4",
  authDomain: "for-all-ages-8a4e2.firebaseapp.com",
  projectId: "for-all-ages-8a4e2",
  storageBucket: "for-all-ages-8a4e2.firebasestorage.app",
  messagingSenderId: "42404028579",
  appId: "1:42404028579:web:420352547a979fce631f16",
  measurementId: "G-122Y7GEE6Q"
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
  "https://us-central1-for-all-ages-8a4e2.cloudfunctions.net/matchAll";
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
  "https://us-central1-for-all-ages-8a4e2.cloudfunctions.net/upsertUser";

export async function upsertUser(body: { uid: string; freeResponse: string; q1: number, q2: number, q3: number, user_type: string }) {
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


export async function getUser(uid: string) {
  const userRef = doc(db, "participants", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error(`User with uid ${uid} not found`);
  }

  return snapshot.data();
}
