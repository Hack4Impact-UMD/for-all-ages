import { useState } from 'react'
import WeekSelector from './components/WeekSelector/WeekSelector'
import styles from './Dashboard.module.css'

const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']


export default function Dashboard () {
    const [selectedWeek, setSelectedWeek] = useState(2)
    return (
        <div className={styles.page}>
            <section className={styles.weekSection}>
                <WeekSelector
                    weeks={WEEK_LABELS}
                    selectedWeekIndex={selectedWeek}
                    onSelect={setSelectedWeek}
                />
            </section>
        </div>
    )
}