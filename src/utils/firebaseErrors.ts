import { FirebaseError } from "firebase/app";

export const friendlyAuthError = (error: unknown) => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "That email is already registered. Try logging in instead.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Invalid email or password. Please try again.";
      case "auth/weak-password":
        return "Please choose a stronger password (at least 6 characters).";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment before trying again.";
      default:
        break;
    }
  }
  return "Something went wrong. Please try again.";
};



// changeUserRole's own messages are written for admins; show them as they are.
const SHOWN_FUNCTION_ERRORS = new Set([
  "functions/invalid-argument",
  "functions/failed-precondition",
  "functions/permission-denied",
  "functions/not-found",
]);

export const roleChangeError = (error: unknown, fallback: string) =>
  error instanceof FirebaseError && SHOWN_FUNCTION_ERRORS.has(error.code)
    ? error.message
    : fallback;
