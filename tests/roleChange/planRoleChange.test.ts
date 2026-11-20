// @vitest-environment node
// Pure payload planning for role changes: which fields each transition writes.
import { describe, it, expect, vi } from "vitest";

vi.mock("firebase-admin", () => {
  const mod = { firestore: () => ({}) };
  return { ...mod, default: mod };
});

import { currentAssignableRole, normalizeUniversityName, planRoleChange } from "../../functions/src/roleChange";

const plan = (to: any, target: Record<string, unknown>, university?: string) =>
  planRoleChange({ to, target, university });

describe("currentAssignableRole", () => {
  it("normalizes legacy spellings and treats unknown as Participant", () => {
    expect(currentAssignableRole("Admin")).toBe("Admin");
    expect(currentAssignableRole("admin")).toBe("Admin");
    expect(currentAssignableRole("sub-admin")).toBe("Subadmin");
    expect(currentAssignableRole(" Subadmin ")).toBe("Subadmin");
    expect(currentAssignableRole("Participant")).toBe("Participant");
    expect(currentAssignableRole("Sub Admin")).toBe("Subadmin");
    expect(currentAssignableRole("  sub  admin ")).toBe("Subadmin");
    expect(currentAssignableRole("A d m i n")).toBe("Admin");
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
  ])("%s -> %s deletes university and participantOptIn", (from, to) => {
    expect(plan(to, { role: from, type: "Admin", capacityDecision: "counted" })).toEqual({
      role: to, university: null, participantOptIn: null,
      clearCapacityDecision: false, releaseCountedSlot: false,
    });
  });

  describe("unregistered Participant -> Admin capacity clean-up", () => {
    it("counted: clears the decision and releases the slot", () => {
      expect(plan("Admin", { role: "Participant", capacityDecision: "counted" })).toMatchObject({
        clearCapacityDecision: true, releaseCountedSlot: true,
      });
    });
    it("waitlisted: clears the decision only", () => {
      expect(plan("Admin", { role: "Participant", capacityDecision: "waitlisted" })).toMatchObject({
        clearCapacityDecision: true, releaseCountedSlot: false,
      });
    });
    it("registered: keeps the decision and the count", () => {
      expect(plan("Admin", { role: "Participant", type: "Participant", capacityDecision: "counted" })).toMatchObject({
        clearCapacityDecision: false, releaseCountedSlot: false,
      });
    });
    it("Participant -> Subadmin never releases (registration can still finish)", () => {
      expect(plan("Subadmin", { role: "Participant", capacityDecision: "counted" }, "UMD")).toMatchObject({
        clearCapacityDecision: false, releaseCountedSlot: false,
      });
    });
  });

  it("Admin -> Subadmin honours participantOptIn only when not already participating", () => {
    expect(plan("Subadmin", { role: "Admin" }, "UMD").participantOptIn).toBe(false);
    expect(planRoleChange({ to: "Subadmin", university: "UMD", participantOptIn: true, target: { role: "Admin" } }).participantOptIn).toBe(true);
    expect(planRoleChange({ to: "Subadmin", university: "UMD", participantOptIn: false, target: { role: "Admin", type: "Participant" } }).participantOptIn).toBe(true);
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

describe("normalizeUniversityName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeUniversityName("  Univ.  of   Maryland ")).toBe("Univ. of Maryland");
    expect(normalizeUniversityName(undefined)).toBe("");
  });
});
