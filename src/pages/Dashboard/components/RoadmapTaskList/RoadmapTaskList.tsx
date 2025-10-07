import styles from './RoadmapTaskList.module.css'

interface RoadmapTaskListProps {
    tasks: string[]
    className?: string
}

export default function RoadmapTaskList ({ tasks, className }: RoadmapTaskListProps) {
    return (
        <div className={`${styles.container} ${className ?? ''}`.trim()}>
            <ul className={styles.list}>
                {tasks.map(task => (
                    <li key={task} className={styles.item}>
                        <span className={styles.bullet} aria-hidden="true" />
                        <span>{task}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
