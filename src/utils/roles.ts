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
