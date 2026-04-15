import { useState, useMemo, useEffect } from "react";
import styles from "./Dashboard.module.css";
import WeekSelector from "./components/WeekSelector/WeekSelector";
import LogCallForm from "./components/LogCallForm/LogCallForm";
import { useAuth } from "../../auth/AuthProvider";

export default function UserDashboard() {
  const { programState } = useAuth();
  const numWeeks = Math.max(1, programState?.numWeeks ?? 20);
  const weekLabels = useMemo(
    () => Array.from({ length: numWeeks }, (_, i) => `Week ${i + 1}`),
    [numWeeks]
  );
  const [selectedWeek, setSelectedWeek] = useState(2);

  useEffect(() => {
    setSelectedWeek((prev) => Math.min(prev, numWeeks - 1));
  }, [numWeeks]);

  return (
    <div className={styles.page}>
      <div className={styles.surface}>
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
