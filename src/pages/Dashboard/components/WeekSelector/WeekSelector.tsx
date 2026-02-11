// import styles from './WeekSelector.module.css'
import styles from './WeekSelectorGlassy.module.css'

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
    const handleArrowClick = (direction: number) => {
        const currentPage = Math.floor(selectedWeekIndex / weekRange);
        const nextPage = currentPage + (direction > 0 ? 1 : -1);

        const newIndex = direction > 0 ? nextPage * weekRange : Math.min((nextPage + 1) * weekRange - 1, weeks.length - 1);

        if (newIndex < 0 || newIndex >= weeks.length) {
            return
        }
        onSelect(newIndex)
    }

    const weekRange = 5;
    const currentPage = Math.floor(selectedWeekIndex / weekRange);
    const startIndex = currentPage * weekRange;
    const visibleWeeks = weeks.slice(startIndex, startIndex + weekRange);

    return (
        <div className={`${styles.container} ${className ?? ''}`.trim()}>
            <button
                type="button"
                className={styles.arrowButton}
                onClick={() => handleArrowClick(-5)}
                disabled={startIndex === 0}
                aria-label="Previous 5 weeks"
            >
                &lt;
            </button>
            <div className={styles.weekList} role="tablist" aria-label="Select week">
                {visibleWeeks.map((week, index) => {
                    const actualIndex = startIndex + index;
                    const isActive = actualIndex === selectedWeekIndex
                    return (
                        <button
                            key={week}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`${styles.weekButton} ${isActive ? styles.activeWeek : ''}`.trim()}
                            onClick={() => onSelect(actualIndex)}
                        >
                            {week}
                        </button>
                    )
                })}
            </div>
            <button
                type="button"
                className={styles.arrowButton}
                onClick={() => handleArrowClick(5)}
                disabled={startIndex + weekRange >= weeks.length}
                aria-label="Next 5 weeks"
            >
                &gt;
            </button>
        </div>
    )
}
