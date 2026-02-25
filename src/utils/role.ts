export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalised = role.toLowerCase();
  return (
    normalised === "admin" ||
    normalised === "subadmin" ||
    normalised === "sub-admin"
  );
}
