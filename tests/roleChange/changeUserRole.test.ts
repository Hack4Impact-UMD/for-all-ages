// @vitest-environment node
// changeUserRole callable: authorization, validation and the Firestore writes.
// firebase-admin and firebase-functions are mocked; nothing touches the network.
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  store: {} as Record<string, Record<string, any>>,
  authUsers: new Set<string>(),
  authError: null as null | { code: string },
  beforeTxn: null as null | (() => void),
}));

vi.mock("firebase-admin", () => {
  const FieldValue = {
    delete: () => ({ __op: "delete" }),
    increment: (n: number) => ({ __op: "inc", n }),
    serverTimestamp: () => ({ __op: "ts" }),
  };
  const apply = (path: string, data: Record<string, any>, merge: boolean) => {
    const next: Record<string, any> = merge ? { ...(h.store[path] ?? {}) } : {};
    for (const [k, v] of Object.entries(data)) {
      if (v && v.__op === "delete") delete next[k];
      else if (v && v.__op === "inc") next[k] = (next[k] ?? 0) + v.n;
      else if (v && v.__op === "ts") next[k] = "TS";
      else next[k] = v;
    }
    h.store[path] = next;
  };
  const docRef = (path: string) => ({
    path,
    id: path.split("/").pop(),
    get: async () => ({ exists: path in h.store, data: () => h.store[path] }),
  });
  const firestore: any = () => ({
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
    doc: (path: string) => docRef(path),
    runTransaction: async (fn: (t: any) => Promise<any>) => {
      h.beforeTxn?.();
      const staged: Array<() => void> = [];
      const t = {
        get: async (ref: any) => ({ exists: ref.path in h.store, data: () => h.store[ref.path] }),
        set: (ref: any, data: any, opts: any) => staged.push(() => apply(ref.path, data, !!opts?.merge)),
        update: (ref: any, data: any) => staged.push(() => apply(ref.path, data, true)),
      };
      const out = await fn(t);
      staged.forEach((s) => s());
      return out;
    },
  });
  firestore.FieldValue = FieldValue;
  const auth = () => ({
    getUser: async (uid: string) => {
      if (h.authError) throw h.authError;
      if (!h.authUsers.has(uid)) throw { code: "auth/user-not-found" };
      return { uid };
    },
  });
  const mod = { initializeApp() {}, firestore, auth };
  return { ...mod, default: mod };
});
vi.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  }
  return { onRequest: (fn: any) => fn, onCall: (fn: any) => fn, HttpsError };
});
vi.mock("busboy", () => ({ default: () => ({}) }));
vi.mock("../../functions/src/matching/src/services/upsertUser.js", () => ({ upsertFreeResponse: async () => {} }));
vi.mock("../../functions/src/matching/src/services/calculateMatchScore.js", () => ({ default: async () => ({}) }));
vi.mock("../../functions/src/matching/src/services/deleteUser.js", () => ({
  deleteUserFromPinecone: async () => {},
  deleteAllUsersFromPinecone: async () => {},
}));
vi.mock("../../functions/src/matching/src/services/matchingService", () => ({ MatchingService: class {} }));

import { changeUserRole } from "../../functions/src/index";

const call = (data: any, uid: string | null = "admin1") =>
  (changeUserRole as any)({ auth: uid ? { uid } : undefined, data });
const code = async (p: Promise<unknown>) => p.then(() => "ok", (e) => e.code);

