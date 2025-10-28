import { auth, db } from "./firebase"
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"

// Sign up with email verification
export const signUpUser = async (email: string, password: string) => {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(userCred.user);
  return userCred.user;
};

// Log in user
export const loginUser = async (email: string, password: string) => {
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred.user;
};

// Save user info to Firestore
export const saveUser = async (userUid: string, data: any) => {
  const usertRef = doc(db, "users", userUid);
  await setDoc(usertRef, {
    ...data,
    type: "Participant",
    createdAt: new Date().toISOString(),
  }, { merge: true });
};

// Check if user already exists
export const getUser = async (userUid: string) => {
  const docRef = doc(db, "user", userUid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

export { auth, db };