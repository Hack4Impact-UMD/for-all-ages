// Role names are stored inconsistently ("Admin", "Subadmin", "sub-admin"),
// so always compare through these helpers. functions/src/roles.ts is the
// server copy; keep normalizeRole identical in both.

/** The roles an admin can give someone from the Users page. */
export type AssignableRole = "Admin" | "Subadmin" | "Participant";

/** Lower-cased with all whitespace removed, so "Sub Admin" and "subadmin" match. */
export function normalizeRole(role?: unknown): string {
  return typeof role === "string" ? role.replace(/\s+/g, "").toLowerCase() : "";
}

/** The role a stored `role` value stands for ("" or anything unknown is a Participant). */
export function toAssignableRole(role?: unknown): AssignableRole {
  const normalized = normalizeRole(role);
  if (normalized === "admin") return "Admin";
  if (normalized === "subadmin" || normalized === "sub-admin") return "Subadmin";
  return "Participant";
}

export function isAdminRole(role?: string | null) {
  return toAssignableRole(role) !== "Participant";
}

export function isSubadminRole(role?: string | null) {
  return toAssignableRole(role) === "Subadmin";
}

// Whether sub-admins may delete and place participants. Flip this together
// with the server copy in functions/src/roles.ts, which enforces it; setting
// both to true restores the old behaviour (sub-admins get the full Users page).
export const SUBADMIN_CAN_MANAGE_PARTICIPANTS = false;
