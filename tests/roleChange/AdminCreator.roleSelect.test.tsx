// Manage Users role select and ChangeRoleModal. Firebase, auth and the callable are mocked.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, waitFor, screen, cleanup, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  listeners: {} as Record<string, (snap: any) => void>,
  auth: { user: { uid: "me", email: "me@x.org" }, isSubadmin: false, programState: null as any },
  changeUserRole: null as any,
  setOptIn: vi.fn(),
  getUniversityOptions: vi.fn(),
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
  setSubadminParticipantOptIn: (...a: any[]) => h.setOptIn(...a),
}));
vi.mock("../../src/auth/AuthProvider", () => ({ useAuth: () => h.auth }));
vi.mock("../../src/pages/Registration/helpers", () => ({
  getUniversityOptions: () => h.getUniversityOptions(),
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

const editButton = (name: string) => screen.getByLabelText(`Change role for ${name}`) as HTMLButtonElement;

// Opens the edit dialog for `name` and picks the new role in its dropdown.
async function pick(name: string, role: string) {
  fireEvent.click(editButton(name));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("New role"), { target: { value: role } });
  return dialog;
}

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
  h.setOptIn = vi.fn().mockResolvedValue(undefined);
  h.getUniversityOptions = vi.fn().mockResolvedValue(["UMD", "Towson"]);
});
afterEach(cleanup);

