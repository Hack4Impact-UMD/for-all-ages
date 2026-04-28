import { useState, useMemo, useEffect, useRef } from "react";
import styles from "./Dashboard.module.css";
import userStyles from "./UserDashboard.module.css"
import WeekSelector from "./components/WeekSelector/WeekSelector";
import LogCallForm from "./components/LogCallForm/LogCallForm";
import { useAuth } from "../../auth/AuthProvider";
import {
  getCurrentWeek,
  getWeekDateLabel,
  getWeekDateLabelLong,
} from "../../utils/programWeek";
import { getLogsByParticipant } from "../../services/logs";

export default function UserDashboard() {
  const { programState, user } = useAuth();
  const numWeeks = Math.max(1, programState?.numWeeks ?? 20);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [submittedWeeks, setSubmittedWeeks] = useState<Set<number>>(
    () => new Set(),
  );
  const hasInitalized = useRef(false);
  const currentWeek = getCurrentWeek(programState?.startDate, numWeeks);
  const currentWeekIndex = currentWeek - 1;
  const weekLabels = useMemo(
    () => Array.from({ length: numWeeks }, (_, i) => `Week ${i + 1}`),
    [numWeeks]
  );
  const weekDateLabels = useMemo(
    () =>
      Array.from({ length: numWeeks }, (_, i) =>
        getWeekDateLabel(programState?.startDate, i + 1),
      ),
    [numWeeks, programState?.startDate],
  );
  const selectedWeekDateLabel = getWeekDateLabelLong(
    programState?.startDate,
    selectedWeek + 1,
  );
  const weekStatuses = useMemo(
    () =>
      Array.from({ length: numWeeks }, (_, i) => {
        const week = i + 1;
        const hasSubmitted = submittedWeeks.has(week);
        if (week < currentWeek) return hasSubmitted ? "submitted" : "missing";
        if (week === currentWeek) return "current";
        return "future";
      }) as (
        | "submitted"
        | "missing"
        | "future"
        | "current"
      )[],
    [currentWeek, numWeeks, submittedWeeks],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadSubmittedWeeks() {
      if (!user?.uid) {
        setSubmittedWeeks(new Set());
        return;
      }

      try {
        const logs = await getLogsByParticipant(user.uid);
        if (!isMounted) return;
        setSubmittedWeeks(new Set(logs.map((log) => log.week)));
      } catch (error) {
        console.error("Failed to load submitted weeks", error);
        if (isMounted) {
          setSubmittedWeeks(new Set());
        }
      }
    }

    loadSubmittedWeeks();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (programState && !hasInitalized.current) {
      setSelectedWeek(currentWeekIndex);
      hasInitalized.current = true;
    }
  }, [currentWeekIndex, programState])
  
  useEffect(() => {
    setSelectedWeek((prev) => Math.min(prev, numWeeks - 1, currentWeekIndex));
  }, [currentWeekIndex, numWeeks]);

  const handleSelectWeek = (index: number) => {
    if (index > currentWeekIndex) return;
    setSelectedWeek(index);
  };

  const handleLogSuccess = () => {
    setSubmittedWeeks((prev) => {
      const next = new Set(prev);
      next.add(selectedWeek + 1);
      return next;
    });
  };

  return (
    <div className={userStyles.page}>
      <div className={userStyles.surface}>
        <section className={styles.selectorSection}>
          <WeekSelector
            weeks={weekLabels}
            subLabels={weekDateLabels}
            selectedWeekIndex={selectedWeek}
            onSelect={handleSelectWeek}
            statuses={weekStatuses}
            maxSelectableIndex={currentWeekIndex}
            showCurrentIndicator
          />
        </section>

        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionHeading}>Week {selectedWeek + 1}</h2>
            {selectedWeekDateLabel && (
              <p className={styles.sectionSubheading}>
                {selectedWeekDateLabel}
              </p>
            )}
          </div>
          <LogCallForm weekNumber={selectedWeek + 1} onSuccess={handleLogSuccess} />
        </section>
      </div>
    </div>
  );
}
