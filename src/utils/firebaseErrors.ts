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


