import { useState } from 'react'
import styles from './Dashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import RoadmapTaskList from './components/RoadmapTaskList/RoadmapTaskList'

const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']
const WEEK_TASKS = [
    ['Introduce yourself in the forum', 'Review the course outline'],
    ['Complete assessment checklist', 'Upload supporting documents'],
    ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5'],
    ['Schedule mentor session', 'Submit feedback form'],
    ['Prepare for final presentation', 'Share learnings with cohort', 'Celebrate completion!']
]

export default function Dashboard () {
    const [selectedWeek, setSelectedWeek] = useState(2)
    const tasksForWeek = WEEK_TASKS[selectedWeek] ?? []

    return (
        <div className={styles.page}>
            <div className={styles.surface}>
                <section className={styles.selectorSection}>
                    <WeekSelector
                        weeks={WEEK_LABELS}
                        selectedWeekIndex={selectedWeek}
                        onSelect={setSelectedWeek}
                    />
                </section>

                <section className={styles.contentSection}>
                    <h2 className={styles.sectionHeading}>{WEEK_LABELS[selectedWeek]}</h2>
                    <RoadmapTaskList tasks={tasksForWeek} className={styles.taskCard} />
                </section>
            </div>
        </div>
    )
}
