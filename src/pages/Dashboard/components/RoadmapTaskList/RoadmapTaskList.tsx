import styles from "./RoadmapTaskList.module.css";
import Event from "../Event/Event";

interface RoadmapTaskListProps {
  tasks: string[];
  className?: string;
  colors?: string[]; // optional override for event colors
  onSelect?: (task: string, index: number) => void;
}

export default function RoadmapTaskList({
  tasks,
  className,
  colors,
  onSelect,
}: RoadmapTaskListProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className={`${styles.container} ${className ?? ""}`.trim()}>
        <div className={styles.empty}>No tasks yet</div>
      </div>
    );
  }

  const palette = colors ?? [
    "#fbbc04",
    "#34a853",
    "#1a73e8",
    "#ea4335",
    "#a142f4",
  ];

  return (
    <div className={`${styles.container} ${className ?? ""}`.trim()}>
      <ul className={styles.list} role="list">
        {tasks.map((task, i) => (
          <li key={`${task}-${i}`} className={styles.item}>
            <Event
              name={[task]}
              colorHex={palette[i % palette.length]}
              timeText="All day"
              onClick={() => onSelect?.(task, i)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