describe("Manage Users role select", () => {
  it("shows an edit button for other users, but none for your own and waitlisted rows", async () => {
    await setup();
    expect(editButton("Other Admin")).toBeTruthy();
    expect(editButton("Registered Rita")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /Change role/ })).toBeNull();
    expect(screen.queryByLabelText("Change role for Me Admin")).toBeNull();
    expect(screen.getByText(/Admin \(you\)/)).toBeTruthy();
    expect(screen.queryByLabelText("Change role for Waitlisted Walt")).toBeNull();
  });

  it("shows no selects to a sub-admin viewer", async () => {
    h.auth.isSubadmin = true;
    await setup();
    expect(screen.queryAllByLabelText(/Change role for/)).toHaveLength(0);
  });

  it("offers every role but the current one, and no edit button for manual-entry users", async () => {
    await setup();
    const opts = async (name: string) => {
      fireEvent.click(editButton(name));
      const dialog = await screen.findByRole("dialog");
      const values = Array.from((within(dialog).getByLabelText("New role") as HTMLSelectElement).options)
        .map((o) => o.value)
        .filter(Boolean);
      fireEvent.click(within(dialog).getByText("Cancel"));
      return values;
    };
    expect(await opts("Other Admin")).toEqual(["Subadmin", "Participant"]);
    expect(await opts("Registered Rita")).toEqual(["Admin", "Subadmin"]);
    expect(screen.queryByLabelText("Change role for Manual Mary")).toBeNull();
  });

  it("uses a plain dropdown: no role-select class and no shadow styling", async () => {
    await setup();
    fireEvent.click(editButton("Other Admin"));
    const select = within(await screen.findByRole("dialog")).getByLabelText("New role");
    expect(select.className).toBe("");
  });

  it("no longer renders Promote or Demote buttons", async () => {
    await setup();
    expect(screen.queryByText("Promote")).toBeNull();
    expect(screen.queryByText("Demote")).toBeNull();
  });

  it("Admin -> Participant: warns and calls the function without a university", async () => {
    await setup();
    await pick("Other Admin", "Participant");
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
    await pick("Other Admin", "Participant");
    expect(await screen.findByText(/cannot complete registration until signups reopen/)).toBeTruthy();
  });

  it.each([
    [{ matches_final: false, accepting_registrations: true }, false],
    [{ matches_final: true, accepting_registrations: true }, true],
    [{ matches_final: false, accepting_registrations: false }, true],
    [{ matches_final: false }, true],
  ])("signups-closed warning for %j is %s", async (programState, warned) => {
    h.auth.programState = programState;
    await setup();
    await pick("Other Admin", "Participant");
    const dialog = await screen.findByRole("dialog");
    expect(!!within(dialog).queryByText(/cannot complete registration until signups reopen/)).toBe(warned);
  });

  it("warns that an unfinished registration's spot is released for any unregistered non-admin", async () => {
    await setup();
    const unregisteredParticipant = ROWS.map((r) => (r.id === "adm" ? { ...r, data: { role: "Participant", displayName: "Other Admin" } } : r));
    await emit(unregisteredParticipant);
    await pick("Other Admin", "Admin");
    expect(await screen.findByText(/unused participant spot will be released/)).toBeTruthy();
  });

  it("registered Participant -> Admin warns about matching and the dashboard", async () => {
    await setup();
    await pick("Registered Rita", "Admin");
    expect(await screen.findByText(/remain eligible for matching, but will no longer have access to the participant dashboard/)).toBeTruthy();
  });

  it("-> Subadmin requires a university and sends it", async () => {
    await setup();
    await pick("Registered Rita", "Subadmin");
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByText("Confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await waitFor(() => expect(within(dialog).getByText("Towson")).toBeTruthy());
    fireEvent.change(within(dialog).getByLabelText("University"), { target: { value: "Towson" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(h.changeUserRole).toHaveBeenCalledWith("reg", "Subadmin", "Towson"));
  });

  it("Cancel closes the modal, calls nothing, and leaves the role unchanged", async () => {
    await setup();
    await pick("Other Admin", "Participant");
    fireEvent.click(await screen.findByText("Cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(h.changeUserRole).not.toHaveBeenCalled();
  });

  it("shows the function's message inline on a known error, and keeps the modal open", async () => {
    const { FirebaseError } = await import("firebase/app");
    h.changeUserRole = vi.fn().mockRejectedValue(new FirebaseError("functions/failed-precondition", "Waitlisted users can't have their role changed."));
    await setup();
    await pick("Other Admin", "Participant");
    fireEvent.click(await screen.findByText("Confirm"));
    expect(await screen.findByText("Waitlisted users can't have their role changed.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows a generic message for unexpected errors", async () => {
    h.changeUserRole = vi.fn().mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await setup();
    await pick("Other Admin", "Participant");
    fireEvent.click(await screen.findByText("Confirm"));
    expect(await screen.findByText("Could not change this role. Please try again.")).toBeTruthy();
  });

  it("keeps the select disabled as 'Updating…' until the snapshot shows the new role", async () => {
    await setup();
    await pick("Other Admin", "Participant");
    fireEvent.click(await screen.findByText("Confirm"));
    await waitFor(() => expect(editButton("Other Admin").disabled).toBe(true));
    expect(screen.getByText("Updating…")).toBeTruthy();
    await emit(ROWS.map((r) => (r.id === "adm" ? { ...r, data: { ...r.data, role: "Participant" } } : r)));
    await waitFor(() => expect(editButton("Other Admin").disabled).toBe(false));
    expect(screen.queryByText("Updating…")).toBeNull();
  });
});

describe("Manage Users role dialog and university", () => {
  it("sends a normalized university and does not re-fetch the options on confirm", async () => {
    h.getUniversityOptions = vi.fn().mockResolvedValue(["Univ.  of   Maryland"]);
    await setup();
    const dialog = await pick("Registered Rita", "Subadmin");
    await waitFor(() => expect(within(dialog).getByText("Univ. of Maryland")).toBeTruthy());
    fireEvent.change(within(dialog).getByLabelText("University"), { target: { value: "Univ.  of   Maryland" } });
    h.getUniversityOptions.mockClear();
    fireEvent.click(within(dialog).getByText("Confirm"));
    await waitFor(() => expect(h.changeUserRole).toHaveBeenCalledWith("reg", "Subadmin", "Univ. of Maryland"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(h.getUniversityOptions).not.toHaveBeenCalled();
  });

  const failWithUniversityError = async () => {
    const { FirebaseError } = await import("firebase/app");
    h.changeUserRole = vi.fn().mockRejectedValue(new FirebaseError("functions/invalid-argument", "That university isn't one of the current options."));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await setup();
    const dialog = await pick("Registered Rita", "Subadmin");
    await waitFor(() => expect(within(dialog).getByText("Towson")).toBeTruthy());
    const uni = within(dialog).getByLabelText("University") as HTMLSelectElement;
    fireEvent.change(uni, { target: { value: "Towson" } });
    h.getUniversityOptions.mockClear();
    return { dialog, uni };
  };

  it("on the server's university error, refreshes options and drops a selection that is really gone", async () => {
    const { dialog, uni } = await failWithUniversityError();
    h.getUniversityOptions = vi.fn().mockResolvedValue(["UMD"]);
    fireEvent.click(within(dialog).getByText("Confirm"));
    expect(await within(dialog).findByText("That university isn't one of the current options.")).toBeTruthy();
    await waitFor(() => expect(uni.value).toBe(""));
    expect(within(dialog).queryByText("Towson")).toBeNull();
  });

  it("keeps the options and selection when the refresh comes back empty", async () => {
    const { dialog, uni } = await failWithUniversityError();
    h.getUniversityOptions = vi.fn().mockResolvedValue([]);
    fireEvent.click(within(dialog).getByText("Confirm"));
    expect(await within(dialog).findByText("That university isn't one of the current options.")).toBeTruthy();
    await waitFor(() => expect(h.getUniversityOptions).toHaveBeenCalled());
    expect(uni.value).toBe("Towson");
    expect(within(dialog).getByText("UMD")).toBeTruthy();
  });

  it("keeps the selection when the refreshed list still contains it", async () => {
    const { dialog, uni } = await failWithUniversityError();
    h.getUniversityOptions = vi.fn().mockResolvedValue(["UMD", "Towson", "Goucher"]);
    fireEvent.click(within(dialog).getByText("Confirm"));
    await waitFor(() => expect(within(dialog).getByText("Goucher")).toBeTruthy());
    expect(uni.value).toBe("Towson");
  });

  it("does not touch the options for other errors (permission-denied, unexpected)", async () => {
    const { FirebaseError } = await import("firebase/app");
    for (const err of [new FirebaseError("functions/permission-denied", "Admins only."), new Error("boom")]) {
      cleanup();
      h.changeUserRole = vi.fn().mockRejectedValue(err);
      vi.spyOn(console, "error").mockImplementation(() => {});
      await setup();
      const dialog = await pick("Registered Rita", "Subadmin");
      await waitFor(() => expect(within(dialog).getByText("Towson")).toBeTruthy());
      const uni = within(dialog).getByLabelText("University") as HTMLSelectElement;
      fireEvent.change(uni, { target: { value: "Towson" } });
      h.getUniversityOptions.mockClear();
      fireEvent.click(within(dialog).getByText("Confirm"));
      await waitFor(() => expect(h.changeUserRole).toHaveBeenCalled());
      await waitFor(() => expect((within(dialog).getByText("Confirm") as HTMLButtonElement).disabled).toBe(false));
      expect(h.getUniversityOptions).not.toHaveBeenCalled();
      expect(uni.value).toBe("Towson");
    }
  });
});

describe("Manage Users pending role lifecycle", () => {
  const asParticipant = (rows = ROWS) =>
    rows.map((r) => (r.id === "adm" ? { ...r, data: { ...r.data, role: "Participant" } } : r));

  async function confirmAdminToParticipant() {
    await pick("Other Admin", "Participant");
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
    await waitFor(() => expect(editButton("Other Admin").disabled).toBe(false));
    expect(screen.queryByText("Updating…")).toBeNull();
  });

  it("stays disabled after the callable resolves until the snapshot confirms", async () => {
    h.changeUserRole = vi.fn().mockResolvedValue({ success: true, changed: true });
    await setup();
    await confirmAdminToParticipant();
    await waitFor(() => expect(screen.getByText("Updating…")).toBeTruthy());
    expect(editButton("Other Admin").disabled).toBe(true);
    await emit(asParticipant());
    await waitFor(() => expect(editButton("Other Admin").disabled).toBe(false));
    expect(screen.queryByText("Updating…")).toBeNull();
  });

  it("never goes pending when the callable reports changed: false", async () => {
    h.changeUserRole = vi.fn().mockResolvedValue({ success: true, changed: false, role: "Participant" });
    await setup();
    await confirmAdminToParticipant();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(editButton("Other Admin").disabled).toBe(false);
  });

  it("never goes pending when the callable rejects", async () => {
    h.changeUserRole = vi.fn().mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await setup();
    await confirmAdminToParticipant();
    expect(await screen.findByText("Could not change this role. Please try again.")).toBeTruthy();
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(editButton("Other Admin").disabled).toBe(false);
  });

  it("does not stay disabled when another admin sets a third role before ours shows up", async () => {
    h.changeUserRole = vi.fn().mockResolvedValue({ success: true, changed: true });
    await setup();
    await confirmAdminToParticipant();
    await waitFor(() => expect(editButton("Other Admin").disabled).toBe(true));
    await emit(ROWS.map((r) => (r.id === "adm" ? { ...r, data: { ...r.data, role: "Subadmin" } } : r)));
    await waitFor(() => expect(editButton("Other Admin").disabled).toBe(false));
    expect(screen.queryByText("Updating…")).toBeNull();
  });

  it("stays pending through a premature snapshot that still shows the old role", async () => {
    h.changeUserRole = vi.fn().mockResolvedValue({ success: true, changed: true });
    await setup();
    await confirmAdminToParticipant();
    await waitFor(() => expect(editButton("Other Admin").disabled).toBe(true));
    await emit(ROWS.map((r) => (r.id === "adm" ? { ...r, data: { ...r.data, phoneNumber: "5551234567" } } : r)));
    expect(editButton("Other Admin").disabled).toBe(true);
    expect(screen.getByText("Updating…")).toBeTruthy();
  });

  it("clears when the user disappears", async () => {
    h.changeUserRole = vi.fn().mockResolvedValue({ success: true, changed: true });
    await setup();
    await confirmAdminToParticipant();
    await waitFor(() => expect(screen.getByText("Updating…")).toBeTruthy());
    await emit(ROWS.filter((r) => r.id !== "adm"));
    expect(screen.queryByText("Updating…")).toBeNull();
  });
});

describe("Sub-admin participation toggle", () => {
  it("goes through the setSubadminParticipantOptIn callable", async () => {
    await setup();
    fireEvent.click(screen.getByText("Allow"));
    await waitFor(() => expect(h.setOptIn).toHaveBeenCalledWith("sub", true));
    expect(await screen.findByText("Sub Person can now register as a participant.")).toBeTruthy();
  });

  it("shows the function's own message when it refuses", async () => {
    const { FirebaseError } = await import("firebase/app");
    h.setOptIn = vi.fn().mockRejectedValue(
      new FirebaseError("functions/failed-precondition", "This sub-admin has already registered."),
    );
    await setup();
    fireEvent.click(screen.getByText("Allow"));
    expect(await screen.findByText("This sub-admin has already registered.")).toBeTruthy();
  });
});

describe("Users page banner from router state", () => {
  it("shows a banner passed by the page that sent the admin back", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/admin/creator", state: { banner: { type: "success", message: "Ada Lovelace was registered." } } },
        ]}
      >
        <AdminCreator />
      </MemoryRouter>,
    );
    await emit();
    expect(screen.getByText("Ada Lovelace was registered.")).toBeTruthy();
  });
});
