// @vitest-environment node
// Client role / university normalization, kept in step with the server copies.
import { describe, it, expect, vi } from "vitest";

vi.mock("firebase-admin", () => {
  const mod = { firestore: () => ({}) };
  return { ...mod, default: mod };
});

import { normalizeRole, toAssignableRole, isAdminRole, isSubadminRole } from "../../src/utils/roles";
import { normalizeUniversityName } from "../../src/utils/university";
import { signupsClosed } from "../../src/utils/programState";
import { normalizeRole as serverNormalizeRole, isAdminRole as serverIsAdmin, isFullAdminRole } from "../../functions/src/roles";
import { normalizeUniversityName as serverUni } from "../../functions/src/roleChange";

const VALUES = ["Admin", "admin", " Subadmin ", "sub-admin", "Sub Admin", "sub  admin", "SUB\tADMIN", "A dmin", "Participant", "", "  ", "owner", undefined, null, 42];

describe("role normalization", () => {
  it.each(VALUES)("client and server agree on %j", (value) => {
    expect(normalizeRole(value)).toBe(serverNormalizeRole(value));
  });

  it("treats \"Sub Admin\" as a sub-admin on the client", () => {
    expect(normalizeRole("Sub Admin")).toBe("subadmin");
    expect(toAssignableRole("Sub Admin")).toBe("Subadmin");
    expect(isAdminRole("Sub Admin")).toBe(true);
    expect(isSubadminRole("Sub Admin")).toBe(true);
  });

  it("treats \"Sub Admin\" as a sub-admin, not a full admin, on the server", () => {
    expect(serverIsAdmin("Sub Admin")).toBe(true);
    expect(isFullAdminRole("Sub Admin")).toBe(false);
  });

  it("maps unknown and empty roles to Participant", () => {
    expect(toAssignableRole(undefined)).toBe("Participant");
    expect(toAssignableRole("owner")).toBe("Participant");
    expect(isAdminRole("")).toBe(false);
  });
});

describe("university normalization", () => {
  it.each(["UMD", "  Univ.  of   Maryland ", "Towson\tUniversity", "", undefined, 7])("client and server agree on %j", (v) => {
    expect(normalizeUniversityName(v)).toBe(serverUni(v));
  });
});

describe("signupsClosed", () => {
  it("is closed once matches are final or registration isn't accepting", () => {
    expect(signupsClosed({ matches_final: true, accepting_registrations: true })).toBe(true);
    expect(signupsClosed({ matches_final: false, accepting_registrations: false })).toBe(true);
    expect(signupsClosed({ matches_final: false, accepting_registrations: true })).toBe(false);
  });
  it("doesn't warn while program state is still loading", () => {
    expect(signupsClosed(null)).toBe(false);
  });
});
