import { useMemo, useState, useEffect, useRef } from 'react'
import layoutStyles from './Dashboard.module.css'
import adminStyles from './AdminDashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import PersonTag from './components/PersonTag/PersonTag'
import { getAllMatches } from '../../services/matches'
import { getWeek } from '../../services/weeks'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import type { Match, Week, DayKey, PersonAssignment } from '../../types'
import { subscribeToProgramState, type ProgramState } from '../../services/programState'
import CallLogModal from './components/PopUpWindow/CallLogModal';

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

export default function AdminDashboard() {
   const [selectedWeek, setSelectedWeek] = useState(0) // 0-indexed (Week 1)
   const [allMatches, setAllMatches] = useState<(Match & { id: string })[]>([])
   const [weekData, setWeekData] = useState<Week | null>(null)
   const [participantNames, setParticipantNames] = useState<Record<string, string>>({})
   const [loading, setLoading] = useState(true)
   const [matchesLoading, setMatchesLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)
   const [programState, setProgramState] = useState<ProgramState | null>(null)
   const [activeMatch, setActiveMatch] = useState<(Match & { id: string }) | null>(null);
   
   // Ref to ensure we only sync the week from Firebase ONCE on initial load
   const hasInitializedWeek = useRef(false);

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

   // ONLY update selected week when programState first loads or when explicitly needed
   useEffect(() => {
       if (programState && typeof programState.week === 'number' && !hasInitializedWeek.current) {
           const nextWeekIndex = Math.max(0, programState.week - 1)
           setSelectedWeek(nextWeekIndex)
           hasInitializedWeek.current = true; // Mark as initialized so user selection isn't overridden
       }
   }, [programState?.week])

   // Fetch all matches once on mount
   useEffect(() => {
     async function loadMatches() {
       try {
         setMatchesLoading(true);
         const matchesData = await getAllMatches();
         setAllMatches(matchesData);

         const uniqueParticipantIds = new Set<string>();
         matchesData.forEach((match) => {
           uniqueParticipantIds.add(match.participant1_id);
           uniqueParticipantIds.add(match.participant2_id);
         });

         const names: Record<string, string> = {};
         const participantFetches = Array.from(uniqueParticipantIds).map(
           async (participantId) => {
             const participantRef = doc(db, "participants", participantId);
             const participantDoc = await getDoc(participantRef);
             return { 
               participantId, 
               name: participantDoc.exists() ? (participantDoc.data().displayName || participantDoc.data().name || "Unknown") : "Unknown" 
             };
           }
         );
         const results = await Promise.all(participantFetches);
         results.forEach(r => names[r.participantId] = r.name);
         setParticipantNames(names);
       } catch (err: any) {
         setError("Failed to load matches.");
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
         const weekNumber = selectedWeek + 1;
         const week = await getWeek(weekNumber);
         setWeekData(week);
       } catch (err) {
         setWeekData(null); // Explicitly set to null if missing
       } finally {
         setLoading(false);
       }
     }
     loadWeekData();
   }, [selectedWeek]);

   // Transform matches into calendar format grouped by day
   const activeWeekData = useMemo(() => {
     const schedule: Record<DayKey, PersonAssignment[]> = {
       Sun: [], Mon: [], Tue: [], Wed: [], Thurs: [], Fri: [], Sat: [],
     };

     const currentGlobalWeek = programState?.week ?? 1;
     const today = new Date();
     const todayDayOfWeek = today.getDay(); // 0-6

     allMatches.forEach((match) => {
       if (match.day_of_call < 1) return; // Don't show on roadmap until user has set a day
       const programDayRaw = match.day_of_call;
       const programDay = programDayRaw === 7 ? 0 : programDayRaw; // 0-6 (Sun-Sat)
       const dayKey = DAY_LABELS[programDay];

       if (!dayKey) return; // Safeguard against bad data

       let variant: "rose" | "green" | "gold" = "gold"; 

       // 1. Check if completed
       if (weekData && weekData.calls.includes(match.id)) {
         variant = "green";
       } else {
         const viewingWeek = selectedWeek + 1;
         
         if (viewingWeek < currentGlobalWeek) {
           variant = "rose"; // Past week missed
         } else if (viewingWeek === currentGlobalWeek) {
           if (programDay < todayDayOfWeek) {
             variant = "rose"; // Past day in current week missed
           }
         }
       }

       schedule[dayKey].push({
         names: [
           participantNames[match.participant1_id] || "Loading...",
           participantNames[match.participant2_id] || "Loading..."
         ],
         variant: variant,
         matchId: match.id,
       });
     });

     return schedule;
   }, [allMatches, weekData, participantNames, selectedWeek, programState?.week]); // Added selectedWeek and programState.week

   return (
    <div className={layoutStyles.page}>
      <div className={layoutStyles.surface}>
        <section className={layoutStyles.selectorSection}>
          <WeekSelector
            weeks={Array.from({ length: WEEKS }, (_, i) => `Week ${i + 1}`)}
            selectedWeekIndex={selectedWeek}
            onSelect={setSelectedWeek}
          />
        </section>

        <section className={`${layoutStyles.contentSection} ${adminStyles.scheduleSection}`}>
          <h2 className={layoutStyles.sectionHeading}>Dashboard</h2>
          {error && <div className={adminStyles.errorBox}>{error}</div>}

          {matchesLoading || loading ? (
            <div className={adminStyles.loading}>Loading Week {selectedWeek + 1}...</div>
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
                            <div className={adminStyles.emptyDay}>No calls</div>
                          ) : (
                            assignments.map((assignment, index) => (
                              <div
                                key={`${day}-${index}`}
                                onClick={() => {
                                  if (assignment.variant !== 'green') return
                                  const match = allMatches.find(m => m.id === assignment.matchId)
                                  if (match) setActiveMatch(match)
                                }}
                                style={{ cursor: assignment.variant === 'green' ? 'pointer' : 'default' }}
                              >
                                <PersonTag names={assignment.names} variant={assignment.variant} />
                              </div>
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

          <h2 className={layoutStyles.sectionHeading}>Pending</h2>
          <div className={adminStyles.pendingCard}>
            <div className={adminStyles.pendingList}>
              {allMatches.filter((m) => m.day_of_call < 1).length === 0 ? (
                <div className={adminStyles.emptyDay}>No pending matches</div>
              ) : (
                allMatches
                  .filter((m) => m.day_of_call < 1)
                  .map((match) => (
                    <PersonTag
                      key={match.id}
                      names={[
                        participantNames[match.participant1_id] || "Loading...",
                        participantNames[match.participant2_id] || "Loading...",
                      ]}
                      variant="gold"
                    />
                  ))
              )}
            </div>
          </div>
        </section>
      </div>

      {activeMatch && (
        <CallLogModal
          match={activeMatch}
          participantNames={participantNames}
          weekNumber={selectedWeek + 1}
          onClose={() => setActiveMatch(null)}
        />
      )}
    </div>
   );
}