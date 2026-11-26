// @vitest-environment node
// Recording past partners at End Program, and keeping them apart in matching.
import { describe, it, expect } from "vitest";
import {
  collectPastPartners,
  isPastPair,
  readPastPartners,
} from "../../src/utils/pastPartners";
import {
  buildPastPairSet,
  isInCohort,
  removePastPairs,
} from "../../functions/src/matching/src/utils/pastPairs";

describe("collectPastPartners", () => {
  it("records both sides of every approved match", () => {
    const result = collectPastPartners([
      { participant1_id: "s1", participant2_id: "a1", status: "approved" },
      { participant1_id: "s2", participant2_id: "a2", status: "approved" },
    ]);
    expect(result).toEqual(
      new Map([
        ["s1", new Set(["a1"])],
        ["a1", new Set(["s1"])],
        ["s2", new Set(["a2"])],
        ["a2", new Set(["s2"])],
      ]),
    );
  });

  it("ignores pending matches and malformed docs", () => {
    const result = collectPastPartners([
      { participant1_id: "s1", participant2_id: "a1", status: "pending" },
      { participant1_id: "s2", status: "approved" },
      { participant1_id: "s3", participant2_id: "s3", status: "approved" },
      { participant1_id: 4, participant2_id: "a4", status: "approved" },
    ]);
    expect(result.size).toBe(0);
  });
});

describe("readPastPartners / isPastPair", () => {
  it("reads only string uids", () => {
    expect(readPastPartners({ pastPartners: ["a", "", 3, null, "b"] })).toEqual(["a", "b"]);
    expect(readPastPartners({})).toEqual([]);
    expect(readPastPartners(undefined)).toEqual([]);
  });

  it("matches when either side lists the other", () => {
    const lists = new Map([["s1", ["a1"]]]);
    expect(isPastPair("s1", "a1", lists)).toBe(true);
    expect(isPastPair("a1", "s1", lists)).toBe(true);
    expect(isPastPair("s1", "a2", lists)).toBe(false);
  });
});

describe("matching filters", () => {
  const profiles = new Map([
    ["s1", { pastPartners: ["a1"] }],
    // Only the adult's doc lists this pair.
    ["a2", { pastPartners: ["s2"] }],
    // A partner who isn't in this run is ignored.
    ["s3", { pastPartners: ["a9"] }],
  ]);

  it("builds student|senior keys from either side", () => {
    const set = buildPastPairSet(profiles, ["s1", "s2", "s3"], ["a1", "a2"]);
    expect(set).toEqual(new Set(["s1|a1", "s2|a2"]));
  });

  it("removes past pairs from scores or matches and counts them", () => {
    const set = buildPastPairSet(profiles, ["s1", "s2"], ["a1", "a2"]);
    const pairs = [
      { studentId: "s1", seniorId: "a1" },
      { studentId: "s1", seniorId: "a2" },
      { studentId: "s2", seniorId: "a2" },
      { studentId: "s2", seniorId: "a1" },
    ];
    const { kept, blocked } = removePastPairs(pairs, set);
    expect(blocked).toBe(2);
    expect(kept).toEqual([
      { studentId: "s1", seniorId: "a2" },
      { studentId: "s2", seniorId: "a1" },
    ]);
  });

  it("treats a doc with no type and no user_type as outside the cohort", () => {
    expect(isInCohort({})).toBe(false);
    expect(isInCohort({ type: "Participant" })).toBe(true);
    expect(isInCohort({ user_type: "student" })).toBe(true);
    expect(isInCohort({ type: "Admin" })).toBe(true);
  });
});
