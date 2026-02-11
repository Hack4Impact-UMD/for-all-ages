import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import styles from './AdminMatchModal.module.css';
import type { MatchLogPair, Log, UserLog } from '../../../../types';

type MatchVariant = 'rose' | 'green' | 'gold';

interface AdminMatchModalProps {
    onClose: () => void;
    matchData: {
        names: string[];
        week: number;
        variant?: MatchVariant;
        participantIds?: string[]; // UIDs of participants in the match
    };
}

/** Fetches a participant's display name from Firestore */
async function getParticipantName(uid: string): Promise<string> {
    const docRef = doc(db, 'participants', uid);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        const data = snapshot.data();
        return data.displayName || data.name || 
               `${data.firstName || ''} ${data.lastName || ''}`.trim() || 
               'Unknown';
    }
    return 'Unknown';
}

export default function AdminMatchModal({ onClose, matchData }: AdminMatchModalProps) {
    const [logPair, setLogPair] = useState<MatchLogPair | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        
        const loadLogs = async () => {
            // If no participantIds, we can't fetch logs from Firestore
            if (!matchData.participantIds || matchData.participantIds.length === 0) {
                setLogPair(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const logsRef = collection(db, 'logs');
                
                // Fetch logs for each participant
                const logs: UserLog[] = await Promise.all(
                    matchData.participantIds.map(async (uid) => {
                        const q = query(
                            logsRef,
                            where('uid', '==', uid),
                            where('week', '==', matchData.week)
                        );
                        
                        const snapshot = await getDocs(q);
                        const name = await getParticipantName(uid);
                        
                        if (!snapshot.empty) {
                            const data = snapshot.docs[0].data() as Log;
                            return {
                                name,
                                hasSubmitted: true,
                                callComplete: true,
                                duration: data.duration,
                                satisfactionScore: data.rating,
                                meetingNotes: data.concerns
                            };
                        }
                        
                        return { name, hasSubmitted: false };
                    })
                );

                if (mounted) {
                    setLogPair({
                        matchId: matchData.participantIds.join('-'),
                        weekNumber: matchData.week,
                        logs
                    });
                }
            } catch (error) {
                console.error('Failed to load match logs:', error);
                if (mounted) {
                    setLogPair(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
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
