import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaCoffee, FaSearch } from "react-icons/fa";
import styles from "./Rematching.module.css";
import layoutStyles from "../Dashboard/Dashboard.module.css";
import ParticipantCard from "./components/ParticipantCard/ParticipantCard";
import SelectedParticipantCard from "./components/SelectedParticipantCard/SelectedParticipantCard";
import MatchConfidenceCircle from "./components/MatchConfidenceCircle/MatchConfidenceCircle";
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import { db, computeMatchScore } from "../../firebase";
import type { Form, Question, RematchingParticipant } from "../../types";

export type { RematchingParticipant } from "../../types";

type MatchableQuestionEntry = {
  title: string;
  type: Question["type"];
};

const filterParticipants = (participants: RematchingParticipant[], searchQuery: string) => {
  if (!searchQuery.trim()) return participants;
  const searchLower = searchQuery.toLowerCase();
  return participants.filter(
    (participant) =>
      participant.name.toLowerCase().includes(searchLower) ||
      participant.interestsText.toLowerCase().includes(searchLower)
  );
};

const buildMatchableQuestionEntries = (form: Form | null): MatchableQuestionEntry[] => {
  if (!form) return [];
  const entries: MatchableQuestionEntry[] = [];
  form.sections.forEach((section) => {
    section.questions.forEach((question) => {
      if (question.matchable) entries.push({ title: question.title, type: question.type });
    });
  });
  return entries;
};

const normalizePronouns = (value?: string | null): string => (value ?? "").trim().toLowerCase().replace(/\\/g, "/");
const normalizeRole = (value?: string | null): "student" | "adult" | null => {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "student") return "student";
  if (raw === "adult" || raw === "senior" || raw === "older adult") return "adult";
  return null;
};

const shouldShowGenderWarning = (
  studentPronouns?: string | null,
  adultPronouns?: string | null
): boolean => {
  const student = normalizePronouns(studentPronouns);
  const adult = normalizePronouns(adultPronouns);

  const hasNeutralPronouns = [student, adult].some(
    (p) => p === "they/them" || p === "other"
  );
  if (hasNeutralPronouns) return false;

  return (
    (student === "she/her" && adult === "he/him") ||
    (student === "he/him" && adult === "she/her")
  );
};

const extractPronounsFromResponses = (participant: RematchingParticipant | null): string | null => {
  if (!participant?.matchableAnswers) return null;
  const entries = Object.entries(participant.matchableAnswers);
  const pronounsEntry = entries.find(([title]) => {
    const normalizedTitle = title.trim().toLowerCase();
    return normalizedTitle.includes("pronouns") || normalizedTitle.includes("gender");
  });
  if (!pronounsEntry) return null;
  const [, value] = pronounsEntry;
  if (value == null) return null;
  return String(value).trim().replace(/\\/g, "/");
};

const getParticipantPronouns = (participant: RematchingParticipant | null): string | null => {
  if (!participant) return null;
  const directPronouns =
    typeof participant.pronouns === "string" ? participant.pronouns.trim() : null;
  const responsePronouns = extractPronounsFromResponses(participant);
  return directPronouns || responsePronouns || null;
};

