// @vitest-environment node
// Add User's "promote existing account" path must go through changeUserRole
// and never write the role from the client.
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ changeUserRole: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn() }));

vi.mock("firebase/firestore", () => ({
  doc: () => ({}),
  getDoc: vi.fn(),
  increment: (n: number) => n,
  runTransaction: vi.fn(),
  serverTimestamp: () => "TS",
  setDoc: h.setDoc,
  updateDoc: h.updateDoc,
  deleteField: () => "DEL",
}));
vi.mock("firebase/app", () => ({ initializeApp: vi.fn(), deleteApp: vi.fn() }));
vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  getAuth: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("../../src/firebase", () => ({
  auth: {},
  db: {},
  changeUserRole: (...a: unknown[]) => h.changeUserRole(...a),
}));

import { assignAdminRoleToExistingUser } from "../../src/services/adminAccounts";

beforeEach(() => {
  vi.clearAllMocks();
  h.changeUserRole.mockResolvedValue({ success: true, changed: true, role: "Admin" });
});

describe("assignAdminRoleToExistingUser", () => {
  it("routes an Admin assignment through changeUserRole with no client write", async () => {
    await assignAdminRoleToExistingUser({ participantId: "u1", role: "Admin" });
    expect(h.changeUserRole).toHaveBeenCalledWith("u1", "Admin", undefined, undefined);
    expect(h.setDoc).not.toHaveBeenCalled();
    expect(h.updateDoc).not.toHaveBeenCalled();
  });

  it("passes the trimmed university and opt-in choice for a Subadmin", async () => {
    await assignAdminRoleToExistingUser({ participantId: "u1", role: "Subadmin", university: " UMD ", participantOptIn: true });
    expect(h.changeUserRole).toHaveBeenCalledWith("u1", "Subadmin", "UMD", true);
  });

  it("drops a stray university/opt-in when the role is Admin", async () => {
    await assignAdminRoleToExistingUser({ participantId: "u1", role: "Admin", university: "UMD", participantOptIn: true });
    expect(h.changeUserRole).toHaveBeenCalledWith("u1", "Admin", undefined, undefined);
  });

  it("surfaces the function's rejection (e.g. self-change, waitlisted)", async () => {
    h.changeUserRole.mockRejectedValue(new Error("Cannot change your own role."));
    await expect(assignAdminRoleToExistingUser({ participantId: "me", role: "Admin" })).rejects.toThrow("Cannot change your own role.");
    expect(h.setDoc).not.toHaveBeenCalled();
  });
});
