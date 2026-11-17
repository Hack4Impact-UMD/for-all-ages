// @vitest-environment node
// Pure payload planning for role changes: which fields each transition writes.
import { describe, it, expect, vi } from "vitest";

vi.mock("firebase-admin", () => {
  const mod = { firestore: () => ({}) };
  return { ...mod, default: mod };
});

import { currentAssignableRole, planRoleChange } from "../../functions/src/roleChange";

const plan = (to: any, target: Record<string, unknown>, university?: string) =>
  planRoleChange({ to, target, university });

describe("currentAssignableRole", () => {
  it("normalizes legacy spellings and treats unknown as Participant", () => {
    expect(currentAssignableRole("Admin")).toBe("Admin");
    expect(currentAssignableRole("admin")).toBe("Admin");
    expect(currentAssignableRole("sub-admin")).toBe("Subadmin");
    expect(currentAssignableRole(" Subadmin ")).toBe("Subadmin");
    expect(currentAssignableRole("Participant")).toBe("Participant");
    expect(currentAssignableRole(undefined)).toBe("Participant");
  });
});

describe("planRoleChange", () => {
  it("Admin -> Subadmin: opted in only if registered", () => {
    expect(plan("Subadmin", { role: "Admin", type: "Admin" }, "UMD")).toMatchObject({
      role: "Subadmin", university: "UMD", participantOptIn: false,
    });
    expect(plan("Subadmin", { role: "Admin", type: "Participant" }, "UMD").participantOptIn).toBe(true);
  });

  it("Participant -> Subadmin: always opted in, even if unregistered", () => {
    expect(plan("Subadmin", { role: "Participant" }, "UMD")).toMatchObject({
      role: "Subadmin", university: "UMD", participantOptIn: true,
    });
    expect(plan("Subadmin", {}, "UMD").participantOptIn).toBe(true);
  });

  it.each([
    ["Admin", "Participant"],
    ["Subadmin", "Participant"],
    ["Participant", "Admin"],
  ])("%s -> %s deletes university and participantOptIn", (from, to) => {
    expect(plan(to, { role: from, type: "Admin", capacityDecision: "counted" })).toEqual({
      role: to, university: null, participantOptIn: null,
      clearCapacityDecision: false, releaseCountedSlot: false,
    });
  });

  describe("Subadmin -> Admin capacity clean-up", () => {
    it("unregistered + counted: clear decision and release the slot", () => {
      expect(plan("Admin", { role: "Subadmin", type: "Admin", capacityDecision: "counted" })).toMatchObject({
        role: "Admin", clearCapacityDecision: true, releaseCountedSlot: true,
      });
    });
    it("unregistered + waitlisted: clear decision only", () => {
      expect(plan("Admin", { role: "Subadmin", capacityDecision: "waitlisted" })).toMatchObject({
        clearCapacityDecision: true, releaseCountedSlot: false,
      });
    });
    it("unregistered with no decision: nothing to clean up", () => {
      expect(plan("Admin", { role: "Subadmin" })).toMatchObject({
        clearCapacityDecision: false, releaseCountedSlot: false,
      });
    });
    it("registered: keeps the decision and the count", () => {
      expect(plan("Admin", { role: "Subadmin", type: "Participant", capacityDecision: "counted" })).toMatchObject({
        clearCapacityDecision: false, releaseCountedSlot: false,
      });
    });
  });

  it("never plans writes to type, user_type, school or status", () => {
    const keys = Object.keys(plan("Subadmin", { role: "Admin", type: "Participant" }, "UMD"));
    for (const forbidden of ["type", "user_type", "school", "status"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
