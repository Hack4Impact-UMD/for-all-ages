// Manage Users role select and ChangeRoleModal. Firebase, auth and the callable are mocked.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, waitFor, screen, cleanup, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  listeners: {} as Record<string, (snap: any) => void>,
  auth: { user: { uid: "me", email: "me@x.org" }, isSubadmin: false, programState: null as any },
  changeUserRole: null as any,
}));

const snapOf = (rows: Array<{ id: string; data: Record<string, unknown> }>) => ({
  docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
});

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ path: name }),
  onSnapshot: (ref: { path: string }, next: (s: any) => void) => {
    h.listeners[ref.path] = next;
    return () => {};
  },
  query: (ref: unknown) => ref,
  where: () => ({}),
  getDocs: async () => ({ empty: true, docs: [] }),
  doc: () => ({}),
  getDoc: async () => ({ data: () => ({}) }),
  setDoc: async () => {},
  runTransaction: async () => {},
  increment: (n: number) => n,
  serverTimestamp: () => "TS",
  deleteField: () => "DEL",
}));
vi.mock("../../src/firebase", () => ({
  db: {},
  auth: {},
  assignUserType: vi.fn(),
  deleteUser: vi.fn(),
  changeUserRole: (...a: any[]) => h.changeUserRole(...a),
}));
vi.mock("../../src/auth/AuthProvider", () => ({ useAuth: () => h.auth }));
vi.mock("../../src/pages/Registration/helpers", () => ({
  getUniversityOptions: async () => ["UMD", "Towson"],
}));

import AdminCreator from "../../src/pages/Users/AdminCreator";

const ROWS = [
  { id: "me", data: { displayName: "Me Admin", role: "Admin", type: "Admin", hasAuthAccount: undefined } },
  { id: "adm", data: { displayName: "Other Admin", role: "Admin", type: "Admin" } },
  { id: "sub", data: { displayName: "Sub Person", role: "Subadmin", type: "Admin", participantOptIn: false } },
  { id: "reg", data: { displayName: "Registered Rita", role: "Participant", type: "Participant", user_type: "student" } },
  { id: "wait", data: { displayName: "Waitlisted Walt", role: "Participant", type: "Participant", user_type: "adult" } },
  { id: "man", data: { displayName: "Manual Mary", role: "Participant", type: "Participant", user_type: "adult", hasAuthAccount: false, isManualEntry: true } },
];

const emit = (rows = ROWS) =>
  act(() => {
    h.listeners.participants(snapOf(rows));
    h.listeners.waitlist({ docs: [{ id: "wait" }] });
  });

const roleSelect = (name: string) => screen.getByLabelText(`Change role for ${name}`) as HTMLSelectElement;

async function setup() {
  render(
    <MemoryRouter>
      <AdminCreator />
    </MemoryRouter>,
  );
  await emit();
}

