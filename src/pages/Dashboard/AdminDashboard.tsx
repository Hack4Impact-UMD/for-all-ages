import { useMemo, useState, useEffect } from 'react'
import layoutStyles from './Dashboard.module.css'
import adminStyles from './AdminDashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import PersonTag from './components/PersonTag/PersonTag'
import Navbar from '../../components/Navbar'
import { getAllMatches } from '../../services/matches'
import { getWeek } from '../../services/weeks'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import type { Match, Week, DayKey, PersonAssignment } from '../../types'
import { subscribeToProgramState, type ProgramState } from '../../services/programState'

const DAY_LABELS: DayKey[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thurs",
  "Fri",
  "Sat",
];

const WEEKS = 20;
const CURRENT_GLOBAL_WEEK = 4; // will be determined through firebase

export default function AdminDashboard() {
    const [selectedWeek, setSelectedWeek] = useState(0) // 0-indexed (Week 1)
    const [allMatches, setAllMatches] = useState<(Match & { id: string })[]>([])
    const [weekData, setWeekData] = useState<Week | null>(null)
    const [participantNames, setParticipantNames] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [matchesLoading, setMatchesLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [programState, setProgramState] = useState<ProgramState | null>(null)

    useEffect(() => {
        const unsubscribe = subscribeToProgramState(
            (state) => {
                setProgramState(state)
            },
            (err) => {
                console.error('ProgramState subscription error', err)
            }
        )

        return unsubscribe
    }, [])

    // Update selected week when programState.week changes
    useEffect(() => {
        if (programState && typeof programState.week === 'number') {
            const nextWeekIndex = Math.max(0, programState.week - 1)
            setSelectedWeek(nextWeekIndex)
        }
    }, [programState?.week])

  // Fetch all matches once on mount
  useEffect(() => {
    async function loadMatches() {
      try {
        setMatchesLoading(true);
        setError(null);
        console.log("Loading matches...");

        const matchesData = await getAllMatches();
        console.log(`Loaded ${matchesData.length} matches`);
        setAllMatches(matchesData);

        // Fetch participant names for all participants in matches
        const uniqueParticipantIds = new Set<string>();
        matchesData.forEach((match) => {
          uniqueParticipantIds.add(match.participant1_id);
          uniqueParticipantIds.add(match.participant2_id);
        });

        console.log(
          `Fetching names for ${uniqueParticipantIds.size} participants...`
        );

        // Fetch names from participants collection
        const names: Record<string, string> = {};
        const participantFetches = Array.from(uniqueParticipantIds).map(
          async (participantId) => {
            try {
              const participantRef = doc(db, "participants", participantId);
              const participantDoc = await getDoc(participantRef);
              if (participantDoc.exists()) {
                const data = participantDoc.data();
                return {
                  participantId,
                  name:
                    data.displayName || data.name || data.email || "Unknown",
                };
              } else {
                return { participantId, name: "Unknown" };
              }
            } catch (participantErr) {
              console.warn(
                `Failed to fetch participant ${participantId}:`,
                participantErr
              );
              return { participantId, name: "Unknown" };
            }
          }
        );
        const participantResults = await Promise.all(participantFetches);
        participantResults.forEach(({ participantId, name }) => {
          names[participantId] = name;
        });
        setParticipantNames(names);
        console.log("Successfully loaded matches and participant names");
      } catch (err: any) {
        console.error("Error loading matches:", err);
        const errorMessage = err?.message || "Failed to load matches.";
        setError(`Failed to load matches: ${errorMessage}`);
      } finally {
        setMatchesLoading(false);
      }
    }

    loadMatches();
  }, []);

  // Fetch week data when selected week changes
  useEffect(() => {
    async function loadWeekData() {
      try {
        setLoading(true);
        setError(null);

        const weekNumber = selectedWeek + 1;
        const week = await getWeek(weekNumber);
        setWeekData(week);
      } catch (err) {
        console.error("Error loading week data:", err);
        setError("Failed to load week data.");
      } finally {
        setLoading(false);
      }
    }

    loadWeekData();
  }, [selectedWeek]);

  // Transform matches into calendar format grouped by day
  const activeWeekData = useMemo(() => {
    // Initialize empty schedule for each day
    const schedule: Record<DayKey, PersonAssignment[]> = {
      Sun: [],
      Mon: [],
      Tue: [],
      Wed: [],
      Thurs: [],
      Fri: [],
      Sat: [],
    };

    // Filter matches that should be displayed (for simplicity, show all matches)
    // In production, you might filter by week or date range
    allMatches.forEach((match) => {
      // Get day of week from day_of_call (1-7 = Mon-Sun)
      // Map to 0-6 where 0 = Sun, 1 = Mon, ..., 6 = Sat
      const programDayRaw = match.day_of_call; // 1-7
      const programDay = programDayRaw === 7 ? 0 : programDayRaw; // 0-6 (Sun-Sat)
      const dayKey = DAY_LABELS[programDay];

      // Determine variant based on whether match_id is in weekData.calls
      let variant: "rose" | "green" | "gold" = "gold"; // Default: pending

      if (weekData && weekData.calls.includes(match.id)) {
        variant = "green"; // Completed: at least one participant logged
      } else {
        // Compare program day-of-week to today's day-of-week (both 0-6)
        const today = new Date();
        const todayProgramDay = today.getDay(); // 0-6, 0 = Sunday
        console.log(
          todayProgramDay,
          programDay,
          selectedWeek + 1,
          CURRENT_GLOBAL_WEEK
        );

        // if week has passed
        if (selectedWeek + 1 < CURRENT_GLOBAL_WEEK) {
          variant = "rose"; // Missed: week has passed without logs
        } else if (selectedWeek + 1 === CURRENT_GLOBAL_WEEK) {
          if (programDay < todayProgramDay) {
            variant = "rose"; // Missed: day has passed without logs
          } else if (programDay === todayProgramDay) {
            variant = "gold"; // Pending: today
          }
        }
      }

      // Create assignment with participant names
      const participant1Name =
        participantNames[match.participant1_id] || "Loading...";
      const participant2Name =
        participantNames[match.participant2_id] || "Loading...";

      const assignment: PersonAssignment = {
        names: [participant1Name, participant2Name],
        variant: variant,
      };

      schedule[dayKey].push(assignment);
    });

    return schedule;
  }, [allMatches, weekData, participantNames]);

  return (
    <div className={layoutStyles.page}>
      <Navbar />
      <div className={layoutStyles.surface}>
        <section className={layoutStyles.selectorSection}>
          <WeekSelector
            weeks={Array.from({ length: WEEKS }, (_, i) => `Week ${i + 1}`)}
            selectedWeekIndex={selectedWeek}
            onSelect={setSelectedWeek}
          />
        </section>

        <section
          className={`${layoutStyles.contentSection} ${adminStyles.scheduleSection}`}
        >
          <h2 className={layoutStyles.sectionHeading}>
            Welcome to the dashboard!
          </h2>
          {error && (
            <div
              style={{
                padding: "15px",
                marginBottom: "15px",
                backgroundColor: "#fee",
                color: "#c00",
                borderRadius: "4px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {matchesLoading ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#666",
              }}
            >
              Loading matches...
            </div>
          ) : loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#666",
              }}
            >
              Loading week {selectedWeek + 1} data...
            </div>
          ) : (
            <div className={adminStyles.scheduleCard}>
              <div className={adminStyles.scheduleInner}>
                <div className={adminStyles.dayGrid}>
                  {DAY_LABELS.map((day) => {
                    const assignments = activeWeekData[day] ?? [];
                    return (
                      <div className={adminStyles.dayColumn} key={day}>
                        <div className={adminStyles.dayHeader}>{day}</div>
                        <div className={adminStyles.peopleList}>
                          {assignments.length === 0 ? (
                            <div
                              style={{
                                padding: "10px",
                                color: "#999",
                                fontSize: "0.85rem",
                                fontStyle: "italic",
                              }}
                            >
                              No calls
                            </div>
                          ) : (
                            assignments.map((assignment, index) => (
                              <PersonTag
                                key={`${day}-${index}-${assignment.names.join(
                                  "-"
                                )}`}
                                names={assignment.names}
                                variant={assignment.variant}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!matchesLoading && !loading && allMatches.length === 0 && !error && (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#666",
              }}
            >
              No matches found in the system. Create some matches to see them
              here.
            </div>
          )}

          {/* Legend */}
          {!matchesLoading && !loading && allMatches.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                backgroundColor: "#f9f9f9",
                borderRadius: "8px",
                display: "flex",
                gap: "20px",
                justifyContent: "center",
                fontSize: "0.9rem",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    backgroundColor: "#90EE90",
                    borderRadius: "3px",
                  }}
                ></div>
                <span>Completed (at least 1 log)</span>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    backgroundColor: "#FFD700",
                    borderRadius: "3px",
                  }}
                ></div>
                <span>Pending</span>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    backgroundColor: "#FFB6C1",
                    borderRadius: "3px",
                  }}
                ></div>
                <span>Missed</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
