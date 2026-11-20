import { initializeApp, deleteApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, changeUserRole, db } from "../firebase";
import type { Role, InviteAdminParams } from "../types";

export type AdminRole = Role;

// Invariant: role changes (here and in the changeUserRole function) write only
// `role`, `university` and `participantOptIn`. Never write `type`, `user_type`
// or `school` here; those record whether and how someone registered as a
// participant, which is independent of their role.

type SecondaryAuthBundle = {
  app: FirebaseApp;
  /** Auth instance scoped to the secondary app so the primary session stays untouched */
  auth: ReturnType<typeof getAuth>;
};

// Creates a secondary Firebase app and returns its Auth instance
// Used to create new users without affecting the current user's session
function createSecondaryAuth(): SecondaryAuthBundle {
  const appName = `faa-admin-secondary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const app = initializeApp(auth.app.options, appName);
  const secondaryAuth = getAuth(app);
  return { app, auth: secondaryAuth };
}

// Generates a temporary password for new admin accounts
function generateTempPassword(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `Temp-${randomPart}-${suffix}`;
}

// Invites a new admin account by creating a Firebase Auth user and storing their details in Firestore
export async function inviteAdminAccount(params: InviteAdminParams) {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const email = params.email.trim().toLowerCase();
  const isSubadmin = params.role === "Subadmin";
  const university = isSubadmin ? params.university?.trim() || null : null;

  const displayName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  const { app: secondaryApp, auth: secondaryAuth } = createSecondaryAuth();

  // Create the user in Firebase Auth using the secondary auth instance
  try {
    const tempPassword = generateTempPassword();
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      tempPassword
    );

    const timestamp = serverTimestamp();
    const participantRef = doc(db, "participants", credential.user.uid);
    await setDoc(
      participantRef,
      {
        type: "Admin",
        firstName,
        lastName,
        displayName,
        email,
        role: params.role,
        university,
        ...(isSubadmin ? { participantOptIn: params.participantOptIn === true } : {}),
        status: "Invited",
        invitedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true }
    );

    // Send password reset email to the new admin so they can set their own password
    await sendPasswordResetEmail(secondaryAuth, email);
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch {
      // No-op: secondary session cleanup failure is non-critical
    }
    // Delete the secondary app to free up resources
    await deleteApp(secondaryApp);
  }
}

// Goes through the changeUserRole function so an existing account gets the
// same checks as the Users page: full admins only, no changing your own role,
// no waitlisted users, and capacity released when an unfinished registration
// is promoted to Admin. For someone already a Sub-admin it updates their
// college and opt-in instead. The name and status fields the old direct write set
// are left alone; the account already has a profile.
export async function assignAdminRoleToExistingUser(params: {
  participantId: string;
  role: AdminRole;
  university?: string | null;
  participantOptIn?: boolean;
}) {
  return changeUserRole(
    params.participantId,
    params.role,
    params.role === "Subadmin" ? params.university?.trim() || undefined : undefined,
    params.role === "Subadmin" ? params.participantOptIn : undefined,
  );
}
