import { useMemo, useState } from "react";
import { FaCoffee, FaSearch } from "react-icons/fa";
import styles from "./Rematching.module.css";
import layoutStyles from "../Dashboard/Dashboard.module.css";
import Navbar from "../../components/Navbar";
import type { Participant as BaseParticipant } from "../../types";
import ParticipantCard from "./components/ParticipantCard/ParticipantCard";
import SelectedParticipantCard from "./components/SelectedParticipantCard/SelectedParticipantCard";
import MatchConfidenceCircle from "./components/MatchConfidenceCircle/MatchConfidenceCircle";
import {
  INITIAL_STUDENTS,
  INITIAL_ADULTS,
  INITIAL_APPROVED_MATCHES,
} from "./data";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extended Participant type for rematching functionality.
 * Adds fields needed for the matching process: id, type, interests array, and school.
 */
export interface RematchingParticipant extends BaseParticipant {
  id: string;
  type: "student" | "adult";
  interests: string[];
  school?: string; // School name for students
}

/**
 * Simplified match type for tracking approved matches in the rematching interface.
 * Maps to the Match type from the main types.ts but uses participant IDs directly.
 */
export interface ApprovedMatch {
  studentId: string;
  adultId: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Filters participants based on search query.
 * Matches against name or any interest.
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
      participant.interests.some((interest) =>
        interest.toLowerCase().includes(searchLower)
      )
  );
};

/**
 * Calculates match confidence percentage based on common interests.
 * Formula: (Intersection of interests / Union of interests) * 100
 */
const calculateConfidence = (
  student: RematchingParticipant | null,
  adult: RematchingParticipant | null
): number | null => {
  if (!student || !adult) return null;

  const studentInterests = new Set(student.interests);
  const adultInterests = new Set(adult.interests);

  // Find common interests (intersection)
  const intersection = new Set(
    [...studentInterests].filter((interest) => adultInterests.has(interest))
  );

  // Find all unique interests (union)
  const union = new Set([...studentInterests, ...adultInterests]);

  return union.size > 0
    ? Math.round((intersection.size / union.size) * 100)
    : 0;
};

/**
 * Gets the list of common interests between a student and adult.
 */
