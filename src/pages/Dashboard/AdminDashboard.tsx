import { useState, useCallback, useEffect } from 'react'
import layoutStyles from './Dashboard.module.css'
import adminStyles from './AdminDashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import PersonTag from './components/PersonTag/PersonTag'
import Navbar from '../../components/Navbar'
import AdminMatchModal from './components/AdminMatchModal/AdminMatchModal'
import { getAllMatches, type WeekSchedule } from '../../services/matchLogs'

type DayKey = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thurs' | 'Fri' | 'Sat'

const DAY_LABELS: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat']

const WEEKS = 20

// NOTE: selectedWeek is 0-indexed internally (0 = Week 1, 1 = Week 2, etc.)
// When passing to Firestore functions, always use (selectedWeek + 1) for 1-indexed week numbers

const NAV_ITEMS = [
    { label: 'Main', path: '/admin/creator' },
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Profile', path: '/profile' }
]

export default function AdminDashboard () {
    const [selectedWeek, setSelectedWeek] = useState(2)
    const [selectedMatch, setSelectedMatch] = useState<{ names: string[], week: number, variant?: 'rose' | 'green' | 'gold', participantIds?: string[] } | null>(null)
    const [firestoreMatches, setFirestoreMatches] = useState<WeekSchedule | null>(null)

    // Load matches from Firestore when week changes
    useEffect(() => {
        let cancelled = false
        async function loadMatches() {
            try {
                // Pass week number (1-indexed) to compute variant based on log submissions
                const data = await getAllMatches(selectedWeek + 1)
                if (!cancelled) {
                    setFirestoreMatches(data)
                }
            } catch (error) {
                console.error('Failed to load matches from Firestore:', error)
            }
        }
        loadMatches()
        return () => { cancelled = true }
    }, [selectedWeek])

    // Use Firestore data - if no matches, calendar will be blank
    const activeWeekData: WeekSchedule = firestoreMatches ?? {
        Sun: [], Mon: [], Tue: [], Wed: [], Thurs: [], Fri: [], Sat: []
    }

    const handleCloseModal = useCallback(() => {
        setSelectedMatch(null)
    }, [])

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
                                {DAY_LABELS.map((day) => {
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
