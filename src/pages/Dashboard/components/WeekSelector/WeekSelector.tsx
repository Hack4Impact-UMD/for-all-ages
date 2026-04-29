import styles from './WeekSelectorGlassy.module.css'

type WeekStatus =
    | 'completed'
    | 'missed'
    | 'future'
    | 'current'
    | 'submitted'
    | 'missing'

interface WeekSelectorProps {
    weeks: string[]
    subLabels?: string[]
    selectedWeekIndex: number
    onSelect: (index: number) => void
    className?: string
    statuses?: WeekStatus[]
    maxSelectableIndex?: number
    showCurrentIndicator?: boolean
}

export default function WeekSelector ({
    weeks,
    subLabels,
    selectedWeekIndex,
    onSelect,
    className,
    statuses = [],
    maxSelectableIndex,
    showCurrentIndicator = false
}: WeekSelectorProps) {
    const handleArrowClick = (direction: number) => {
        const currentPage = Math.floor(selectedWeekIndex / weekRange);
        const nextPage = currentPage + (direction > 0 ? 1 : -1);

        const newIndex = direction > 0 ? nextPage * weekRange : Math.min((nextPage + 1) * weekRange - 1, weeks.length - 1);

        if (
            newIndex < 0 ||
            newIndex >= weeks.length ||
            (typeof maxSelectableIndex === 'number' && newIndex > maxSelectableIndex)
        ) {
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
                &#8249;
            </button>
            <div className={styles.weekList} role="tablist" aria-label="Select week">
                {visibleWeeks.map((week, index) => {
                    const actualIndex = startIndex + index;
                    const isActive = actualIndex === selectedWeekIndex
                    const status = statuses[actualIndex] || 'future';
                    const showCheckmark =
                        status === 'completed' ||
                        status === 'submitted'
                    const subLabel = subLabels?.[actualIndex]
                    const isDisabled =
                        typeof maxSelectableIndex === 'number' &&
                        actualIndex > maxSelectableIndex
                    const isCurrent = status === 'current'

                    return (
                        <button
                            key={actualIndex}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`${styles.weekButton} ${isActive ? styles.activeWeek : ''} ${styles[status]}`.trim()}
                            disabled={isDisabled}
                            onClick={() => onSelect(actualIndex)}
                        >
                            {subLabel ? (
                                <span className={styles.weekButtonInner}>
                                    <span className={styles.weekButtonTop}>
                                        <span className={styles.weekLabel}>{week}</span>
                                        {showCurrentIndicator && isCurrent && (
                                            <span className={styles.currentIndicator}>Current</span>
                                        )}
                                        {showCheckmark && (
                                            <span className={styles.checkmark} aria-hidden="true">✓</span>
                                        )}
                                    </span>
                                    <span className={styles.weekSubLabel}>{subLabel}</span>
                                </span>
                            ) : (
                                <>
                                    <span className={styles.weekLabel}>{week}</span>
                                    {showCurrentIndicator && isCurrent && (
                                        <span className={styles.currentIndicator}>Current</span>
                                    )}
                                    {showCheckmark && (
                                        <span className={styles.checkmark} aria-hidden="true">✓</span>
                                    )}
                                </>
                            )}
                        </button>
                    )
                })}
            </div>
            <button
                type="button"
                className={styles.arrowButton}
                onClick={() => handleArrowClick(5)}
                disabled={
                    startIndex + weekRange >= weeks.length ||
                    (typeof maxSelectableIndex === 'number' &&
                        startIndex + weekRange > maxSelectableIndex)
                }
                aria-label="Next 5 weeks"
            >
                &#8250;
            </button>
        </div>
    )
}
