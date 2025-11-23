import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

// URL of your deployed HTTP function
const TEST_CONNECTION_URL =
  "https://us-central1-for-all-ages-8a4e2.cloudfunctions.net/testConnection";

// Helper to call Cloud Function using fetch()
export async function testConnectionFetch(body: any = {}) {
  const res = await fetch(TEST_CONNECTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }

  return res.json();
}
