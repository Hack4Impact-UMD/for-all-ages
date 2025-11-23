import { useState } from 'react'
import styles from './Dashboard.module.css'
import WeekSelector from './components/WeekSelector/WeekSelector'
import LogCallForm from './components/LogCallForm/LogCallForm'
import Navbar from '../../components/Navbar'
const WEEKS = 20
export default function UserDashboard () {
    const [selectedWeek, setSelectedWeek] = useState(2)
    

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
                    />
                </section>

                <section className={styles.contentSection}>
                    <h2 className={styles.sectionHeading}>Week {selectedWeek+1}</h2>
                    <LogCallForm 
                        weekNumber={selectedWeek+1} 
                    />
                </section>
            </div>
        </div>
    )
}