const getCommonInterests = (
  student: RematchingParticipant | null,
  adult: RematchingParticipant | null
): string[] => {
  if (!student || !adult) return [];

  const studentInterests = new Set(student.interests);
  const adultInterests = new Set(adult.interests);

  return [...studentInterests].filter((interest) =>
    adultInterests.has(interest)
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Rematching Page Component
 *
 * Allows admins to manually create matches between students and adults.
 * Features:
 * - View pending students and adults
 * - Search by name or interests
 * - Select participants to see match confidence
 * - Confirm matches to remove them from pending lists
 */
export default function Rematching() {
  // State management
  const [students, setStudents] =
    useState<RematchingParticipant[]>(INITIAL_STUDENTS);
  const [adults, setAdults] = useState<RematchingParticipant[]>(INITIAL_ADULTS);
  const [approvedMatches, setApprovedMatches] = useState<ApprovedMatch[]>(
    INITIAL_APPROVED_MATCHES
  );
  const [selectedStudent, setSelectedStudent] =
    useState<RematchingParticipant | null>(null);
  const [selectedAdult, setSelectedAdult] =
    useState<RematchingParticipant | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [adultSearch, setAdultSearch] = useState("");

  // Filtered participants based on search
  const filteredStudents = useMemo(
    () => filterParticipants(students, studentSearch),
    [students, studentSearch]
  );

  const filteredAdults = useMemo(
    () => filterParticipants(adults, adultSearch),
    [adults, adultSearch]
  );

  // Match calculations
  const confidencePercentage = useMemo(
    () => calculateConfidence(selectedStudent, selectedAdult),
    [selectedStudent, selectedAdult]
  );

  const commonInterests = useMemo(
    () => getCommonInterests(selectedStudent, selectedAdult),
    [selectedStudent, selectedAdult]
  );

  // Event handlers
  const handleStudentClick = (student: RematchingParticipant) => {
    setSelectedStudent((prev) => (prev?.id === student.id ? null : student));
  };

  const handleAdultClick = (adult: RematchingParticipant) => {
    setSelectedAdult((prev) => (prev?.id === adult.id ? null : adult));
  };

  const handleConfirmMatch = () => {
    if (!window.confirm("Confirm this match?")) return;
    if (!selectedStudent || !selectedAdult) return;

    // Remove matched participants from pending lists
    setStudents((prev) => prev.filter((s) => s.id !== selectedStudent.id));
    setAdults((prev) => prev.filter((a) => a.id !== selectedAdult.id));

    // Add to approved matches
    setApprovedMatches((prev) => [
      ...prev,
      { studentId: selectedStudent.id, adultId: selectedAdult.id },
    ]);

    // Clear selection
    setSelectedStudent(null);
    setSelectedAdult(null);
  };

  const isMatchButtonDisabled = !selectedStudent || !selectedAdult;

  return (
    <div className={`${layoutStyles.page} ${styles.rematchingPage}`}>
      <Navbar />
      <div className={`${layoutStyles.surface} ${styles.rematchingSurface}`}>
        <h1 className={styles.pageTitle}>AI Assisted Matching</h1>
        <h2 className={styles.pageSubtitle}>
          Match students with older adults based on interests and preferences
        </h2>

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
            <div className={styles.statNumber}>{approvedMatches.length}</div>
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
            confidencePercentage={confidencePercentage}
            selectedStudent={selectedStudent}
            selectedAdult={selectedAdult}
            commonInterests={commonInterests}
            isButtonDisabled={isMatchButtonDisabled}
            onConfirmMatch={handleConfirmMatch}
            onDeselectStudent={() => setSelectedStudent(null)}
            onDeselectAdult={() => setSelectedAdult(null)}
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

/**
 * Participant Column Component
 * Displays a list of participants (students or adults) with search functionality.
 */
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
            placeholder="Search by name or interest..."
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
          <div className={styles.emptyState}>
            No {title.toLowerCase()} found
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Match Details Column Component
 * Displays selected participants, confidence percentage, common interests, and confirm button.
 */
interface MatchDetailsColumnProps {
  selectedStudent: RematchingParticipant | null;
  selectedAdult: RematchingParticipant | null;
  confidencePercentage: number | null;
  commonInterests: string[];
  isButtonDisabled: boolean;
  onConfirmMatch: () => void;
  onDeselectStudent: () => void;
  onDeselectAdult: () => void;
}

function MatchDetailsColumn({
  selectedStudent,
  selectedAdult,
  confidencePercentage,
  commonInterests,
  isButtonDisabled,
  onConfirmMatch,
  onDeselectStudent,
  onDeselectAdult,
}: MatchDetailsColumnProps) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <h2 className={styles.columnTitle}>AI Match Suggestion</h2>
        <p className={styles.columnSubtitle}>
          Review and confirm the suggested pairing
        </p>
      </div>
      {/* Confidence Circle */}
      <MatchConfidenceCircle confidencePercentage={confidencePercentage} />
      <div className={styles.matchContainer}>
        {/* Student Card - Always visible */}
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

        {/* Adult Card - Always visible */}
        <SelectedParticipantCard
          label="Older Adult"
          participant={selectedAdult}
          onDeselect={onDeselectAdult}
          type="adult"
        />

        {/* Common Interests */}
        <div className={styles.commonInterestsCard}>
          <div className={styles.commonInterestsLabel}>Common Interests</div>
          <div className={styles.commonInterests}>
            {commonInterests.length > 0 ? (
              commonInterests.map((interest, idx) => (
                <span key={idx} className={styles.commonInterestTag}>
                  {interest}
                </span>
              ))
            ) : (
              <div className={styles.emptyInterests}>—</div>
            )}
          </div>
        </div>

        {/* Button Container */}
        <div className={styles.buttonContainer}>
          {/* Find Different Match Button */}
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
          {/* Confirm Match Button */}
          <button
            className={`${styles.confirmButton} ${
              isButtonDisabled ? styles.disabled : ""
            }`}
            onClick={onConfirmMatch}
            disabled={isButtonDisabled}
          >
            Confirm Match
          </button>
        </div>
      </div>
    </div>
  );
}
