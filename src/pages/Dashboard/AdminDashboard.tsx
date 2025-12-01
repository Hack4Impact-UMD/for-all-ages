import { useState, useCallback, useEffect } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import layoutStyles from './Dashboard.module.css'
import adminStyles from './AdminDashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import PersonTag from './components/PersonTag/PersonTag'
import Navbar from '../../components/Navbar'
import AdminMatchModal from './components/AdminMatchModal/AdminMatchModal'
import { getAllMatches } from '../../services/matches'
import type { Log } from '../../types'

// Types
type MatchVariant = 'rose' | 'green' | 'gold'
type DayKey = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thurs' | 'Fri' | 'Sat'

interface PersonAssignment {
    names: string[]
    variant?: MatchVariant
    participantIds: string[]
}

interface SelectedMatch {
    names: string[]
    week: number
    variant?: MatchVariant
    participantIds?: string[]
}

type WeekSchedule = Record<DayKey, PersonAssignment[]>

// Constants
const DAY_KEYS: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat']
const WEEKS = 20
const NAV_ITEMS = [
    { label: 'Main', path: '/admin/creator' },
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Profile', path: '/profile' }
]

const EMPTY_SCHEDULE: WeekSchedule = {
    Sun: [], Mon: [], Tue: [], Wed: [], Thurs: [], Fri: [], Sat: []
}

/** Fetches a participant's display name from Firestore */
async function getParticipantName(uid: string): Promise<string> {
    const snapshot = await getDoc(doc(db, 'participants', uid))
    if (!snapshot.exists()) return 'Unknown'
    
    const data = snapshot.data()
    return data.displayName || data.name || 
           `${data.firstName || ''} ${data.lastName || ''}`.trim() || 
           'Unknown'
}

/** Determines variant based on log submission status */
function getVariant(p1Submitted: boolean, p2Submitted: boolean): MatchVariant {
    if (p1Submitted && p2Submitted) return 'green'
    if (p1Submitted || p2Submitted) return 'rose'
    return 'gold'
}

export default function AdminDashboard() {
    // selectedWeek is 0-indexed (0 = Week 1, 1 = Week 2, etc.)
    const [selectedWeek, setSelectedWeek] = useState(0)
    const [selectedMatch, setSelectedMatch] = useState<SelectedMatch | null>(null)
    const [weekSchedule, setWeekSchedule] = useState<WeekSchedule | null>(null)

    useEffect(() => {
        let cancelled = false
        
        async function loadMatches() {
            try {
                const weekNumber = selectedWeek + 1
                
                const [rawMatches, logsSnapshot] = await Promise.all([
                    getAllMatches(),
                    getDocs(query(collection(db, 'logs'), where('week', '==', weekNumber)))
                ])

                const submittedUids = new Set(
                    logsSnapshot.docs
                        .map(d => (d.data() as Log).uid)
                        .filter(Boolean)
                )

                const result: WeekSchedule = { Sun: [], Mon: [], Tue: [], Wed: [], Thurs: [], Fri: [], Sat: [] }

                const assignments = await Promise.all(
                    rawMatches.map(async (m) => {
                        const [name1, name2] = await Promise.all([
                            getParticipantName(m.participant1_id),
                            getParticipantName(m.participant2_id),
                        ])

                        return {
                            dayKey: DAY_KEYS[m.day_of_call] ?? 'Sun',
                            assignment: {
                                names: [name1, name2],
                                variant: getVariant(
                                    submittedUids.has(m.participant1_id),
                                    submittedUids.has(m.participant2_id)
                                ),
                                participantIds: [m.participant1_id, m.participant2_id],
                            } as PersonAssignment
                        }
                    })
                )

                for (const { dayKey, assignment } of assignments) {
                    result[dayKey].push(assignment)
                }

                if (!cancelled) setWeekSchedule(result)
            } catch (error) {
                console.error('Failed to load matches:', error)
            }
        }
        
        loadMatches()
        return () => { cancelled = true }
    }, [selectedWeek])

    const activeWeekData = weekSchedule ?? EMPTY_SCHEDULE

    const handleCloseModal = useCallback(() => setSelectedMatch(null), [])

    return (
        <div className={layoutStyles.page}>
            <Navbar navItems={NAV_ITEMS} />
            <div className={layoutStyles.surface}>
                <section className={layoutStyles.selectorSection}>
                    <WeekSelector
                        weeks={Array.from({ length: WEEKS }, (_, i) => `Week ${i + 1}`)}
                        selectedWeekIndex={selectedWeek}
                        onSelect={setSelectedWeek}
                    />
                </section>

                <section className={`${layoutStyles.contentSection} ${adminStyles.scheduleSection}`}>
                    <div className={adminStyles.scheduleCard}>
                        <div className={adminStyles.scheduleInner}>
                            <div className={adminStyles.dayGrid}>
                                {DAY_KEYS.map((day) => {
                                    const assignments = activeWeekData[day] ?? []
                                    return (
                                        <div className={adminStyles.dayColumn} key={day}>
                                            <div className={adminStyles.dayHeader}>{day}</div>
                                            <div className={adminStyles.peopleList}>
                                                {assignments.map((assignment, index) => (
                                                    <div 
                                                        key={`${day}-${index}-${assignment.names.join('-')}`}
                                                        className={adminStyles.matchWrapper}
                                                        onClick={() => setSelectedMatch({ 
                                                            names: assignment.names, 
                                                            week: selectedWeek + 1, 
                                                            variant: assignment.variant,
                                                            participantIds: assignment.participantIds
                                                        })}
                                                    >
                                                        <PersonTag
                                                            names={assignment.names}
                                                            variant={assignment.variant}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </section>
                {selectedMatch && (
                    <AdminMatchModal 
                        onClose={handleCloseModal} 
                        matchData={selectedMatch} 
                    />
                )}
            </div>
        </div>
    )
}
