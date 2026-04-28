import { useState, useMemo, useEffect, useRef } from "react";
import styles from "./Dashboard.module.css";
import userStyles from "./UserDashboard.module.css"
import WeekSelector from "./components/WeekSelector/WeekSelector";
import LogCallForm from "./components/LogCallForm/LogCallForm";
import { useAuth } from "../../auth/AuthProvider";
import { getCurrentWeek } from "../../utils/programWeek";

export default function UserDashboard() {
  const { programState } = useAuth();
  const numWeeks = Math.max(1, programState?.numWeeks ?? 20);
  const weekLabels = useMemo(
    () => Array.from({ length: numWeeks }, (_, i) => `Week ${i + 1}`),
    [numWeeks]
  );
  const [selectedWeek, setSelectedWeek] = useState(0);
  const hasInitalized = useRef(false);


  useEffect(() => {
    if (programState && !hasInitalized.current) {
      const week = getCurrentWeek(programState.startDate, programState.numWeeks ?? 20)
      setSelectedWeek(week - 1);
      hasInitalized.current = true;
    }
  }, [programState])
  
  useEffect(() => {
    setSelectedWeek((prev) => Math.min(prev, numWeeks - 1));
  }, [numWeeks]);

  return (
    <div className={userStyles.page}>
      <div className={userStyles.surface}>
        <section className={styles.selectorSection}>
          <WeekSelector
            weeks={weekLabels}
            selectedWeekIndex={selectedWeek}
            onSelect={setSelectedWeek}
          />
        </section>

        <section className={styles.contentSection}>
          <h2 className={styles.sectionHeading}>Week {selectedWeek + 1}</h2>
          <LogCallForm weekNumber={selectedWeek + 1} />
        </section>
      </div>
    </div>
  );
}
