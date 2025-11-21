import { useState, useEffect, useCallback } from 'react'
import styles from './Dashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import LogCallForm from './components/LogCallForm/LogCallForm'
import Navbar from '../../components/Navbar'
import { useAuth } from '../../auth/AuthProvider'
import { getMatchesByParticipant } from '../../services/matches'
import { getCompletedWeeksForMatch } from '../../services/weeks'

const WEEKS = 20
const CURRENT_GLOBAL_WEEK = 3

type WeekStatus = 'completed' | 'missed' | 'future' | 'current';

export default function UserDashboard () {
    const { user } = useAuth()
    const [selectedWeek, setSelectedWeek] = useState(2)
    const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([])
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const fetchWeekStatuses = useCallback(async () => {
        if (!user) return;

        try {
            const matches = await getMatchesByParticipant(user.uid);
            if (matches.length === 0) {
                setWeekStatuses(Array(WEEKS).fill('future'));
                return;
            }

            const match = matches[0];
            const completedWeeks = await getCompletedWeeksForMatch(match.id);
            const currentDayISO = new Date().getDay() || 7; // 1-7 (Mon-Sun)
            
            const statuses: WeekStatus[] = [];
            for (let i = 1; i <= WEEKS; i++) {
                const weekNum = i;
                // Check if completed
                if (completedWeeks.includes(weekNum)) {
                    statuses.push('completed');
                    continue;
                }

                // Not completed - check logic
                if (weekNum < CURRENT_GLOBAL_WEEK) {
                    // Past week, not completed -> Red
                    statuses.push('missed');
                } else if (weekNum > CURRENT_GLOBAL_WEEK) {
                    // Future week -> Yellow/Future
                    statuses.push('future');
                } else {
                    // Current week
                    // Check day of call
                    if (match.day_of_call < currentDayISO) {
                        // Day has passed -> Red
                        statuses.push('missed');
                    } else {
                        // Day is today or future -> Yellow
                        statuses.push('future'); 
                    }
                }
            }
            setWeekStatuses(statuses);

        } catch (error) {
            console.error("Error fetching week statuses:", error);
        }
    }, [user]);

    useEffect(() => {
        fetchWeekStatuses();
    }, [fetchWeekStatuses, refreshTrigger]);

    const handleLogSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <div className={styles.page}>
            <Navbar
                navItems={[
                    { label: "Dashboard", path: "/user/dashboard" },
                    { label: "Profile", path: "/" }
                ]}
            />
            <div className={styles.surface}>
                <section className={styles.selectorSection}>
                    <WeekSelector
                        weeks={Array.from({ length: WEEKS }, (_, i) => `Week ${i + 1}`)}
                        selectedWeekIndex={selectedWeek}
                        onSelect={setSelectedWeek}
                        statuses={weekStatuses}
                    />
                </section>

                <section className={styles.contentSection}>
                    <h2 className={styles.sectionHeading}>Week {selectedWeek+1}</h2>
                    <LogCallForm 
                        weekNumber={selectedWeek+1} 
                        onSuccess={handleLogSuccess}
                    />
                </section>
            </div>
        </div>
    )
}
