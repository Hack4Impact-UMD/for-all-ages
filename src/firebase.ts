// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);
export const auth = getAuth(app);