export default function Rematching() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<RematchingParticipant[]>([]);
  const [adults, setAdults] = useState<RematchingParticipant[]>([]);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [matchableQuestions, setMatchableQuestions] = useState<MatchableQuestionEntry[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<RematchingParticipant | null>(null);
  const [selectedAdult, setSelectedAdult] = useState<RematchingParticipant | null>(null);
  const [studentCompatibilityScores, setStudentCompatibilityScores] = useState<
    Record<string, number | null>
  >({});
  const [adultCompatibilityScores, setAdultCompatibilityScores] = useState<
    Record<string, number | null>
  >({});

  const [studentSearch, setStudentSearch] = useState("");
  const [adultSearch, setAdultSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [genderWarningOpen, setGenderWarningOpen] = useState(false);

  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchPercentage, setMatchPercentage] = useState<number | null>(null);
  const [matchDetails, setMatchDetails] = useState<
    | { frqScore: number; quantScore: number; finalScore: number; confidence: string }
    | null
  >(null);

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
        const normalizedStatus =
          typeof status === "string" ? status.trim().toLowerCase() : "missing";
        if (!p1 || !p2) return;

        allMatchedIds.add(p1);
        allMatchedIds.add(p2);
        if (normalizedStatus === "approved") approvedMatchesCount += 1;
        if (normalizedStatus === "pending") {
          pendingParticipantIds.add(p1);
          pendingParticipantIds.add(p2);
        }
      });
      setApprovedCount(approvedMatchesCount);

      const registrationFormRef = doc(db, "config", "registrationForm");
      const registrationFormSnap = await getDoc(registrationFormRef);
      const registrationForm = registrationFormSnap.exists()
        ? (registrationFormSnap.data() as Form)
        : null;
      const nextMatchableQuestions = buildMatchableQuestionEntries(registrationForm);
      setMatchableQuestions(nextMatchableQuestions);

      const formResponsesRef = collection(db, "FormResponse");
      const formResponsesSnap = await getDocs(formResponsesRef);
      const responsesByUid = new Map<string, Record<string, string | number>>();
      formResponsesSnap.forEach((responseDoc) => {
        const data = responseDoc.data() as any;
        const uid = responseDoc.id;
        const questions = Array.isArray(data.questions) ? data.questions : [];
        const answers: Record<string, string | number> = {};

        questions.forEach((entry: any) => {
          if (typeof entry?.title !== "string") return;
          answers[entry.title] = entry?.answer ?? "—";
        });
        responsesByUid.set(uid, answers);
      });

      const participantsRef = collection(db, "participants");
      const participantsSnap = await getDocs(participantsRef);

      // Fetch waitlisted IDs to exclude from matching
      const waitlistSnap = await getDocs(collection(db, "waitlist"));
      const waitlistedIds = new Set(waitlistSnap.docs.map((d) => d.id));

      const studentsList: RematchingParticipant[] = [];
      const adultsList: RematchingParticipant[] = [];

      participantsSnap.forEach((pDoc) => {
        const data = pDoc.data() as any;
        const id = pDoc.id;

        if (waitlistedIds.has(id)) return;

        const rawRole = (data.user_type ?? data.userType ?? data.role ?? "") as string;
        const userType = normalizeRole(rawRole);
        const userUid = (data.userUid ?? id) as string;
        if (!userType) return;

        const isInPending = pendingParticipantIds.has(id) || pendingParticipantIds.has(userUid);
        const hasCurrentMatch = allMatchedIds.has(id) || allMatchedIds.has(userUid);
        if (hasCurrentMatch) return;
        if (isInPending) return;

        const responseAnswers =
          responsesByUid.get(data.userUid ?? id) ?? responsesByUid.get(id) ?? {};
        const preferenceScores = data.preferenceScores ?? {};
        const sliderQuestions = nextMatchableQuestions.filter((q) => q.type === "Slider");

        const q1Title = sliderQuestions[0]?.title;
        const q2Title = sliderQuestions[1]?.title;
        const q3Title = sliderQuestions[2]?.title;
        if (q1Title && responseAnswers[q1Title] == null && preferenceScores.q1 != null) {
          responseAnswers[q1Title] = preferenceScores.q1;
        }
        if (q2Title && responseAnswers[q2Title] == null && preferenceScores.q2 != null) {
          responseAnswers[q2Title] = preferenceScores.q2;
        }
        if (q3Title && responseAnswers[q3Title] == null && preferenceScores.q3 != null) {
          responseAnswers[q3Title] = preferenceScores.q3;
        }

        const participant: RematchingParticipant = {
          id,
          userUid,
          type: userType,
          name: data.displayName ?? "Unnamed participant",
          interestsText: data.interests ?? "",
          school: data.university,
          preferenceScores,
          pronouns: data.pronouns ?? null,
          matchableAnswers: responseAnswers,
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
        const res = await computeMatchScore({
          uid1: selectedStudent.userUid,
          uid2: selectedAdult.userUid,
        });
        if (!mounted) return;
        setMatchPercentage(res.finalPercentage ?? null);
        setMatchDetails({
          frqScore: res.frqScore,
          quantScore: res.quantScore,
          finalScore: res.finalScore,
          confidence: res.confidence,
        });
      } catch (err: any) {
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

  useEffect(() => {
    let cancelled = false;
    async function computeAdultScores() {
      if (!selectedStudent) {
        setAdultCompatibilityScores({});
        return;
      }
      const pairs = await Promise.all(
        adults.map(async (adult) => {
          if (!selectedStudent.userUid || !adult.userUid) return [adult.id, null] as const;
          try {
            const res = await computeMatchScore({
              uid1: selectedStudent.userUid,
              uid2: adult.userUid,
            });
            return [adult.id, res.finalPercentage ?? null] as const;
          } catch {
            return [adult.id, null] as const;
          }
        })
      );
      if (!cancelled) setAdultCompatibilityScores(Object.fromEntries(pairs));
    }
    computeAdultScores();
    return () => {
      cancelled = true;
    };
  }, [selectedStudent, adults]);

  useEffect(() => {
    let cancelled = false;
    async function computeStudentScores() {
      if (!selectedAdult) {
        setStudentCompatibilityScores({});
        return;
      }
      const pairs = await Promise.all(
        students.map(async (student) => {
          if (!student.userUid || !selectedAdult.userUid) return [student.id, null] as const;
          try {
            const res = await computeMatchScore({
              uid1: student.userUid,
              uid2: selectedAdult.userUid,
            });
            return [student.id, res.finalPercentage ?? null] as const;
          } catch {
            return [student.id, null] as const;
          }
        })
      );
      if (!cancelled) setStudentCompatibilityScores(Object.fromEntries(pairs));
    }
    computeStudentScores();
    return () => {
      cancelled = true;
    };
  }, [selectedAdult, students]);

  const filteredStudents = useMemo(
    () => filterParticipants(students, studentSearch),
    [students, studentSearch]
  );
  const filteredAdults = useMemo(
    () => filterParticipants(adults, adultSearch),
    [adults, adultSearch]
  );

  const handleStudentClick = (student: RematchingParticipant) => {
    if (student.type !== "student") return;
    setSelectedStudent((prev) => (prev?.id === student.id ? null : student));
  };
  const handleAdultClick = (adult: RematchingParticipant) => {
    if (adult.type !== "adult") return;
    setSelectedAdult((prev) => (prev?.id === adult.id ? null : adult));
  };

  const handleConfirmMatch = async () => {
    if (!selectedStudent || !selectedAdult) return;
    if (selectedStudent.type !== "student" || selectedAdult.type !== "adult") {
      setLoadError("Manual rematching only allows student to older adult pairs.");
      return;
    }
    try {
      setSaving(true);
      setLoadError(null);
      const matchesRef = collection(db, "matches");
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
        if (involvesSelected) batch.delete(matchDoc.ref);
      });

      const newMatchRef = doc(matchesRef);
      batch.set(newMatchRef, {
        participant1_id: selectedStudent.id,
        participant2_id: selectedAdult.id,
        status: "approved",
        similarity: matchPercentage != null ? Math.round(matchPercentage) : null,
      });

      await batch.commit();
      setSelectedStudent(null);
      setSelectedAdult(null);
      await loadData();
    } catch (err) {
      console.error("Error approving match:", err);
      setLoadError("Failed to approve match. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmButtonClick = () => {
    if (!selectedStudent || !selectedAdult) return;

    const studentPronouns = getParticipantPronouns(selectedStudent);
    const adultPronouns = getParticipantPronouns(selectedAdult);

    if (shouldShowGenderWarning(studentPronouns, adultPronouns)) {
      setGenderWarningOpen(true);
      return;
    }
    void handleConfirmMatch();
  };

  const isMatchButtonDisabled = !selectedStudent || !selectedAdult || saving;

  return (
    <div className={`${layoutStyles.page} ${styles.rematchingPage}`}>
      <div className={`${layoutStyles.surface} ${styles.rematchingSurface}`}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate("/admin/main")}
          aria-label="Back to PreProgram"
        >
          ←
        </button>
        <h1 className={styles.pageTitle}>AI Assisted Matching</h1>
        <h2 className={styles.pageSubtitle}>
          Match students with older adults based on interests and preferences
        </h2>

        {loading && <div className={styles.loadingState}>Loading matches...</div>}
        {loadError && <div className={styles.errorState}>{loadError}</div>}

        <div className={styles.statistics}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Eligible Students</div>
            <div className={styles.statNumber}>{students.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Eligible Older Adults</div>
            <div className={styles.statNumber}>{adults.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Approved Matches</div>
            <div className={styles.statNumber}>{approvedCount}</div>
          </div>
        </div>

        <div className={styles.columnsContainer}>
          <ParticipantColumn
            title="Students"
            subtitle="Select to match"
            participants={filteredStudents}
            selectedId={selectedStudent?.id}
            searchValue={studentSearch}
            onSearchChange={setStudentSearch}
            onParticipantClick={handleStudentClick}
            isStudentColumn={true}
            compatibilityScores={studentCompatibilityScores}
          />

          <MatchDetailsColumn
            confidencePercentage={matchPercentage}
            selectedStudent={selectedStudent}
            selectedAdult={selectedAdult}
            isButtonDisabled={isMatchButtonDisabled}
            onConfirmButtonClick={handleConfirmButtonClick}
            onDeselectStudent={() => setSelectedStudent(null)}
            onDeselectAdult={() => setSelectedAdult(null)}
            saving={saving}
            matchLoading={matchLoading}
            matchError={matchError}
            matchDetails={matchDetails}
            matchableQuestions={matchableQuestions}
          />

          <ParticipantColumn
            title="Older Adults"
            subtitle="Select to match"
            participants={filteredAdults}
            selectedId={selectedAdult?.id}
            searchValue={adultSearch}
            onSearchChange={setAdultSearch}
            onParticipantClick={handleAdultClick}
            isStudentColumn={false}
            compatibilityScores={adultCompatibilityScores}
          />
        </div>
      </div>

      {genderWarningOpen && (
        <div className={styles.warningModalBackdrop} role="presentation">
          <div className={styles.warningModal} role="dialog" aria-modal="true">
            <h3 className={styles.warningTitle}>Gender compatibility warning</h3>
            <p className={styles.warningText}>
              This pairing is She/Her with He/Him. You can still continue if this is an
              appropriate manual match.
            </p>
            <div className={styles.warningActions}>
              <button
                type="button"
                className={styles.findDifferentButton}
                onClick={() => setGenderWarningOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={() => {
                  setGenderWarningOpen(false);
                  void handleConfirmMatch();
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ParticipantColumnProps {
  title: string;
  subtitle?: string;
  participants: RematchingParticipant[];
  selectedId: string | undefined;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParticipantClick: (participant: RematchingParticipant) => void;
  isStudentColumn: boolean;
  compatibilityScores?: Record<string, number | null>;
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
  compatibilityScores,
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
              compatibilityPercentage={compatibilityScores?.[participant.id] ?? null}
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
  onConfirmButtonClick: () => void;
  onDeselectStudent: () => void;
  onDeselectAdult: () => void;
  saving: boolean;
  matchLoading?: boolean;
  matchError?: string | null;
  matchDetails?: { frqScore: number; quantScore: number; finalScore: number; confidence: string } | null;
  matchableQuestions: MatchableQuestionEntry[];
}

function MatchDetailsColumn({
  selectedStudent,
  selectedAdult,
  confidencePercentage,
  isButtonDisabled,
  onConfirmButtonClick,
  onDeselectStudent,
  onDeselectAdult,
  saving,
  matchLoading,
  matchError,
  matchDetails,
  matchableQuestions,
}: MatchDetailsColumnProps) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <h2 className={styles.columnTitle}>AI Match Suggestion</h2>
        <p className={styles.columnSubtitle}>Review and confirm the suggested pairing</p>
      </div>

      <MatchConfidenceCircle confidencePercentage={confidencePercentage} />

      {matchLoading && <div className={styles.loadingState}>Calculating match...</div>}
      {matchError && <div className={styles.errorState}>{matchError}</div>}
      {!matchLoading && !matchError && confidencePercentage !== null && matchDetails && (
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
        <SelectedParticipantCard
          label="Student"
          participant={selectedStudent}
          onDeselect={onDeselectStudent}
          type="student"
          pronouns={getParticipantPronouns(selectedStudent)}
        />

        <div className={styles.coffeeIcon}>
          <FaCoffee size={32} />
        </div>

        <SelectedParticipantCard
          label="Older Adult"
          participant={selectedAdult}
          onDeselect={onDeselectAdult}
          type="adult"
          pronouns={getParticipantPronouns(selectedAdult)}
        />

        {(() => {
          const frqTypes = new Set(["short_input", "medium_input", "long_input"]);
          const numericQuestions = matchableQuestions.filter(q => !frqTypes.has(q.type));
          const frqQuestions = matchableQuestions.filter(q => frqTypes.has(q.type));
          return (
            <>
              {numericQuestions.length > 0 && (
                <div className={styles.quantContainer}>
                  <div className={styles.quantTitle}>Quantitative</div>
                  <table className={styles.quantTable}>
                    <thead>
                      <tr>
                        <th className={styles.quantQuestionHeader}>Question</th>
                        <th className={styles.quantScoreHeader}>Student</th>
                        <th className={styles.quantScoreHeader}>Older Adult</th>
                      </tr>
                    </thead>
                    <tbody>
                      {numericQuestions.map((question) => (
                        <tr key={question.title}>
                          <td className={styles.quantQuestionCell}>{question.title}</td>
                          <td className={styles.quantScoreCell}>
                            {selectedStudent?.matchableAnswers?.[question.title] ?? "—"}
                          </td>
                          <td className={styles.quantScoreCell}>
                            {selectedAdult?.matchableAnswers?.[question.title] ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {frqQuestions.length > 0 && (
                <div className={styles.frqContainer}>
                  <div className={styles.quantTitle}>Free Response</div>
                  {frqQuestions.map((question) => (
                    <div key={question.title} className={styles.frqQuestion}>
                      <div className={styles.frqQuestionTitle}>{question.title}</div>
                      <table className={styles.frqTable}>
                          <tr>
                            <td className={styles.frqCell}>
                              {selectedStudent?.matchableAnswers?.[question.title] ?? "—"}
                            </td>
                            <td className={styles.frqCell}>
                              {selectedAdult?.matchableAnswers?.[question.title] ?? "—"}
                            </td>
                          </tr>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

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
            className={`${styles.confirmButton} ${isButtonDisabled ? styles.disabled : ""}`}
            onClick={onConfirmButtonClick}
            disabled={isButtonDisabled}
          >
            {saving ? "Approving..." : "Confirm Match"}
          </button>
        </div>
      </div>
    </div>
  );
}
