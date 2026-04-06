import { useEffect, useRef, useState } from "react";
import styles from "./PreProgram.module.css";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import SettingsIcon from '@mui/icons-material/Settings';
import AutorenewIcon from "@mui/icons-material/Autorenew";
import SendIcon from "@mui/icons-material/Send";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { db, getUser, matchAll } from "../../firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  finalizeMatches,
  startProgram,
  subscribeToProgramState,
  type ProgramState,
} from "../../services/programState";
import type { BackendMatch, UI_Match, MatchStatus } from "../../types";
import SettingsPopup from "./SettingsPopup";

const APPROVAL_THRESHOLD = 0.8; // 80%
const DEV_MODE = true; // ← flip to false before deploying to production

// Collections to wipe on End Program
const COLLECTIONS_TO_CLEAR = [
  "participants",
  "matches",
  "logs",
  "weeks",
  "waitlist",
];

const PreProgram = () => {
  const [matches, setMatches] = useState<UI_Match[]>([]);
  const [search, setSearch] = useState("");
  const [matching, setMatching] = useState(false);
  const [programState, setProgramState] = useState<ProgramState | null>(null);
  const [programStateLoading, setProgramStateLoading] = useState(true);
  const [programStateError, setProgramStateError] = useState<string | null>(
    null,
  );
  const [startingProgram, setStartingProgram] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"start" | "finalize" | "endProgram" | null>(null);

  // End Program state
  const [endConfirmText, setEndConfirmText] = useState("");
  const [endingProgram, setEndingProgram] = useState(false);
  const [endProgramError, setEndProgramError] = useState<string | null>(null);

  const [settingsPopup, setSettingsPopup] = useState(false)

  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<MatchStatus[]>([]);

  const statusFilterRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadMatches();
  }, []);

  const sortMatches = (list: UI_Match[]) => {
    const order: Record<MatchStatus, number> = {
      Pending: 1,
      "No Match": 2,
      Approved: 3,
    };
    return [...list].sort((a, b) => order[a.status] - order[b.status]);
  };

  useEffect(() => {
    const unsubscribe = subscribeToProgramState(
      (state) => {
        setProgramState(state);
        setProgramStateLoading(false);
      },
      (err) => {
        console.error("Failed to subscribe to program state", err);
        setProgramStateError("Unable to load program state.");
        setProgramStateLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  /**
   * Convert backend match results + unmatched arrays into UI_Match rows.
   */
  const convertMatches = async (
    rawMatches: BackendMatch[],
    unmatchedStudents: string[],
    unmatchedSeniors: string[],
  ): Promise<UI_Match[]> => {
    const pairRows: UI_Match[] = await Promise.all(
      rawMatches.map(async (m) => {
        const u1 = await getUser(m.studentId);
        const u2 = await getUser(m.seniorId);

        const pct = Math.round(m.scores.finalScore * 100);

        const status: MatchStatus =
          m.scores.finalScore >= APPROVAL_THRESHOLD ? "Approved" : "Pending";

        return {
          name1: u1.displayName,
          name2: u2.displayName,
          participant1_id: u1.userUid,
          participant2_id: u2.userUid,
          confidence: pct,
          status,
          score: m.scores.finalScore,
        };
      }),
    );

    const unmatchedStudentRows: UI_Match[] = await Promise.all(
      unmatchedStudents.map(async (uid) => {
        const u = await getUser(uid);
        return {
          name1: u.displayName,
          name2: "No match yet",
          participant1_id: u.userUid,
          participant2_id: null,
          confidence: undefined,
          status: "No Match",
          score: 0,
        };
      }),
    );

    const unmatchedSeniorRows: UI_Match[] = await Promise.all(
      unmatchedSeniors.map(async (uid) => {
        const u = await getUser(uid);
        return {
          name1: "No match yet",
          name2: u.displayName,
          participant1_id: null,
          participant2_id: u.userUid,
          confidence: undefined,
          status: "No Match",
          score: 0,
        };
      }),
    );

    return [...pairRows, ...unmatchedStudentRows, ...unmatchedSeniorRows];
  };

  const loadMatches = async () => {
    const matchesRef = collection(db, "matches");
    const snap = await getDocs(matchesRef);

    const loadedPairs: UI_Match[] = [];
    const matchedIds = new Set<string>();

    if (!snap.empty) {
      const pairRows: UI_Match[] = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data() as any;
          const p1 = data.participant1_id as string;
          const p2 = data.participant2_id as string;
          const similarity = data.similarity ?? 0;

          matchedIds.add(p1);
          matchedIds.add(p2);

          const u1 = await getUser(p1);
          const u2 = await getUser(p2);

          const rawStatus = (data.status as string | undefined) || "";
          let status: MatchStatus;
          if (rawStatus === "approved") {
            status = "Approved";
          } else if (rawStatus === "pending") {
            status = "Pending";
          } else {
            status =
              similarity >= 80
                ? "Approved"
                : similarity > 0
                  ? "Pending"
                  : "No Match";
          }

          return {
            name1: u1.displayName,
            name2: u2.displayName,
            participant1_id: p1,
            participant2_id: p2,
            confidence: similarity,
            status,
            score: similarity / 100,
            matchId: d.id,
          };
        }),
      );

      loadedPairs.push(...pairRows);
    }

    // Now find any participants with NO match at all (like rematching page)
    const participantsRef = collection(db, "participants");
    const participantsSnap = await getDocs(participantsRef);

    // Fetch waitlisted IDs to exclude from unmatched rows
    const waitlistSnap = await getDocs(collection(db, "waitlist"));
    const waitlistedIds = new Set(waitlistSnap.docs.map((d) => d.id));

    const unmatchedRows: UI_Match[] = [];

    participantsSnap.forEach((pDoc) => {
      const data = pDoc.data() as any;
      const id = pDoc.id;
      if (matchedIds.has(id)) return;
      if (waitlistedIds.has(id)) return;
      const displayName =
        data.displayName ?? data.name ?? data.fullName ?? "Unnamed participant";
      const userType = (data.user_type ?? data.userType) as
        | "Student"
        | "Adult"
        | "Senior"
        | undefined;
      if (userType === "Student") {
        unmatchedRows.push({
          name1: displayName,
          name2: "No match yet",
          participant1_id: id,
          participant2_id: null,
          confidence: undefined,
          status: "No Match",
          score: 0,
        });
      } else if (userType === "Adult" || userType === "Senior") {
        unmatchedRows.push({
          name1: "No match yet",
          name2: displayName,
          participant1_id: null,
          participant2_id: id,
          confidence: undefined,
          status: "No Match",
          score: 0,
        });
      }
    });

    const combined = [...loadedPairs, ...unmatchedRows];
    if (combined.length === 0) {
      setMatches([]);
      return;
    }

    const sorted = sortMatches(combined);
    setMatches(sorted);
  };

  const storeMatches = async (list: UI_Match[]): Promise<UI_Match[]> => {
    const colRef = collection(db, "matches");

    // Delete all existing match docs
    const existingDocs = await getDocs(colRef);
    const deleteBatch = writeBatch(db);
    existingDocs.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();

    const writeBatchRef = writeBatch(db);
    const withIds: UI_Match[] = [];

    list.forEach((m) => {
      // Skip unmatched rows (no Firestore doc)
      if (m.status === "No Match" || !m.participant1_id || !m.participant2_id) {
        withIds.push({ ...m, matchId: undefined });
        return;
      }

      const newDocRef = doc(colRef);
      writeBatchRef.set(newDocRef, {
        day_of_call: -1,
        participant1_id: m.participant1_id,
        participant2_id: m.participant2_id,
        similarity: m.confidence,
        status: m.status === "Approved" ? "approved" : "pending",
      });

      withIds.push({ ...m, matchId: newDocRef.id });
    });

    await writeBatchRef.commit();
    console.log("Matches stored successfully.");
    return withIds;
  };

  const handleMatch = async () => {
    setMatching(true);
    try {
      const res = await matchAll();
      const {
        matches: rawMatches,
        unmatchedStudents = [],
        unmatchedSeniors = [],
      } = res.result;

      const converted = await convertMatches(
        rawMatches,
        unmatchedStudents,
        unmatchedSeniors,
      );

      const storedWithIds = await storeMatches(converted);
      const sorted = sortMatches(storedWithIds);
      setMatches(sorted);
    } catch (err) {
      console.error("Error creating matches:", err);
    } finally {
      setMatching(false);
    }
  };

  // handlers for program state buttons
  const handleStartProgram = async () => {
    try {
      setProgramStateError(null);
      setStartingProgram(true);
      await startProgram();
    } catch (err) {
      console.error("Failed to start program", err);
      setProgramStateError("Failed to start the program. Please try again.");
    } finally {
      setStartingProgram(false);
      setConfirmAction(null);
    }
  };

  const handleFinalizeMatches = async () => {
    try {
      setProgramStateError(null);
      setFinalizing(true);
      await finalizeMatches();
    } catch (err) {
      console.error("Failed to finalize matches", err);
      setProgramStateError("Failed to finalize matches. Please try again.");
    } finally {
      setFinalizing(false);
      setConfirmAction(null);
    }
  };

  // ── Export Data ──────────────────────────────────────────────────────────────

  /**
   * Fetch all collections and export them as individual CSV blobs zipped into
   * one download. For simplicity (no zip dependency) we export each collection
   * as a separate CSV download.
   */
  const handleExportData = async () => {
    try {
      const exportCollections = [
        "participants",
        "matches",
        "logs",
        "weeks",
      ];

      for (const colName of exportCollections) {
        const snap = await getDocs(collection(db, colName));
        if (snap.empty) continue;

        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Collect all keys
        const allKeys = Array.from(
          new Set(rows.flatMap((r) => Object.keys(r)))
        );

        const escapeCell = (val: unknown): string => {
          if (val === null || val === undefined) return "";
          const str = typeof val === "object" ? JSON.stringify(val) : String(val);
          // Wrap in quotes if contains comma, quote, or newline
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const csvLines = [
          allKeys.join(","),
          ...rows.map((r) =>
            allKeys.map((k) => escapeCell((r as any)[k])).join(",")
          ),
        ];

        const blob = new Blob([csvLines.join("\n")], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${colName}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleEndProgram = async () => {
    if (endConfirmText.toLowerCase() !== "confirm") return;

    try {
      setEndProgramError(null);
      setEndingProgram(true);

      if (DEV_MODE) {
        // Simulate the operation without touching Firestore
        console.log("[DEV_MODE] End Program triggered. Would have cleared:", COLLECTIONS_TO_CLEAR);
        console.log("[DEV_MODE] Would have reset config/programState to:", {
          matches_final: false,
          started: false,
          updatedAt: "serverTimestamp()",
          week: 0,
        });
        await new Promise((res) => setTimeout(res, 800)); // simulate async delay
        setMatches([]);
        setConfirmAction(null);
        setEndConfirmText("");
        return;
      }

      // Delete all docs in each collection (Firestore has no "delete collection" API)
      for (const colName of COLLECTIONS_TO_CLEAR) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // Reset config doc
      const configRef = doc(db, "config", "programState");
      await setDoc(configRef, {
        matches_final: false,
        started: false,
        updatedAt: serverTimestamp(),
        week: 0,
        currentParticipants: 0,
      });

      // Clear local state
      setMatches([]);
      setConfirmAction(null);
      setEndConfirmText("");
    } catch (err) {
      console.error("Failed to end program:", err);
      setEndProgramError("Something went wrong. Please try again.");
    } finally {
      setEndingProgram(false);
    }
  };

  const handleStatusChange = async (
    matchId: string | undefined,
    newStatus: MatchStatus | "Separate",
  ) => {
    const index = matches.findIndex((m) => m.matchId === matchId);
    if (index === -1) return;

    const updated = [...matches];
    const match = updated[index];

    if (match.status === "No Match") return;

    // Handles the deletion of the match and update Firebase statuses
    if (newStatus === "Separate") {
      if (match.matchId) {
        const newUnmatchedStudent: UI_Match = {
          name1: match.name1,
          name2: "No match yet",
          participant1_id: match.participant1_id,
          participant2_id: null,
          confidence: undefined,
          status: "No Match",
          score: 0,
        };

        const newUnmatchedSenior: UI_Match = {
          name1: "No match yet",
          name2: match.name2,
          participant1_id: null,
          participant2_id: match.participant2_id,
          confidence: undefined,
          status: "No Match",
          score: 0,
        };

        const newUpdated = updated.filter((m) => m.matchId !== match.matchId);
        newUpdated.push(newUnmatchedStudent, newUnmatchedSenior);
        setMatches(sortMatches(newUpdated));

        const deleteMatchRef = doc(db, "matches", match.matchId);
        await deleteDoc(deleteMatchRef);
      }

      return;
    }

    match.status = newStatus;
    setMatches(sortMatches(updated));

    if (!match.matchId) return;

    const matchRef = doc(db, "matches", match.matchId);
    const firestoreStatus = newStatus === "Approved" ? "approved" : "pending";
    await updateDoc(matchRef, { status: firestoreStatus });
  };

  const filteredMatches = matches.filter((m) => {
    const searchValue = search.toLowerCase();
    const matchesSearch =
      m.name1.toLowerCase().includes(searchValue) ||
      m.name2.toLowerCase().includes(searchValue);

    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(m.status);

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    if (!statusFilterOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!statusFilterRef.current) return;
      if (!statusFilterRef.current.contains(event.target as Node)) {
        setStatusFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [statusFilterOpen]);

  // global bools for program state
  const programStarted = programState?.started ?? false;
  const matchesFinalized = programState?.matches_final ?? false;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.searchContainer}>
          <SearchIcon className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button
            onClick={() => setConfirmAction("start")}
            className={styles.adminBtn}
            disabled={programStateLoading || startingProgram || programStarted}
          >
            <SendIcon className={styles.icon} />
            {programStarted
              ? "Program Started"
              : startingProgram
                ? "Starting..."
                : "Start Program"}
          </button>
          <button
            onClick={() => setConfirmAction("finalize")}
            className={styles.adminBtn}
            disabled={programStateLoading || finalizing || matchesFinalized}
          >
            <LockOutlinedIcon className={styles.icon} />
            {matchesFinalized
              ? "Matches Locked"
              : finalizing
                ? "Locking..."
                : "Lock In All Matches"}
          </button>
          <button
            onClick={() => setSettingsPopup(true)}
            className={styles.adminBtn}
          >
            <SettingsIcon className={styles.icon} />
            Program Settings
          </button>

          <button
            onClick={handleMatch}
            className={styles.rematchBtn}
            disabled={matching}
          >
            <AutorenewIcon className={styles.icon} />
            {matching ? "Creating..." : "Create Matches"}
          </button>

          <button
            className={styles.adminBtn}
            onClick={() => navigate("/admin/rematching")}
          >
            Manual Rematch
          </button>
          <button
            className={styles.exportBtn}
            onClick={handleExportData}
          >
            Export Data
          </button>
          <button
            className={styles.endProgramBtn}
            onClick={() => {
              setEndConfirmText("");
              setEndProgramError(null);
              setConfirmAction("endProgram");
            }}
          >
            End Program
          </button>
        </div>
        {programStateError && (
          <div className={styles.stateError}>{programStateError}</div>
        )}
      </div>

      {/* ── Confirm overlay (start / finalize / endProgram) ── */}
      {confirmAction && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>

            {/* ── Start / Finalize dialogs (unchanged) ── */}
            {(confirmAction === "start" || confirmAction === "finalize") && (
              <>
                <h3 className={styles.confirmTitle}>
                  {confirmAction === "start"
                    ? "Starting the Program"
                    : "Finalizing..."}
                </h3>
                <p className={styles.confirmText}>
                  {confirmAction === "start"
                    ? "Are you sure you want to start the program?"
                    : "Are you sure you want to lock all matches?"}
                </p>
                <div className={styles.confirmActions}>
                  <button
                    className={styles.cancelButton}
                    onClick={() => setConfirmAction(null)}
                    disabled={startingProgram || finalizing}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.confirmButton}
                    onClick={
                      confirmAction === "start"
                        ? handleStartProgram
                        : handleFinalizeMatches
                    }
                    disabled={startingProgram || finalizing}
                  >
                    Yes, I'm sure
                  </button>
                </div>
              </>
            )}

            {/* ── End Program dialog ── */}
            {confirmAction === "endProgram" && (
              <>
                <h3 className={styles.confirmTitle}>End Program</h3>
                <p className={styles.confirmText}>
                  This will permanently delete all participants, logs, weeks,
                  and matches, and reset the program config. This cannot be
                  undone.
                </p>
                <p className={styles.confirmText}>
                  We recommend exporting your data first.
                </p>
                <div className={styles.confirmActions} style={{ marginBottom: 14 }}>
                  <button
                    className={styles.exportBtn}
                    onClick={handleExportData}
                    disabled={endingProgram}
                  >
                    Export Data
                  </button>
                </div>
                <p className={styles.confirmText} style={{ marginBottom: 8 }}>
                  Type <strong>confirm</strong> to proceed:
                </p>
                <input
                  type="text"
                  value={endConfirmText}
                  onChange={(e) => setEndConfirmText(e.target.value)}
                  placeholder="confirm"
                  className={styles.endConfirmInput}
                  disabled={endingProgram}
                />
                {endProgramError && (
                  <div className={styles.stateError}>{endProgramError}</div>
                )}
                <div className={styles.confirmActions} style={{ marginTop: 16 }}>
                  <button
                    className={styles.cancelButton}
                    onClick={() => {
                      setConfirmAction(null);
                      setEndConfirmText("");
                      setEndProgramError(null);
                    }}
                    disabled={endingProgram}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.endProgramConfirmBtn}
                    onClick={handleEndProgram}
                    disabled={
                      endingProgram ||
                      endConfirmText.toLowerCase() !== "confirm"
                    }
                  >
                    {endingProgram ? "Ending..." : "End Program"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ── Match Table ── */}
      <div className={styles.container}>
        <div className={styles.filterBar} ref={statusFilterRef}>
          <button
            type="button"
            className={styles.filterButton}
            onClick={() => setStatusFilterOpen((open) => !open)}
          >
            <FilterListIcon className={styles.filterIcon} />
            <span>Filter by pair status</span>
          </button>

          {statusFilterOpen && (
            <div className={styles.filterPopover}>
              {(["No Match", "Pending", "Approved"] as MatchStatus[]).map(
                (status) => (
                  <label key={status} className={styles.filterOption}>
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() =>
                        setSelectedStatuses((prev) =>
                          prev.includes(status)
                            ? prev.filter((s) => s !== status)
                            : [...prev, status]
                        )
                      }
                    />
                    <span>{status}</span>
                  </label>
                ),
              )}
              <button
                type="button"
                className={styles.clearFilterButton}
                onClick={() => setSelectedStatuses([])}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Senior</th>
              <th>Final Score %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  No matches yet.
                </td>
              </tr>
            ) : (
              filteredMatches.map((m, i) => (
                <tr key={i}>
                  <td>{m.name1}</td>
                  <td>{m.name2}</td>
                  <td>{m.confidence != null ? `${m.confidence}%` : "—"}</td>
                  <td>
                    {m.status === "No Match" ? (
                      <span className={`${styles.noMatch}`}>No Match</span>
                    ) : (
                      <select
                        value={m.status}
                        onChange={(e) =>
                          handleStatusChange(
                            m.matchId,
                            e.target.value as MatchStatus | "Separate",
                          )
                        }
                        className={`${styles.status} ${
                          m.status === "Approved"
                            ? styles.approved
                            : styles.pending
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Separate">Separate</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <SettingsPopup isOpened={settingsPopup} close={()=>{setSettingsPopup(false)}} program={programState} setProgram = {setProgramState}></SettingsPopup>
    </div>
  );
};

export default PreProgram;