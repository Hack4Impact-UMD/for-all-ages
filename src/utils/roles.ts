// Role names are stored inconsistently ("Admin", "Subadmin", "sub-admin"),
// so always compare through these helpers.

export function isAdminRole(role?: string | null) {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "subadmin" ||
    normalized === "sub-admin"
  );
}

export function isSubadminRole(role?: string | null) {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized === "subadmin" || normalized === "sub-admin";
}

// Whether sub-admins may delete and place participants. Flip this together
// with the server copy in functions/src/roles.ts; setting both to true
// restores the old behaviour (sub-admins get the full Users page).
export const SUBADMIN_CAN_MANAGE_PARTICIPANTS = false;

export function canManageParticipants(role?: string | null) {
  if (role?.toLowerCase() === "admin") return true;
  return SUBADMIN_CAN_MANAGE_PARTICIPANTS && isSubadminRole(role);
}
