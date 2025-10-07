import styles from './WeekSelector.module.css'

interface WeekSelectorProps {
    weeks: string[]
    selectedWeekIndex: number
    onSelect: (index: number) => void
    className?: string
}

export default function WeekSelector ({
    weeks,
    selectedWeekIndex,
    onSelect,
    className
}: WeekSelectorProps) {
    const handleArrowClick = (direction: -1 | 1) => {
        const nextIndex = selectedWeekIndex + direction
        if (nextIndex < 0 || nextIndex >= weeks.length) {
            return
        }
        onSelect(nextIndex)
    }

    return (
        <div className={`${styles.container} ${className ?? ''}`.trim()}>
            <button
                type="button"
                className={styles.arrowButton}
                onClick={() => handleArrowClick(-1)}
                disabled={selectedWeekIndex === 0}
                aria-label="Previous week"
            >
                &lt;
            </button>
            <div className={styles.weekList} role="tablist" aria-label="Select week">
                {weeks.map((week, index) => {
                    const isActive = index === selectedWeekIndex
                    return (
                        <button
                            key={week}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`${styles.weekButton} ${isActive ? styles.activeWeek : ''}`.trim()}
                            onClick={() => onSelect(index)}
                        >
                            {week}
                        </button>
                    )
                })}
            </div>
            <button
                type="button"
                className={styles.arrowButton}
                onClick={() => handleArrowClick(1)}
                disabled={selectedWeekIndex === weeks.length - 1}
                aria-label="Next week"
            >
                &gt;
            </button>
        </div>
    )
}
