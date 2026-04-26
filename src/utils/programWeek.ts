// Global function to calculate week number based off of startDate

export function getCurrentWeek(
    startDate: string | null | undefined, 
    numWeeks: number
) : number {

    //Returns 1 if program has not started yet
    if (!startDate) return 1;

    const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;
    const elapsed = Math.floor((Date.now() - new Date(startDate).getTime()) / MS_PER_WEEK);
    return Math.min(Math.max(elapsed + 1, 1), numWeeks);
}

// Function for returning the display label for the week "Apr 19 - Apr 25"
export function getWeekDateLabel(
    startDate: string | null | undefined,
    weekNumber : number
) : string {

    if (!startDate) return `Week ${weekNumber}`;
    const start = new Date(startDate);
    const weekStart = new Date(start.getTime() + ((weekNumber - 1 ) * 7 * 24 * 60 * 60 * 1000));
    const weekEnd = new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000));

    const fmt = (d: Date) => d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});

    return `${fmt(weekStart)} - ${fmt(weekEnd)}`
}

// Returns a long-form date range label g "April 5th - April 11th"
export function getWeekDateLabelLong(
    startDate: string | null | undefined,
    weekNumber: number
): string {
    if (!startDate) return '';
    const start = new Date(startDate);
    const weekStart = new Date(start.getTime() + ((weekNumber - 1) * 7 * 24 * 60 * 60 * 1000));
    const weekEnd = new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000));

    const ordinal = (d: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = d % 100;
        return d + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
    };

    const fmt = (d: Date) =>
        d.toLocaleDateString('en-US', { month: 'long' }) + ' ' + ordinal(d.getDate());

    return `${fmt(weekStart)} - ${fmt(weekEnd)}`;
}