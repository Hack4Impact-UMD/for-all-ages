import { useState } from 'react'
import styles from './Dashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import RoadmapTaskList from './components/RoadmapTaskList/RoadmapTaskList'
import LogCallForm from './components/LogCallForm/LogCallForm'
import Navbar from '../../components/Navbar'
const WEEKS = 20
const WEEK_TASKS = [
    ['Introduce yourself in the forum', 'Review the course outline'],
    ['Complete assessment checklist', 'Upload supporting documents'],
    ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5'],
    ['Schedule mentor session', 'Submit feedback form'],
    ['Prepare for final presentation', 'Share learnings with cohort', 'Celebrate completion!']
]

export default function UserDashboard () {
    const [selectedWeek, setSelectedWeek] = useState(2)
    const tasksForWeek = WEEK_TASKS[selectedWeek] ?? []

    return (
        <div className={styles.page}>
            <Navbar
                navItems={[
                    { label: "Dashboard", path: "/user/dashboard" },
                    { label: "Profile", path: "/profile" }
                ]}
            />
            <div className={styles.surface}>
                <section className={styles.selectorSection}>
                    <WeekSelector
                        weeks={Array.from({ length: WEEKS }, (_, i) => `Week ${i + 1}`)}
                        selectedWeekIndex={selectedWeek}
                        onSelect={setSelectedWeek}
                    />
                </section>

                <section className={styles.contentSection}>
                    <h2 className={styles.sectionHeading}>Week {selectedWeek+1}</h2>
                    <LogCallForm weekNumber={selectedWeek+1} />
                </section>
            </div>
        </div>
    )
}
