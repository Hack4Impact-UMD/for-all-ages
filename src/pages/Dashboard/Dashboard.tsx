import { useState } from 'react'
import WeekSelector from './components/WeekSelector/WeekSelector'
import styles from './Dashboard.module.css'

const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']
const WEEK_TASKS = [
    ['Introduce yourself in the forum', 'Review the course outline'],
    ['Complete assessment checklist', 'Upload supporting documents'],
    ['Task 1', 'Task 2'],
    ['Schedule mentor session', 'Submit feedback form'],
    ['Prepare for final presentation', 'Share learnings with cohort']
]

export default function Dashboard () {
    const [selectedWeek, setSelectedWeek] = useState(2)
    const tasksForWeek = WEEK_TASKS[selectedWeek] ?? []

    return (

        <div className={styles.page}>
            <section className={styles.weekSection}>
                <WeekSelector
                    weeks={WEEK_LABELS}
                    selectedWeekIndex={selectedWeek}
                    onSelect={setSelectedWeek}
                />
            </section>

            <section >
                <h2 >{WEEK_LABELS[selectedWeek]}</h2>
                <ul >
                    {tasksForWeek.map(task => (
                        <li key={task} >
                            <span  aria-hidden="true" />
                            <span>{task}</span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