beforeEach(() => {
  h.auth = { user: { uid: "me", email: "me@x.org" }, isSubadmin: false, programState: null };
  h.changeUserRole = vi.fn().mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe("Manage Users role select", () => {
  it("shows a select for other users, but plain text for your own and waitlisted rows", async () => {
    await setup();
    expect(roleSelect("Other Admin").value).toBe("Admin");
    expect(roleSelect("Registered Rita").value).toBe("Participant");
    expect(screen.queryByLabelText("Change role for Me Admin")).toBeNull();
    expect(screen.getByText(/Admin \(you\)/)).toBeTruthy();
    expect(screen.queryByLabelText("Change role for Waitlisted Walt")).toBeNull();
  });

  it("shows no selects to a sub-admin viewer", async () => {
    h.auth.isSubadmin = true;
    await setup();
    expect(screen.queryAllByLabelText(/Change role for/)).toHaveLength(0);
  });

  it("disables the current role, and Admin/Subadmin for manual-entry users", async () => {
    await setup();
    const opts = (name: string) =>
      Object.fromEntries(Array.from(roleSelect(name).options).map((o) => [o.value, o.disabled]));
    expect(opts("Other Admin")).toEqual({ Admin: true, Subadmin: false, Participant: false });
    expect(opts("Manual Mary")).toEqual({ Admin: true, Subadmin: true, Participant: true });
    expect(opts("Registered Rita")).toEqual({ Admin: false, Subadmin: false, Participant: true });
  });

  it("no longer renders Promote or Demote buttons", async () => {
    await setup();
    expect(screen.queryByText("Promote")).toBeNull();
    expect(screen.queryByText("Demote")).toBeNull();
  });

  it("Admin -> Participant: warns and calls the function without a university", async () => {
    await setup();
    fireEvent.change(roleSelect("Other Admin"), { target: { value: "Participant" } });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/lose admin access/)).toBeTruthy();
    expect(within(dialog).getByText(/need to register to participate\./)).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Confirm"));
    await waitFor(() => expect(h.changeUserRole).toHaveBeenCalledWith("adm", "Participant", undefined));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Other Admin is now a Participant.")).toBeTruthy();
  });

  it("adds the signups-closed warning when registration is closed", async () => {
    h.auth.programState = { matches_final: true };
    await setup();
    fireEvent.change(roleSelect("Other Admin"), { target: { value: "Participant" } });
    expect(await screen.findByText(/cannot complete registration until signups reopen/)).toBeTruthy();
  });

  it("registered Participant -> Admin warns about matching and the dashboard", async () => {
    await setup();
    fireEvent.change(roleSelect("Registered Rita"), { target: { value: "Admin" } });
    expect(await screen.findByText(/remain eligible for matching, but will no longer have access to the participant dashboard/)).toBeTruthy();
  });

  it("-> Subadmin requires a university and sends it", async () => {
    await setup();
    fireEvent.change(roleSelect("Registered Rita"), { target: { value: "Subadmin" } });
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByText("Confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await waitFor(() => expect(within(dialog).getByText("Towson")).toBeTruthy());
    fireEvent.change(within(dialog).getByLabelText("University"), { target: { value: "Towson" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(h.changeUserRole).toHaveBeenCalledWith("reg", "Subadmin", "Towson"));
  });

  it("Cancel closes the modal, calls nothing, and leaves the select on the live role", async () => {
    await setup();
    fireEvent.change(roleSelect("Other Admin"), { target: { value: "Participant" } });
    fireEvent.click(await screen.findByText("Cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(h.changeUserRole).not.toHaveBeenCalled();
    expect(roleSelect("Other Admin").value).toBe("Admin");
  });

  it("shows the function's message inline on a known error, and keeps the modal open", async () => {
    const { FirebaseError } = await import("firebase/app");
    h.changeUserRole = vi.fn().mockRejectedValue(new FirebaseError("functions/failed-precondition", "Waitlisted users can't have their role changed."));
    await setup();
    fireEvent.change(roleSelect("Other Admin"), { target: { value: "Participant" } });
    fireEvent.click(await screen.findByText("Confirm"));
    expect(await screen.findByText("Waitlisted users can't have their role changed.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows a generic message for unexpected errors", async () => {
    h.changeUserRole = vi.fn().mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await setup();
    fireEvent.change(roleSelect("Other Admin"), { target: { value: "Participant" } });
    fireEvent.click(await screen.findByText("Confirm"));
    expect(await screen.findByText("Could not change this role. Please try again.")).toBeTruthy();
  });

  it("keeps the select disabled as 'Updating…' until the snapshot shows the new role", async () => {
    await setup();
    fireEvent.change(roleSelect("Other Admin"), { target: { value: "Participant" } });
    fireEvent.click(await screen.findByText("Confirm"));
    await waitFor(() => expect(roleSelect("Other Admin").disabled).toBe(true));
    expect(screen.getByText("Updating…")).toBeTruthy();
    await emit(ROWS.map((r) => (r.id === "adm" ? { ...r, data: { ...r.data, role: "Participant" } } : r)));
    await waitFor(() => expect(roleSelect("Other Admin").disabled).toBe(false));
    expect(roleSelect("Other Admin").value).toBe("Participant");
    expect(screen.queryByText("Updating…")).toBeNull();
  });
});

describe("Manage Users pending role lifecycle", () => {
  const asParticipant = (rows = ROWS) =>
    rows.map((r) => (r.id === "adm" ? { ...r, data: { ...r.data, role: "Participant" } } : r));

  async function confirmAdminToParticipant() {
    fireEvent.change(roleSelect("Other Admin"), { target: { value: "Participant" } });
    fireEvent.click(await screen.findByText("Confirm"));
  }

  it("clears when the snapshot arrives before the callable resolves", async () => {
    let resolveCall!: (v: unknown) => void;
    h.changeUserRole = vi.fn().mockReturnValue(new Promise((r) => (resolveCall = r)));
    await setup();
    await confirmAdminToParticipant();
    await waitFor(() => expect(h.changeUserRole).toHaveBeenCalled());
    await emit(asParticipant());
    await act(async () => resolveCall({ success: true, changed: true, role: "Participant" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(roleSelect("Other Admin").disabled).toBe(false));
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(roleSelect("Other Admin").value).toBe("Participant");
  });

  it("stays disabled after the callable resolves until the snapshot confirms", async () => {
    h.changeUserRole = vi.fn().mockResolvedValue({ success: true, changed: true });
    await setup();
    await confirmAdminToParticipant();
    await waitFor(() => expect(screen.getByText("Updating…")).toBeTruthy());
    expect(roleSelect("Other Admin").disabled).toBe(true);
    await emit(asParticipant());
    await waitFor(() => expect(roleSelect("Other Admin").disabled).toBe(false));
    expect(screen.queryByText("Updating…")).toBeNull();
  });

  it("never goes pending when the callable reports changed: false", async () => {
    h.changeUserRole = vi.fn().mockResolvedValue({ success: true, changed: false, role: "Participant" });
    await setup();
    await confirmAdminToParticipant();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(roleSelect("Other Admin").disabled).toBe(false);
  });

  it("never goes pending when the callable rejects", async () => {
    h.changeUserRole = vi.fn().mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await setup();
    await confirmAdminToParticipant();
    expect(await screen.findByText("Could not change this role. Please try again.")).toBeTruthy();
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(roleSelect("Other Admin").disabled).toBe(false);
  });
});
