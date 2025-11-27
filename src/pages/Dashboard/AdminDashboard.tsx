import { useMemo, useState, useCallback, useEffect } from 'react'
import layoutStyles from './Dashboard.module.css'
import adminStyles from './AdminDashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import PersonTag from './components/PersonTag/PersonTag'
import Navbar from '../../components/Navbar'
import AdminMatchModal from './components/AdminMatchModal/AdminMatchModal'
import { getAllMatches, type WeekSchedule, type PersonAssignment } from '../../services/matchLogs'

type DayKey = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thurs' | 'Fri' | 'Sat'

// Extended type for dummy data (without participantIds)
type DummyPersonAssignment = {
    names: string[]
    variant?: 'rose' | 'green' | 'gold'
}

const DAY_LABELS: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat']

const WEEKS = 20


// Dummy data for admin schedules (fallback when Firestore has no matches)
const ADMIN_WEEK_SCHEDULES: Record<DayKey, DummyPersonAssignment[]>[] = [
    {
        Sun: [{ names: ['Jane', 'Mary'], variant: 'rose' }],
        Mon: [{ names: ['Jane', 'Mary'], variant: 'green' }],
        Tue: [{ names: ['Jane', 'Mary'], variant: 'rose' }],
        Wed: [
            { names: ['Jane', 'Mary'], variant: 'gold' },
            { names: ['Jane', 'Mary'], variant: 'green' }
        ],
        Thurs: [{ names: ['Jane', 'Mary'], variant: 'gold' }],
        Fri: [{ names: ['Jane', 'Mary'], variant: 'gold' }],
        Sat: [{ names: ['Jane', 'Mary'], variant: 'gold' }]
    },
    {
        Sun: [{ names: ['Jane', 'Mary'], variant: 'rose' }],
        Mon: [{ names: ['Mary'], variant: 'green' }],
        Tue: [{ names: ['Jane'], variant: 'rose' }],
        Wed: [{ names: ['Mary'], variant: 'green' }],
        Thurs: [{ names: ['Jane'], variant: 'gold' }],
        Fri: [{ names: ['Mary'], variant: 'gold' }],
        Sat: []
    },
    {
        Sun: [
            { names: ['Jane', 'Mary'], variant: 'rose' },
            { names: ['Jane', 'Mary'], variant: 'rose' }
        ],
        Mon: [{ names: ['Jane', 'Mary'], variant: 'green' }],
        Tue: [
            { names: ['Jane', 'Mary'], variant: 'rose' },
            { names: ['Jane', 'Mary'], variant: 'green' }
        ],
        Wed: [
            { names: ['Jane', 'Mary'], variant: 'gold' },
            { names: ['Jane', 'Mary'], variant: 'green' },
            { names: ['Jane', 'Mary'], variant: 'gold' }
        ],
        Thurs: [{ names: ['Jane', 'Mary'], variant: 'gold' }],
        Fri: [
            { names: ['Jane', 'Mary'], variant: 'gold' },
            { names: ['Jane', 'Mary'], variant: 'gold' }
        ],
        Sat: [
            { names: ['Jane', 'Mary'], variant: 'gold' },
            { names: ['Jane', 'Mary'], variant: 'gold' }
        ]
    },
    {
        Sun: [],
        Mon: [],
        Tue: [{ names: ['Jane', 'Mary'], variant: 'green' }],
        Wed: [{ names: ['Jane', 'Mary'], variant: 'gold' }],
        Thurs: [{ names: ['Jane', 'Mary'], variant: 'gold' }],
        Fri: [{ names: ['Jane', 'Mary'], variant: 'gold' }],
        Sat: []
    },
    {
        Sun: [],
        Mon: [{ names: ['Jane', 'Mary'], variant: 'green' }],
        Tue: [],
        Wed: [{ names: ['Jane', 'Mary'], variant: 'gold' }],
        Thurs: [],
        Fri: [{ names: ['Jane', 'Mary'], variant: 'gold' }],
        Sat: [{ names: ['Jane', 'Mary'], variant: 'rose' }]
    }
]

const NAV_ITEMS = [
    { label: 'Main', path: '/admin/creator' },
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Profile', path: '/profile' }
]

export default function AdminDashboard () {
    const [selectedWeek, setSelectedWeek] = useState(2)
    const [selectedMatch, setSelectedMatch] = useState<{ names: string[], week: number, variant?: 'rose' | 'green' | 'gold', participantIds?: string[] } | null>(null)
    const [firestoreMatches, setFirestoreMatches] = useState<WeekSchedule | null>(null)

    // Load matches from Firestore on mount
    useEffect(() => {
        let cancelled = false
        async function loadMatches() {
            try {
                const data = await getAllMatches()
                if (!cancelled) {
                    setFirestoreMatches(data)
                }
            } catch (error) {
                console.error('Failed to load matches from Firestore:', error)
            }
        }
        loadMatches()
        return () => { cancelled = true }
    }, [])

    // Use Firestore data if available, otherwise fall back to dummy data
    const activeWeekData = useMemo(() => {
        // Check if Firestore has any matches
        if (firestoreMatches) {
            const hasAnyMatches = Object.values(firestoreMatches).some(day => day.length > 0)
            if (hasAnyMatches) {
                return firestoreMatches
            }
        }
        // Fall back to dummy data
        return ADMIN_WEEK_SCHEDULES[selectedWeek] ?? ADMIN_WEEK_SCHEDULES[0]
    }, [selectedWeek, firestoreMatches])

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
                                                {assignments.map((assignment, index) => {
                                                    // Type guard: check if assignment has participantIds (from Firestore)
                                                    const participantIds = 'participantIds' in assignment 
                                                        ? (assignment as PersonAssignment).participantIds 
                                                        : undefined
                                                    
                                                    return (
                                                    <div 
                                                        key={`${day}-${index}-${assignment.names.join('-')}`}
                                                        className={adminStyles.matchWrapper}
                                                        onClick={() => setSelectedMatch({ 
                                                            names: assignment.names, 
                                                            week: selectedWeek + 1, 
                                                            variant: assignment.variant,
                                                            participantIds
                                                        })}
                                                    >
                                                        <PersonTag
                                                            names={assignment.names}
                                                            variant={assignment.variant}
                                                        />
                                                    </div>
                                                    )
                                                })}
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
