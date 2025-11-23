import { useMemo, useState } from 'react'
import layoutStyles from './Dashboard.module.css'
import adminStyles from './AdminDashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import PersonTag from './components/PersonTag/PersonTag'
import Navbar from '../../components/Navbar'

type DayKey = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thurs' | 'Fri' | 'Sat'
type PersonAssignment = {
    names: string[]
    variant?: 'rose' | 'green' | 'gold'
}

const DAY_LABELS: DayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat']

const WEEKS = 20


//dummy data for admin schedules
const ADMIN_WEEK_SCHEDULES: Record<DayKey, PersonAssignment[]>[] = [
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
    const activeWeekData = useMemo(() => {
        return ADMIN_WEEK_SCHEDULES[selectedWeek] ?? ADMIN_WEEK_SCHEDULES[0]
    }, [selectedWeek])

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
                                                    <PersonTag
                                                        key={`${day}-${index}-${assignment.names.join('-')}`}
                                                        names={assignment.names}
                                                        variant={assignment.variant}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
