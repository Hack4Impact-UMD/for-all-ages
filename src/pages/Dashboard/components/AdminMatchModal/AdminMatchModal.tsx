import { useState, useEffect } from 'react';
import styles from './AdminMatchModal.module.css';
import type { MatchLogPair, UserLog } from '../../../../types';
import { getMatchLogs } from '../../../../services/matchLogs';

type MatchVariant = 'rose' | 'green' | 'gold';

// Toggle this to switch between mock data and real Firestore
const USE_MOCK_DATA = false;

interface AdminMatchModalProps {
    onClose: () => void;
    matchData: {
        names: string[];
        week: number;
        variant?: MatchVariant;
        participantIds?: string[]; // UIDs of participants in the match
    };
}

// Mock data fetcher - used when USE_MOCK_DATA is true
async function fetchMockLogs(names: string[], week: number, variant?: MatchVariant): Promise<MatchLogPair> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Generate mock logs based on variant
    // green = both completed, others = simulate partial/no completion
    const logs: UserLog[] = names.map((name, index) => {
        // For green variant, both users have submitted
        if (variant === 'green') {
            return {
                name,
                hasSubmitted: true,
                callComplete: true,
                duration: index === 0 ? 60 : 45,
                satisfactionScore: index === 0 ? 5 : 4,
                meetingNotes: index === 0 
                    ? `It was great chatting with ${names[1] || 'my partner'}!`
                    : `Was nice! Looking forward to the next!`
            };
        }
        
        // For other variants, simulate partial completion (first user submitted, second didn't)
        if (index === 0) {
            return {
                name,
                hasSubmitted: true,
                callComplete: true,
                duration: 60,
                satisfactionScore: 5,
                meetingNotes: `It was great chatting with ${names[1] || 'my partner'}!`
            };
        }
        
        // Second user hasn't submitted
        return {
            name,
            hasSubmitted: false
        };
    });
    
    return {
        matchId: 'mock-match-id',
        weekNumber: week,
        logs
    };
}

// Fetches logs - uses mock or Firestore based on USE_MOCK_DATA flag
async function fetchMatchLogs(
    names: string[], 
    week: number, 
    variant?: MatchVariant,
    participantIds?: string[]
): Promise<MatchLogPair> {
    if (USE_MOCK_DATA || !participantIds || participantIds.length === 0) {
        return fetchMockLogs(names, week, variant);
    }
    
    // READ-ONLY Firestore query using participant UIDs
    return getMatchLogs(participantIds, week);
}

export default function AdminMatchModal({ onClose, matchData }: AdminMatchModalProps) {
    const [logPair, setLogPair] = useState<MatchLogPair | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        
        const loadLogs = async () => {
            setLoading(true);
            const data = await fetchMatchLogs(matchData.names, matchData.week, matchData.variant, matchData.participantIds);
            if (mounted) {
                setLogPair(data);
                setLoading(false);
            }
        };
        
        loadLogs();
        return () => { mounted = false; };
    }, [matchData]);

    const renderStars = (score: number) => {
        return (
            <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <span
                        key={star}
                        className={`${styles.star} ${star <= score ? styles.starFilled : styles.starEmpty}`}
                    >
                        ★
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>×</button>
                
                <header className={styles.header}>
                    <h2 className={styles.title}>Log Call Notes</h2>
                    <p className={styles.subtitle}>
                        from <span className={styles.names}>{matchData.names.join(' and ')}</span>
                    </p>
                </header>

                {loading ? (
                    <div className={styles.loading}>Loading logs...</div>
                ) : logPair ? (
                    <div className={styles.content}>
                        <div className={styles.leftColumn}>
                            {/* Call Completed Section - show per user */}
                            <section className={styles.section}>
                                <p className={styles.label}>Was the call completed this week?</p>
                                <div className={styles.radioGroup}>
                                    {logPair.logs.map((log) => (
                                        <div key={log.name} className={styles.completionRow}>
                                            <span className={styles.completionName}>{log.name}:</span>
                                            {log.hasSubmitted ? (
                                                <div className={styles.radioOptions}>
                                                    <label className={styles.radioLabel}>
                                                        <span className={`${styles.radioBox} ${log.callComplete ? styles.radioChecked : ''}`} />
                                                        Yes
                                                    </label>
                                                    <label className={styles.radioLabel}>
                                                        <span className={`${styles.radioBox} ${!log.callComplete ? styles.radioChecked : ''}`} />
                                                        No
                                                    </label>
                                                </div>
                                            ) : (
                                                <span className={styles.notSubmitted}>Not completed</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Duration Section - show per user */}
                            <section className={styles.section}>
                                <p className={styles.label}>Duration (minutes)</p>
                                <div className={styles.durationContainer}>
                                    {logPair.logs.map((log) => (
                                        <div key={log.name} className={styles.durationRow}>
                                            <span className={styles.durationName}>{log.name}:</span>
                                            {log.hasSubmitted ? (
                                                <div className={styles.durationBox}>
                                                    {log.duration}
                                                </div>
                                            ) : (
                                                <span className={styles.notSubmitted}>—</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Ratings Section */}
                            <section className={styles.section}>
                                <p className={styles.label}>Ratings</p>
                                <div className={styles.ratingsContainer}>
                                    {logPair.logs.map((log) => (
                                        <div key={log.name} className={styles.ratingRow}>
                                            <span className={styles.ratingName}>{log.name}</span>
                                            {log.hasSubmitted ? (
                                                renderStars(log.satisfactionScore ?? 0)
                                            ) : (
                                                <span className={styles.notSubmitted}>Not completed</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        <div className={styles.rightColumn}>
                            {/* Meeting Notes Section */}
                            <section className={styles.section}>
                                <p className={styles.label}>Meeting Notes:</p>
                                <div className={styles.notesContainer}>
                                    {logPair.logs.map((log, index) => (
                                        <div 
                                            key={log.name} 
                                            className={`${styles.noteCard} ${index === 0 ? styles.noteCardPeach : styles.noteCardYellow}`}
                                        >
                                            <p className={styles.noteName}>{log.name}:</p>
                                            <p className={styles.noteText}>
                                                {log.hasSubmitted 
                                                    ? log.meetingNotes 
                                                    : <span className={styles.notSubmittedNote}>Not completed</span>
                                                }
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                ) : (
                    <div className={styles.noData}>No logs found for this match.</div>
                )}
            </div>
        </div>
    );
}
