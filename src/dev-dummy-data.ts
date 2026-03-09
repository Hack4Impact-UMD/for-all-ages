/**
 * DEV ONLY: Dummy data for testing Pre-Program and Admin Roadmap filters.
 * Usage: add ?dummy=1 to the URL (e.g. /admin/main?dummy=1, /admin/dashboard?dummy=1).
 * To remove: delete this file and the "dummy" / dev-dummy-data usage in PreProgram and AdminDashboard.
 */

import type { UI_Match, Match, Week, ProgramState } from "./types";

// ── Pre-Program (matches table) ─────────────────────────────────────────────
export const DUMMY_PREPROGRAM_MATCHES: UI_Match[] = [
  { name1: "Dummy Alice", name2: "Dummy Bob", participant1_id: "dummy-p1", participant2_id: "dummy-p2", confidence: 85, status: "Approved", score: 0.85, matchId: "dummy-m1" },
  { name1: "Dummy Carol", name2: "Dummy Dave", participant1_id: "dummy-p3", participant2_id: "dummy-p4", confidence: 72, status: "Pending", score: 0.72, matchId: "dummy-m2" },
  { name1: "Dummy Eve", name2: "No match yet", participant1_id: "dummy-p5", participant2_id: null, confidence: undefined, status: "No Match", score: 0 },
  { name1: "No match yet", name2: "Dummy Frank", participant1_id: null, participant2_id: "dummy-p6", confidence: undefined, status: "No Match", score: 0 },
  { name1: "Dummy Grace", name2: "Dummy Henry", participant1_id: "dummy-p7", participant2_id: "dummy-p8", confidence: 90, status: "Approved", score: 0.9, matchId: "dummy-m3" },
  { name1: "Dummy Ivy", name2: "Dummy Jack", participant1_id: "dummy-p9", participant2_id: "dummy-p10", confidence: 65, status: "Pending", score: 0.65, matchId: "dummy-m4" },
];

// ── Admin Roadmap (calls table) ─────────────────────────────────────────────
const DUMMY_MATCH_IDS = ["dummy-m1", "dummy-m2", "dummy-m3", "dummy-m4", "dummy-m5", "dummy-m6"];

export const DUMMY_ROADMAP_MATCHES: (Match & { id: string })[] = [
  { id: "dummy-m1", participant1_id: "dummy-p1", participant2_id: "dummy-p2", day_of_call: 1, similarity: 85 }, // Sun
  { id: "dummy-m2", participant1_id: "dummy-p3", participant2_id: "dummy-p4", day_of_call: 2, similarity: 72 }, // Mon
  { id: "dummy-m3", participant1_id: "dummy-p7", participant2_id: "dummy-p8", day_of_call: 3, similarity: 90 }, // Tue
  { id: "dummy-m4", participant1_id: "dummy-p9", participant2_id: "dummy-p10", day_of_call: 5, similarity: 65 }, // Thu
  { id: "dummy-m5", participant1_id: "dummy-p11", participant2_id: "dummy-p12", day_of_call: 6, similarity: 78 }, // Fri
  { id: "dummy-m6", participant1_id: "dummy-p13", participant2_id: "dummy-p14", day_of_call: 7, similarity: 88 }, // Sat
];

/** Week 1 with first two matches marked completed (green); rest are pending (gold). */
export const DUMMY_WEEK_1: Week = {
  week: 1,
  calls: [DUMMY_MATCH_IDS[0], DUMMY_MATCH_IDS[1]], // dummy-m1, dummy-m2 completed
};

export const DUMMY_PARTICIPANT_NAMES: Record<string, string> = {
  "dummy-p1": "Dummy Alice",
  "dummy-p2": "Dummy Bob",
  "dummy-p3": "Dummy Carol",
  "dummy-p4": "Dummy Dave",
  "dummy-p5": "Dummy Eve",
  "dummy-p6": "Dummy Frank",
  "dummy-p7": "Dummy Grace",
  "dummy-p8": "Dummy Henry",
  "dummy-p9": "Dummy Ivy",
  "dummy-p10": "Dummy Jack",
  "dummy-p11": "Dummy Kate",
  "dummy-p12": "Dummy Leo",
  "dummy-p13": "Dummy Mia",
  "dummy-p14": "Dummy Noah",
};

/** So roadmap shows Week 1 as current and variant logic (green/gold/rose) works. */
export const DUMMY_PROGRAM_STATE: ProgramState = {
  started: true,
  matches_final: true,
  week: 1,
  maxParticipants: 50,
  numWeeks: 20,
};
