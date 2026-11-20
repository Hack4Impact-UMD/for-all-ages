// Add User when the email already has an account: names are hidden (nothing
// writes them), the role goes through assignAdminRoleToExistingUser, and the
// server's messages are shown.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FirebaseError } from "firebase/app";

const h = vi.hoisted(() => ({
  invite: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  query: (r: unknown) => r,
  where: () => ({}),
  getDocs: async () => ({ empty: false, docs: [{ id: "u1", data: () => ({ role: "Participant" }) }] }),
}));
vi.mock("../../src/firebase", () => ({ db: {} }));
vi.mock("../../src/auth/AuthProvider", () => ({
  useAuth: () => ({ programState: null, programStateLoading: false }),
}));
vi.mock("../../src/pages/Registration/helpers", () => ({
  getUniversityOptions: async () => ["UMD", "Towson"],
}));
vi.mock("../../src/services/adminAccounts", () => ({
  inviteAdminAccount: (...a: unknown[]) => h.invite(...a),
  assignAdminRoleToExistingUser: (...a: unknown[]) => h.assign(...a),
}));

import AddUserModal from "../../src/pages/Users/AddUserModal";

beforeEach(() => {
  h.invite = vi.fn().mockRejectedValue(new FirebaseError("auth/email-already-in-use", "in use"));
  h.assign = vi.fn().mockResolvedValue({ success: true, changed: true, role: "Admin" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function reachExistingPrompt(onSuccess = vi.fn()) {
  render(
    <MemoryRouter>
      <AddUserModal onClose={() => {}} onSuccess={onSuccess} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("First Name"), { target: { name: "firstName", value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last Name"), { target: { name: "lastName", value: "Lovelace" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { name: "email", value: "ada@x.org" } });
  fireEvent.click(screen.getByText("Admin", { selector: "span" }));
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
  await screen.findByText("Yes, update");
  return onSuccess;
}

describe("Add User for an existing account", () => {
  it("hides the name fields once an existing account is detected, and restores them on 'No'", async () => {
    await reachExistingPrompt();
    expect(screen.queryByLabelText("First Name")).toBeNull();
    expect(screen.queryByLabelText("Last Name")).toBeNull();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    fireEvent.click(screen.getByText("No, keep current role"));
    expect((screen.getByLabelText("First Name") as HTMLInputElement).value).toBe("Ada");
  });

  it("sends only the role (no names) and reports the email", async () => {
    const onSuccess = await reachExistingPrompt();
    fireEvent.click(screen.getByText("Yes, update"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("Updated ada@x.org to Admin."));
    expect(h.assign).toHaveBeenCalledWith({
      participantId: "u1",
      role: "Admin",
      university: undefined,
      participantOptIn: undefined,
    });
  });

  it("says so when the account already has that role", async () => {
    h.assign.mockResolvedValue({ success: true, changed: false, role: "Admin" });
    const onSuccess = await reachExistingPrompt();
    fireEvent.click(screen.getByText("Yes, update"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("ada@x.org is already an Admin."));
  });

  it("shows the server's message for a known rejection, and a generic one otherwise", async () => {
    h.assign.mockRejectedValueOnce(new FirebaseError("functions/invalid-argument", "Cannot change your own role."));
    await reachExistingPrompt();
    fireEvent.click(screen.getByText("Yes, update"));
    expect(await screen.findByText("Cannot change your own role.")).toBeTruthy();
    h.assign.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(screen.getByText("Yes, update"));
    expect(await screen.findByText("We couldn't update the existing account. Please try again.")).toBeTruthy();
  });
});
