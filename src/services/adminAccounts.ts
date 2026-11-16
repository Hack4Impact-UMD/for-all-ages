import { initializeApp, deleteApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteField,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import type { Role, InviteAdminParams } from "../types";

export type AdminRole = Role;

// Invariant: role changes write only `role`, `university` and
// `participantOptIn`. Never write `type`, `user_type` or `school` here; those
// record whether and how someone registered as a participant, which is
// independent of their role.

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

/**
 * Promotes an existing participant to Subadmin while preserving all of their
 * participant data (user_type, matches, etc.) so they keep participating normally.
 * They are already a participant, so they are opted in and can re-register
 * next cohort.
 */
export async function promoteParticipantToSubadmin(params: {
  participantId: string;
  university?: string | null;
}): Promise<void> {
  const docRef = doc(db, "participants", params.participantId);
  await setDoc(
    docRef,
    {
      role: "Subadmin" as Role,
      university: params.university?.trim() || null,
      participantOptIn: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true } // merge: true ensures all existing participant fields are kept
  );
}

/**
 * Demotes an existing sub-admin to participant while preserving all
 * of their data (user_type, matches, etc) so they keep participating normally.
 * Only the role field is changed - nothing else is touched.
 *  */ 
export async function demoteSubadminToParticipant(subadminId: string): Promise<void>{
  const docRef = doc(db, "participants", subadminId);
  await setDoc(
    docRef,
    {
      role: "Participant" as Role,
      university: deleteField(),
      participantOptIn: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true } // merge: true ensures all existing participant fields are kept
  );
}

export async function assignAdminRoleToExistingUser(params: {
  participantId: string;
  firstName?: string;
  lastName?: string;
  role: AdminRole;
  university?: string | null;
  participantOptIn?: boolean;
}) {
  const displayName = `${params.firstName ?? ""} ${params.lastName ?? ""}`
    .replace(/\s+/g, " ")
    .trim();

  const payload: Record<string, unknown> = {
    role: params.role,
    university: params.role === "Subadmin" ? params.university ?? null : null,
    updatedAt: serverTimestamp(),
    status: "Active",
  };
  const docRef = doc(db, "participants", params.participantId);
  if (params.role === "Subadmin") {
    // Someone already registered this cohort is a participant, so keep them
    // opted in (as promoteParticipantToSubadmin does) whatever the form said.
    const alreadyRegistered = (await getDoc(docRef)).data()?.type === "Participant";
    if (alreadyRegistered) {
      payload.participantOptIn = true;
    } else if (params.participantOptIn !== undefined) {
      payload.participantOptIn = params.participantOptIn;
    }
  }

  if (displayName) {
    payload.displayName = displayName;
  }
  if (params.firstName) payload.firstName = params.firstName;
  if (params.lastName) payload.lastName = params.lastName;

  await setDoc(docRef, payload, { merge: true });
}

// Lets a sub-admin who isn't registered yet go through the registration form
// (or stops them from being asked to).
export async function setSubadminParticipantOptIn(
  participantId: string,
  enabled: boolean,
): Promise<void> {
  const docRef = doc(db, "participants", participantId);
  if (enabled) {
    await setDoc(
      docRef,
      { participantOptIn: true, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return;
  }

  // A sub-admin can be part-way through registering: the capacity check ran
  // (and may have counted them or put them on the waitlist) but the submit
  // failed before it finished. Opting them out then has to give that spot
  // back, or currentParticipants stays one too high.
  const programStateRef = doc(db, "config", "programState");
  const waitlistRef = doc(db, "waitlist", participantId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const data = snap.data();
    if (data?.type === "Participant") {
      throw new Error("This sub-admin has already registered.");
    }
    if (data?.capacityDecision === "counted") {
      const programSnap = await transaction.get(programStateRef);
      if ((programSnap.data()?.currentParticipants ?? 0) > 0) {
        transaction.update(programStateRef, { currentParticipants: increment(-1) });
      }
    } else if (data?.capacityDecision === "waitlisted") {
      transaction.delete(waitlistRef);
    }
    transaction.set(
      docRef,
      {
        participantOptIn: false,
        capacityDecision: deleteField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}
