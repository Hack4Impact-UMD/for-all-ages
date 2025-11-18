import { useState, useMemo, useEffect } from "react";
import { FaCoffee, FaSearch } from "react-icons/fa";
import styles from "./Rematching.module.css";
import layoutStyles from "../Dashboard/Dashboard.module.css";
import Navbar from "../../components/Navbar";
import type { Participant as BaseParticipant } from "../../types";
import ParticipantCard from "./components/ParticipantCard/ParticipantCard";
import SelectedParticipantCard from "./components/SelectedParticipantCard/SelectedParticipantCard";
import MatchConfidenceCircle from "./components/MatchConfidenceCircle/MatchConfidenceCircle";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extended Participant type for rematching functionality.
 * Adds fields needed for the matching process: id, type, interests array, and school.
 */
export interface RematchingParticipant extends BaseParticipant {
  id: string;
  type: "student" | "senior";
  interests: string[];
  school?: string; // School name for students
}

/**
 * Simplified match type for tracking approved matches in the rematching interface.
 * Maps to the Match type from the main types.ts but uses participant IDs directly.
 */
export interface ApprovedMatch {
  studentId: string;
  seniorId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const NAV_ITEMS = [
  { label: "Main", path: "/admin/main" },
  { label: "Dashboard", path: "/admin/rematching" },
  { label: "Profile", path: "/admin/profile" },
];

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
  senior: RematchingParticipant | null
): number | null => {
  if (!student || !senior) return null;

  const studentInterests = new Set(student.interests);
  const adultInterests = new Set(senior.interests);

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
 * Gets the list of common interests between a student and senior.
 */
const getCommonInterests = (
  student: RematchingParticipant | null,
  senior: RematchingParticipant | null
): string[] => {
  if (!student || !senior) return [];

  const studentInterests = new Set(student.interests);
  const adultInterests = new Set(senior.interests);

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
    useState<RematchingParticipant[]>([]);
  const [adults, setAdults] = useState<RematchingParticipant[]>([]);
  const [approvedMatches, setApprovedMatches] = useState<ApprovedMatch[]>(
    []
  );
  const [selectedStudent, setSelectedStudent] =
    useState<RematchingParticipant | null>(null);
  const [selectedAdult, setSelectedAdult] =
    useState<RematchingParticipant | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [adultSearch, setAdultSearch] = useState("");
  const [confidencePercentage, setConfidencePercentage] = useState<number | null>(null);

  useEffect(() => {
    async function fetchRematchingData() {
      try {
        // Fetch low similarity matches
        const matchesResponse = await fetch('/api/low-similarity-matches?threshold=0.8&collection=matches');
        if (!matchesResponse.ok) {
          throw new Error(`Failed to fetch matches: ${matchesResponse.status}`);
        }
        const matchesData = await matchesResponse.json();

        if (matchesData.participantIds && matchesData.participantIds.length > 0) {
          // Clean IDs here too
          const cleanIds = matchesData.participantIds.map((id: string) => id.trim());
          
          const participantsResponse = await fetch('/api/participants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: cleanIds }),
          });

          if (!participantsResponse.ok) {
            throw new Error(`Failed to fetch participants: ${participantsResponse.status}`);
          }

          const participants = await participantsResponse.json();
          
          // Separate into students and seniors based on type
          const studentsData = participants.filter((p: any) => p.type === 'student');
          const seniorsData = participants.filter((p: any) => p.type === 'senior');
                    
          setStudents(studentsData);
          setAdults(seniorsData);
        } else {
          setStudents([]);
          setAdults([]);
        }
      } catch (error) {
        console.error('Failed to fetch rematching data:', error);
        setStudents([]);
        setAdults([]);
      }
    }

    fetchRematchingData();
  }, []);


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
  useEffect(() => {
    async function computeConfidence() {
      if (selectedStudent?.id && selectedAdult?.id) {
        try {
          const res = await fetch(
            `/api/confidence-score?participantIdA=${encodeURIComponent(selectedStudent.id)}&participantIdB=${encodeURIComponent(selectedAdult.id)}`
          );

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const data = await res.json();
          const score = data.score ? data.score * 100.00 : null;
          setConfidencePercentage(Number(score?.toFixed(1)));
        } catch (error) {
          console.error('Failed to fetch confidence score:', error);
          setConfidencePercentage(null);
        }
      } else {
        setConfidencePercentage(null);
      }
    }


    computeConfidence();
  }, [selectedStudent, selectedAdult]);

  const commonInterests = useMemo(
    () => getCommonInterests(selectedStudent, selectedAdult),
    [selectedStudent, selectedAdult]
  );

  // Event handlers
  const handleStudentClick = (student: RematchingParticipant) => {
    setSelectedStudent((prev) => (prev?.id === student.id ? null : student));
  };

  const handleAdultClick = (senior: RematchingParticipant) => {
    setSelectedAdult((prev) => (prev?.id === senior.id ? null : senior));
  };

  const handleConfirmMatch = () => {
    if (!selectedStudent || !selectedAdult) return;

    // Remove matched participants from pending lists
    setStudents((prev) => prev.filter((s) => s.id !== selectedStudent.id));
    setAdults((prev) => prev.filter((a) => a.id !== selectedAdult.id));

    // Add to approved matches
    setApprovedMatches((prev) => [
      ...prev,
      { studentId: selectedStudent.id, seniorId: selectedAdult.id },
    ]);

    // Clear selection
    setSelectedStudent(null);
    setSelectedAdult(null);
  };

  const isMatchButtonDisabled = !selectedStudent || !selectedAdult;

  return (
    <div className={`${layoutStyles.page} ${styles.rematchingPage}`}>
      <Navbar navItems={NAV_ITEMS} />
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
          type="senior"
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

