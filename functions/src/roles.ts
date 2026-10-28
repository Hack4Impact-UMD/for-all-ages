import * as admin from "firebase-admin";

// Role names are stored inconsistently ("Admin", "Subadmin", "sub-admin"),
// so always compare through these helpers. src/utils/roles.ts is the client
// copy.

export function normalizeRole(role: unknown): string {
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

export function isAdminRole(role: unknown): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === "admin" ||
    normalized === "subadmin" ||
    normalized === "sub-admin"
  );
}

export function isFullAdminRole(role: unknown): boolean {
  return normalizeRole(role) === "admin";
}

/** The caller's normalized role from their participants doc ("" if none). */
export async function getCallerRole(uid: string): Promise<string> {
  const snap = await admin.firestore().collection("participants").doc(uid).get();
  return normalizeRole(snap.data()?.role);
}
