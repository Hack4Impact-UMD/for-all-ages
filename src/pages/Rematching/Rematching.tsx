import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { FaCoffee, FaSearch } from "react-icons/fa";
import styles from "./Rematching.module.css";
import layoutStyles from "../Dashboard/Dashboard.module.css";
import Navbar from "../../components/Navbar";
import ParticipantCard from "./components/ParticipantCard/ParticipantCard";
import SelectedParticipantCard from "./components/SelectedParticipantCard/SelectedParticipantCard";
import MatchConfidenceCircle from "./components/MatchConfidenceCircle/MatchConfidenceCircle";

import {
  PREFERENCE_QUESTION_LABELS,
  PREFERENCE_QUESTION_IDS,
} from "../Registration/preferenceQuestions";

import {
  collection,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db, computeMatchScore } from "../../firebase";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Participant type used on the rematching page.
 * Backed by docs in `participants`.
 */
export interface RematchingParticipant {
  id: string; // Firestore document id
  userUid: string;
  type: "student" | "adult";
  name: string; // displayName from Firestore
  interestsText: string; // raw interests paragraph from Firestore
  school?: string; // university for students
  preferenceScores?: {
    q1?: number;
    q2?: number;
    q3?: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Filters participants based on search query.
 * Matches against name or raw interests text.
 */
const filterParticipants = (
  participants: RematchingParticipant[],
  searchQuery: string
): RematchingParticipant[] => {
  if (!searchQuery.trim()) return participants;

  const searchLower = searchQuery.toLowerCase();
  return participants.filter(
    (participant) =>
      participant.name.toLowerCase().includes(searchLower) ||
      participant.interestsText.toLowerCase().includes(searchLower)
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function Rematching() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<RematchingParticipant[]>([]);
  const [adults, setAdults] = useState<RematchingParticipant[]>([]);
  const [approvedCount, setApprovedCount] = useState<number>(0);

  const [selectedStudent, setSelectedStudent] =
    useState<RematchingParticipant | null>(null);
  const [selectedAdult, setSelectedAdult] =
    useState<RematchingParticipant | null>(null);

  const [studentSearch, setStudentSearch] = useState("");
  const [adultSearch, setAdultSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ==========================================================================
  // DATA LOADER
  // ==========================================================================

  /**
   * Loads:
   *  - all matches from `matches`
   *  - all participants from `participants`
   *
   * Participants shown on the page are:
   *  - those that appear in pending matches, OR
   *  - those that do not appear in ANY match doc (completely unmatched)
   *
   * Approved matches count is simply the number of docs with status === "approved".
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const matchesRef = collection(db, "matches");
      const allMatchesSnap = await getDocs(matchesRef);

      const pendingParticipantIds = new Set<string>();
      const allMatchedIds = new Set<string>();
      let approvedMatchesCount = 0;

      allMatchesSnap.forEach((matchDoc) => {
        const data = matchDoc.data() as any;
        const p1 = data.participant1_id;
        const p2 = data.participant2_id;
        const status = data.status;

        if (!p1 || !p2) return;

        allMatchedIds.add(p1);
        allMatchedIds.add(p2);

        if (status === "approved") {
          approvedMatchesCount += 1;
        } else if (status === "pending") {
          pendingParticipantIds.add(p1);
          pendingParticipantIds.add(p2);
        }
      });

      setApprovedCount(approvedMatchesCount);

      // Fetch all participants
      const participantsRef = collection(db, "participants");
      const participantsSnap = await getDocs(participantsRef);

      const studentsList: RematchingParticipant[] = [];
      const adultsList: RematchingParticipant[] = [];

      participantsSnap.forEach((pDoc) => {
        const data = pDoc.data() as any;
        const id = pDoc.id;

        const userType = (data.user_type ?? data.userType) as
          | "student"
          | "adult"
          | undefined;

        if (userType !== "student" && userType !== "adult") return;

        const isUnmatched = !allMatchedIds.has(id);
        const isInPending = pendingParticipantIds.has(id);

        // Only show:
        //  - people in pending matches, OR
        //  - people not in ANY match doc at all (fully unmatched)
        if (!isUnmatched && !isInPending) {
          return;
        }

        const participant: RematchingParticipant = {
          id,
          userUid: data.userUid ?? "",
          type: userType,
          name:
            data.displayName ?? "Unnamed participant",
          interestsText: data.interests ?? "",
          school: data.university,
          preferenceScores: data.preferenceScores ?? {},
        };

        if (userType === "student") studentsList.push(participant);
        else adultsList.push(participant);
      });

      setStudents(studentsList);
      setAdults(adultsList);
    } catch (err) {
      console.error("Error loading rematching data:", err);
      setLoadError("Failed to load matching data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================================================
  // DERIVED DATA
  // ==========================================================================

  const filteredStudents = useMemo(
    () => filterParticipants(students, studentSearch),
    [students, studentSearch]
  );

  const filteredAdults = useMemo(
    () => filterParticipants(adults, adultSearch),
    [adults, adultSearch]
  );

  // Match score state (calculated via cloud function)
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchPercentage, setMatchPercentage] = useState<number | null>(null);
  const [matchDetails, setMatchDetails] = useState<
    | { frqScore: number; quantScore: number; finalScore: number; confidence: string }
    | null
  >(null);

  // Call computeMatchScore when both participants are selected
  useEffect(() => {
    let mounted = true;

    async function runScore() {
      if (!selectedStudent || !selectedAdult) {
        if (mounted) {
          setMatchPercentage(null);
          setMatchDetails(null);
          setMatchError(null);
        }
        return;
      }

      setMatchLoading(true);
      setMatchError(null);

      try {
        // Use userUid (Firebase auth UID) if available, otherwise Firestore doc id
        const uid1 = selectedStudent.userUid
        const uid2 = selectedAdult.userUid

        const res = await computeMatchScore({ uid1, uid2 });

        if (!mounted) return;

        setMatchPercentage(res.finalPercentage ?? null);
        setMatchDetails({ frqScore: res.frqScore, quantScore: res.quantScore, finalScore: res.finalScore, confidence: res.confidence });
      } catch (err: any) {
        console.error('Error fetching match score:', err);
        if (mounted) setMatchError(String(err));
      } finally {
        if (mounted) setMatchLoading(false);
      }
    }

    runScore();

    return () => {
      mounted = false;
    };
  }, [selectedStudent, selectedAdult]);

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  const handleStudentClick = (student: RematchingParticipant) => {
    setSelectedStudent((prev) => (prev?.id === student.id ? null : student));
  };

  const handleAdultClick = (adult: RematchingParticipant) => {
    setSelectedAdult((prev) => (prev?.id === adult.id ? null : adult));
  };

  /**
   * Approve the currently selected pair.
   *
   * Schema:
   *  - Create a NEW match doc in `matches` with status "approved"
   *  - DELETE all existing match docs (any status) that involve EITHER participant
   *  - This can leave other people from those deleted pairs "dangling"
   *    (unmatched, no reference in matches), which is exactly what we want.
   *  - Then reload all data so stats and columns update.
   */
  const handleConfirmMatch = async () => {
    if (!selectedStudent || !selectedAdult) return;

    try {
      setSaving(true);
      setLoadError(null);

      const matchesRef = collection(db, "matches");

      // 1) Load all current matches so we know which ones to delete
      const allMatchesSnap = await getDocs(matchesRef);

      const batch = writeBatch(db);

      allMatchesSnap.forEach((matchDoc) => {
        const data = matchDoc.data() as any;
        const p1 = data.participant1_id;
        const p2 = data.participant2_id;

        if (!p1 || !p2) return;

        const involvesSelected =
          p1 === selectedStudent.id ||
          p2 === selectedStudent.id ||
          p1 === selectedAdult.id ||
          p2 === selectedAdult.id;

        if (involvesSelected) {
          batch.delete(matchDoc.ref);
        }
      });

      // 2) Create new approved match for the selected pair
      const newMatchRef = doc(matchesRef);
      batch.set(newMatchRef, {
        participant1_id: selectedStudent.id,
        participant2_id: selectedAdult.id,
        status: "approved",
        day_of_call: 0,
        similarity: matchPercentage != null ? Math.round(matchPercentage) : null,
      });

      // 3) Commit changes atomically
      await batch.commit();

      // Clear selection in UI
      setSelectedStudent(null);
      setSelectedAdult(null);

      // 4) Reload everything so:
      //    - A & D (or similar) show up as unmatched
      //    - approvedCount reflects the new match
      await loadData();
    } catch (err) {
      console.error("Error approving match:", err);
      setLoadError("Failed to approve match. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isMatchButtonDisabled = !selectedStudent || !selectedAdult || saving;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className={`${layoutStyles.page} ${styles.rematchingPage}`}>
      <Navbar />
      <div className={`${layoutStyles.surface} ${styles.rematchingSurface}`}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate('/admin/main')}
          aria-label="Back to PreProgram"
        >
          ←
        </button>
        <h1 className={styles.pageTitle}>AI Assisted Matching</h1>
        <h2 className={styles.pageSubtitle}>
          Match students with older adults based on interests and preferences
        </h2>

        {loading && (
          <div className={styles.loadingState}>Loading matches...</div>
        )}
        {loadError && <div className={styles.errorState}>{loadError}</div>}

        {/* Statistics Section */}
        <div className={styles.statistics}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Student Pending Matches</div>
            <div className={styles.statNumber}>{students.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Older Adults Pending Matches</div>
            <div className={styles.statNumber}>{adults.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Approved Matches</div>
            <div className={styles.statNumber}>{approvedCount}</div>
          </div>
        </div>

        {/* Three Column Layout */}
        <div className={styles.columnsContainer}>
          {/* Left Column: Students */}
          <ParticipantColumn
            title="Students"
            subtitle="Select to match"
            participants={filteredStudents}
            selectedId={selectedStudent?.id}
            searchValue={studentSearch}
            onSearchChange={setStudentSearch}
            onParticipantClick={handleStudentClick}
            isStudentColumn={true}
          />

          {/* Middle Column: Match Details */}
          <MatchDetailsColumn
            confidencePercentage={matchPercentage}
            selectedStudent={selectedStudent}
            selectedAdult={selectedAdult}
            isButtonDisabled={isMatchButtonDisabled}
            onConfirmMatch={handleConfirmMatch}
            onDeselectStudent={() => setSelectedStudent(null)}
            onDeselectAdult={() => setSelectedAdult(null)}
            saving={saving}
            matchLoading={matchLoading}
            matchError={matchError}
            matchDetails={matchDetails}
          />

          {/* Right Column: Adults */}
          <ParticipantColumn
            title="Older Adults"
            subtitle="Select to match"
            participants={filteredAdults}
            selectedId={selectedAdult?.id}
            searchValue={adultSearch}
            onSearchChange={setAdultSearch}
            onParticipantClick={handleAdultClick}
            isStudentColumn={false}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ParticipantColumnProps {
  title: string;
  subtitle?: string;
  participants: RematchingParticipant[];
  selectedId: string | undefined;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParticipantClick: (participant: RematchingParticipant) => void;
  isStudentColumn: boolean;
}

function ParticipantColumn({
  title,
  subtitle,
  participants,
  selectedId,
  searchValue,
  onSearchChange,
  onParticipantClick,
  isStudentColumn,
}: ParticipantColumnProps) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <h2 className={styles.columnTitle}>{title}</h2>
        {subtitle && <p className={styles.columnSubtitle}>{subtitle}</p>}
        <div className={styles.searchContainer}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name or interests"
            className={styles.searchInput}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <div className={styles.participantsList}>
        {participants.map((participant) => {
          const isSelected = selectedId === participant.id;
          return (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              isSelected={isSelected}
              onClick={() => onParticipantClick(participant)}
              isStudentColumn={isStudentColumn}
            />
          );
        })}
        {participants.length === 0 && (
          <div className={styles.emptyState}>No {title.toLowerCase()} found</div>
        )}
      </div>
    </div>
  );
}

interface MatchDetailsColumnProps {
  selectedStudent: RematchingParticipant | null;
  selectedAdult: RematchingParticipant | null;
  confidencePercentage: number | null;
  isButtonDisabled: boolean;
  onConfirmMatch: () => void;
  onDeselectStudent: () => void;
  onDeselectAdult: () => void;
  saving: boolean;
  matchLoading?: boolean;
  matchError?: string | null;
  matchDetails?: { frqScore: number; quantScore: number; finalScore: number; confidence: string } | null;
}

/**
 * Match Details Column
 * - Shows selected participants
 * - Shows raw interests paragraphs under their cards
 * - Confirm + Find Different buttons
 */
function MatchDetailsColumn({
  selectedStudent,
  selectedAdult,
  confidencePercentage,
  isButtonDisabled,
  onConfirmMatch,
  onDeselectStudent,
  onDeselectAdult,
  saving,
  matchLoading,
  matchError,
  matchDetails,
}: MatchDetailsColumnProps) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <h2 className={styles.columnTitle}>AI Match Suggestion</h2>
        <p className={styles.columnSubtitle}>
          Review and confirm the suggested pairing
        </p>
      </div>

      {/* Confidence circle (no calculation yet, will show empty/neutral state) */}
      <MatchConfidenceCircle confidencePercentage={confidencePercentage} />

      {/* Match calculation status / breakdown */}
      {matchLoading && (
        <div className={styles.loadingState}>Calculating match...</div>
      )}
      {matchError && (
        <div className={styles.errorState}>{matchError}</div>
      )}
      {!matchLoading &&
        !matchError &&
        confidencePercentage !== null &&
        matchDetails && (
          <div className={styles.matchSummary}>
            <span className={styles.matchSummaryLabel}>Match breakdown</span>
            <div className={styles.matchBreakdown}>
              <span>Free response: {Math.round(matchDetails.frqScore * 100)}%</span>
              <span>·</span>
              <span>Quantitative: {Math.round(matchDetails.quantScore * 100)}%</span>
            </div>
          </div>
      )}

      <div className={styles.matchContainer}>
        {/* Student Card */}
        <SelectedParticipantCard
          label="Student"
          participant={selectedStudent}
          onDeselect={onDeselectStudent}
          type="student"
        />

        {/* Coffee Icon */}
        <div className={styles.coffeeIcon}>
          <FaCoffee size={32} />
        </div>

        {/* Adult Card */}
        <SelectedParticipantCard
          label="Older Adult"
          participant={selectedAdult}
          onDeselect={onDeselectAdult}
          type="adult"
        />

        {/* Raw Interests paragraphs */}
        <div className={styles.interestsContainer}>
          <div className={styles.interestsTitle}>Interests</div>

          <div className={styles.interestsBlock}>
            <div className={styles.interestsRoleLabel}>Student</div>
            <p className={styles.interestsText}>
              {selectedStudent?.interestsText || "No interests provided."}
            </p>
          </div>

          <div className={styles.interestsDivider} />

          <div className={styles.interestsBlock}>
            <div className={styles.interestsRoleLabel}>Older adult</div>
            <p className={styles.interestsText}>
              {selectedAdult?.interestsText || "No interests provided."}
            </p>
          </div>
        </div>

        <div className={styles.quantContainer}>
          <div className={styles.quantTitle}>Quantitative preferences</div>
          <table className={styles.quantTable}>
            <thead>
              <tr>
                <th className={styles.quantQuestionHeader}>Question</th>
                <th className={styles.quantScoreHeader}>Student</th>
                <th className={styles.quantScoreHeader}>Older Adult</th>
              </tr>
            </thead>
            <tbody>
              {PREFERENCE_QUESTION_IDS.map((qid) => (
                <tr key={qid}>
                  <td className={styles.quantQuestionCell}>
                    {PREFERENCE_QUESTION_LABELS[qid]}
                  </td>
                  <td className={styles.quantScoreCell}>
                    {selectedStudent?.preferenceScores?.[qid] ?? "—"}
                  </td>
                  <td className={styles.quantScoreCell}>
                    {selectedAdult?.preferenceScores?.[qid] ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Button Container */}
        <div className={styles.buttonContainer}>
          <button
            className={styles.findDifferentButton}
            onClick={() => {
              onDeselectStudent();
              onDeselectAdult();
            }}
            disabled={isButtonDisabled}
          >
            Find a Different Match
          </button>
          <button
            className={`${styles.confirmButton} ${
              isButtonDisabled ? styles.disabled : ""
            }`}
            onClick={onConfirmMatch}
            disabled={isButtonDisabled}
          >
            {saving ? "Approving..." : "Confirm Match"}
          </button>
        </div>
      </div>
    </div>
  );
}
