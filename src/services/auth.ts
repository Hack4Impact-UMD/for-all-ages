import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { friendlyAuthError } from "../utils/firebaseErrors";

export { friendlyAuthError };

export async function loginWithEmailPassword(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signupWithEmailPassword(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const { firstName, lastName, email, password } = params;
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const displayName = `${firstName} ${lastName}`.trim();
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  await sendEmailVerification(credential.user);
  return credential;
}

export async function resendVerificationEmail(user: User) {
  return sendEmailVerification(user);
}

export async function refreshCurrentUser() {
  if (!auth.currentUser) return;
  await auth.currentUser.reload();
  return auth.currentUser;
}