beforeEach(() => {
  h.beforeTxn = null;
  h.authError = null;
  h.authUsers = new Set(["admin1", "admin2", "p1", "sub1", "inv1"]);
  h.store = {
    "participants/admin1": { role: "Admin", type: "Admin" },
    "participants/admin2": { role: "Admin", type: "Admin", university: null },
    "participants/sub1": { role: "Subadmin", type: "Admin", university: "UMD", participantOptIn: true, capacityDecision: "counted" },
    "participants/p1": { role: "Participant", type: "Participant", user_type: "student", school: "UMD", status: "Active", capacityDecision: "counted" },
    "participants/inv1": { role: "Admin", type: "Admin", status: "Invited" }, // invited admin: no hasAuthAccount flag
    "participants/manual1": { role: "Participant", type: "Participant", hasAuthAccount: false, isManualEntry: true },
    "participants/manual2": { role: "Participant", type: "Participant" }, // no flags, no Auth user
    "participants/wait1": { role: "Participant", type: "Participant" },
    "participants/subadmin2": { role: "Subadmin", participantOptIn: true },
    "waitlist/wait1": { uid: "wait1" },
    "config/programState": { currentParticipants: 5 },
    "config/registrationForm": {
      sections: [{ questions: [{ lockedKey: "school", options: ["UMD", "Towson"] }] }],
    },
  };
  h.authUsers.add("wait1");
  h.authUsers.add("subadmin2");
});

describe("changeUserRole authorization and validation", () => {
  it("rejects unauthenticated calls", async () => {
    expect(await code(call({ targetUserId: "p1", newRole: "Admin" }, null))).toBe("unauthenticated");
  });
  it("rejects Subadmin and Participant callers", async () => {
    expect(await code(call({ targetUserId: "p1", newRole: "Admin" }, "sub1"))).toBe("permission-denied");
    expect(await code(call({ targetUserId: "sub1", newRole: "Admin" }, "p1"))).toBe("permission-denied");
    expect(await code(call({ targetUserId: "p1", newRole: "Admin" }, "ghost"))).toBe("permission-denied");
  });
  it("rejects self-change", async () => {
    expect(await code(call({ targetUserId: "admin1", newRole: "Participant" }))).toBe("invalid-argument");
  });
  it("rejects bad input", async () => {
    expect(await code(call({ targetUserId: "", newRole: "Admin" }))).toBe("invalid-argument");
    expect(await code(call({ targetUserId: "a/b", newRole: "Admin" }))).toBe("invalid-argument");
    expect(await code(call({ targetUserId: "p1", newRole: "admin" }))).toBe("invalid-argument");
    expect(await code(call({ targetUserId: "p1", newRole: "Owner" }))).toBe("invalid-argument");
    expect(await code(call({ targetUserId: "p1", newRole: "Admin", university: "UMD" }))).toBe("invalid-argument");
  });
  it("requires a valid university for Subadmin", async () => {
    expect(await code(call({ targetUserId: "p1", newRole: "Subadmin" }))).toBe("invalid-argument");
    expect(await code(call({ targetUserId: "p1", newRole: "Subadmin", university: "  " }))).toBe("invalid-argument");
    expect(await code(call({ targetUserId: "p1", newRole: "Subadmin", university: "Elsewhere" }))).toBe("invalid-argument");
    h.store["config/registrationForm"] = { sections: [] };
    expect(await code(call({ targetUserId: "p1", newRole: "Subadmin", university: "UMD" }))).toBe("invalid-argument");
  });
  it("compares universities normalized and stores the option as listed", async () => {
    h.store["config/registrationForm"] = {
      sections: [{ questions: [{ lockedKey: "school", options: ["Univ.  of Maryland"] }] }],
    };
    await call({ targetUserId: "p1", newRole: "Subadmin", university: "  Univ. of   Maryland " });
    expect(h.store["participants/p1"].university).toBe("Univ.  of Maryland");
  });
  it("only accepts participantOptIn for a Subadmin, as a boolean", async () => {
    expect(await code(call({ targetUserId: "p1", newRole: "Admin", participantOptIn: true }))).toBe("invalid-argument");
    expect(await code(call({ targetUserId: "inv1", newRole: "Subadmin", university: "UMD", participantOptIn: "yes" }))).toBe("invalid-argument");
    await call({ targetUserId: "inv1", newRole: "Subadmin", university: "UMD", participantOptIn: true });
    expect(h.store["participants/inv1"].participantOptIn).toBe(true);
  });
  it("treats \"Sub Admin\" on the caller and target as the sub-admin role", async () => {
    h.store["participants/admin1"].role = "A dmin";
    h.store["participants/sub1"].role = "Sub Admin";
    await expect(call({ targetUserId: "sub1", newRole: "Subadmin", university: "UMD" })).resolves.toMatchObject({ changed: false });
    expect(await code(call({ targetUserId: "inv1", newRole: "Participant" }, "sub1"))).toBe("permission-denied");
  });
  it("rejects a missing target and a waitlisted target", async () => {
    h.authUsers.add("ghost2");
    expect(await code(call({ targetUserId: "ghost2", newRole: "Admin" }))).toBe("not-found");
    expect(await code(call({ targetUserId: "wait1", newRole: "Admin" }))).toBe("failed-precondition");
    expect(h.store["participants/wait1"].role).toBe("Participant");
  });
  it("rejects manual-entry users as Admin or Subadmin, by flag and by missing Auth user", async () => {
    h.authUsers.add("manual1"); // flags alone must still block
    expect(await code(call({ targetUserId: "manual1", newRole: "Admin" }))).toBe("failed-precondition");
    expect(await code(call({ targetUserId: "manual2", newRole: "Admin" }))).toBe("failed-precondition");
    expect(await code(call({ targetUserId: "manual2", newRole: "Subadmin", university: "UMD" }))).toBe("failed-precondition");
    expect(h.store["participants/manual2"].role).toBe("Participant");
  });
  it("fails closed when the Auth lookup errors", async () => {
    h.authError = { code: "auth/internal-error" };
    expect(await code(call({ targetUserId: "p1", newRole: "Admin" }))).toBe("internal");
    expect(h.store["participants/p1"].role).toBe("Participant");
  });
  it("allows a manual-entry record to stay a Participant (same role is a no-op)", async () => {
    await expect(call({ targetUserId: "manual2", newRole: "Participant" })).resolves.toMatchObject({ changed: false });
  });
  it("aborts if the caller lost Admin between the request and the transaction", async () => {
    h.beforeTxn = () => { h.store["participants/admin1"].role = "Participant"; };
    expect(await code(call({ targetUserId: "inv1", newRole: "Participant" }))).toBe("permission-denied");
    expect(h.store["participants/inv1"].role).toBe("Admin");
  });
  it("handles legacy role spellings on caller and target", async () => {
    h.store["participants/admin1"].role = "admin";
    h.store["participants/sub1"].role = "sub-admin";
    await expect(call({ targetUserId: "sub1", newRole: "Subadmin", university: "UMD" })).resolves.toMatchObject({ changed: false });
    await expect(call({ targetUserId: "sub1", newRole: "Participant" })).resolves.toMatchObject({ changed: true });
    expect(h.store["participants/sub1"].role).toBe("Participant");
  });
});

describe("changeUserRole writes", () => {
  it("same role is a no-op that writes nothing", async () => {
    const before = JSON.stringify(h.store);
    await expect(call({ targetUserId: "p1", newRole: "Participant" })).resolves.toEqual({ success: true, changed: false, role: "Participant" });
    expect(JSON.stringify(h.store)).toBe(before);
  });

  it("Participant -> Admin keeps all participant data and the capacity count", async () => {
    await call({ targetUserId: "p1", newRole: "Admin" });
    expect(h.store["participants/p1"]).toEqual({
      role: "Admin", type: "Participant", user_type: "student", school: "UMD",
      status: "Active", capacityDecision: "counted", updatedAt: "TS",
    });
    expect(h.store["config/programState"].currentParticipants).toBe(5);
  });

  it("Participant -> Subadmin sets university and opt-in, trimming the university", async () => {
    await call({ targetUserId: "p1", newRole: "Subadmin", university: " Towson " });
    expect(h.store["participants/p1"]).toMatchObject({
      role: "Subadmin", university: "Towson", participantOptIn: true, type: "Participant", user_type: "student",
    });
  });

  it("Admin -> Subadmin: invited (unregistered) admin is not opted in", async () => {
    await call({ targetUserId: "inv1", newRole: "Subadmin", university: "UMD" });
    expect(h.store["participants/inv1"]).toMatchObject({
      role: "Subadmin", university: "UMD", participantOptIn: false, type: "Admin", status: "Invited",
    });
  });

  it("Admin -> Participant leaves type alone and removes university", async () => {
    await call({ targetUserId: "admin2", newRole: "Participant" });
    expect(h.store["participants/admin2"]).toEqual({ role: "Participant", type: "Admin", updatedAt: "TS" });
  });

  it("Subadmin -> Participant removes university and participantOptIn", async () => {
    await call({ targetUserId: "subadmin2", newRole: "Participant" });
    expect(h.store["participants/subadmin2"]).toEqual({ role: "Participant", updatedAt: "TS" });
  });

  it("unregistered Subadmin -> Admin releases a counted slot atomically", async () => {
    await call({ targetUserId: "sub1", newRole: "Admin" });
    expect(h.store["participants/sub1"]).toEqual({ role: "Admin", type: "Admin", updatedAt: "TS" });
    expect(h.store["config/programState"].currentParticipants).toBe(4);
  });

  it("never takes currentParticipants below zero", async () => {
    h.store["config/programState"].currentParticipants = 0;
    await call({ targetUserId: "sub1", newRole: "Admin" });
    expect(h.store["config/programState"].currentParticipants).toBe(0);
    expect(h.store["participants/sub1"].capacityDecision).toBeUndefined();
  });

  it("unregistered waitlisted-decision Subadmin -> Admin clears the decision without touching the count", async () => {
    h.store["participants/sub1"].capacityDecision = "waitlisted";
    await call({ targetUserId: "sub1", newRole: "Admin" });
    expect(h.store["participants/sub1"].capacityDecision).toBeUndefined();
    expect(h.store["config/programState"].currentParticipants).toBe(5);
  });

  it("unregistered Participant -> Admin releases a counted slot (the reviewer's case)", async () => {
    h.store["participants/p1"] = { role: "Participant", capacityDecision: "counted" };
    await call({ targetUserId: "p1", newRole: "Admin" });
    expect(h.store["participants/p1"]).toEqual({ role: "Admin", updatedAt: "TS" });
    expect(h.store["config/programState"].currentParticipants).toBe(4);
  });

  it("unregistered Participant with a stale waitlisted decision -> Admin clears it, count untouched", async () => {
    h.store["participants/p1"] = { role: "Participant", capacityDecision: "waitlisted" };
    await call({ targetUserId: "p1", newRole: "Admin" });
    expect(h.store["participants/p1"].capacityDecision).toBeUndefined();
    expect(h.store["config/programState"].currentParticipants).toBe(5);
  });

  it("unregistered Participant with an actual waitlist entry is refused and nothing changes", async () => {
    h.store["participants/wait1"] = { role: "Participant", capacityDecision: "waitlisted" };
    expect(await code(call({ targetUserId: "wait1", newRole: "Admin" }))).toBe("failed-precondition");
    expect(h.store["participants/wait1"].capacityDecision).toBe("waitlisted");
    expect(h.store["waitlist/wait1"]).toBeTruthy();
  });

  it("registered Participant -> Admin keeps the decision and the count", async () => {
    await call({ targetUserId: "p1", newRole: "Admin" });
    expect(h.store["participants/p1"].capacityDecision).toBe("counted");
    expect(h.store["config/programState"].currentParticipants).toBe(5);
  });

  it("registered Subadmin -> Admin keeps capacityDecision and the count", async () => {
    h.store["participants/sub1"].type = "Participant";
    await call({ targetUserId: "sub1", newRole: "Admin" });
    expect(h.store["participants/sub1"].capacityDecision).toBe("counted");
    expect(h.store["config/programState"].currentParticipants).toBe(5);
  });
});
