import { useEffect, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import Star from '@mui/icons-material/Star';
import layoutStyles from '../Dashboard/Dashboard.module.css';
import styles from './RecapPage.module.css';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

type RecapLog = {
    id: string;
    concerns: string;
    duration: number;
    rating: number;
    uid: string;
    week: number;
};

type Matches = {
    day_of_call: number;
    participant1_id: string;
    participant2_id: string;
    similarity: number;
};

async function fetchLogsByWeek(week: number): Promise<RecapLog[]> {
    const logsRef = collection(db, 'logs');
    const q = query(logsRef, where('week', '==', week));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as RecapLog);
}

async function fetchMatches(): Promise<Matches[]> {
    const matchesRef = collection(db, 'matches');
    const snap = await getDocs(matchesRef);
    return snap.docs.map(d => d.data() as Matches);
}

async function fetchParticipantName(uid: string): Promise<string> {
    try {
        const docRef = doc(db, 'participants', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as { displayName?: string };
            return data.displayName || `Participant ${uid.slice(0, 8)}`;
        }
        return `Participant ${uid.slice(0, 8)}`;
    } catch (error) {
        console.error(`Error fetching participant ${uid}:`, error);
        return `Participant ${uid.slice(0, 8)}`;
    }
}

export default function RecapPage() {
    const [selectedWeek, setSelectedWeek] = useState<number>();
    const [actualWeek, setActualWeek] = useState<number>();
    const [logs, setLogs] = useState<RecapLog[]>([]);
    const [matches, setMatches] = useState<Matches[]>([]);
    const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchMatches().then(setMatches).catch(console.error);
    }, []);

    useEffect(() => {
        const fetchNames = async () => {
            const uniqueUids = Array.from(new Set(logs.map(l => l.uid)));
            const names: Record<string, string> = {};
            await Promise.all(
                uniqueUids.map(async uid => {
                    names[uid] = await fetchParticipantName(uid);
                })
            );
            setParticipantNames(names);
        };
        if (logs.length) fetchNames();
    }, [logs]);

    useEffect(() => {
        const loadProgramWeek = async () => {
            try {
                const docRef = doc(db, 'config', 'programState');
                const snapshot = await getDoc(docRef);
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.week) {
                        setSelectedWeek(data.week);
                        setActualWeek(data.week);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        };
        loadProgramWeek();
    }, []);

    useEffect(() => {
        if (!selectedWeek) return;
        fetchLogsByWeek(selectedWeek).then(setLogs).catch(console.error);
    }, [selectedWeek]);

    const todayWeekday = useMemo(() => {
        if (!selectedWeek || !actualWeek) return undefined;
        if (selectedWeek === actualWeek) return ((new Date().getDay() + 6) % 7) + 1;
        return selectedWeek < actualWeek ? 7 : 1;
    }, [selectedWeek, actualWeek]);

    const participantsWithLogs = useMemo(() => {
        return new Set(logs.map(l => l.uid));
    }, [logs]);

    const checkInData = useMemo(() => {
        if (!todayWeekday || !matches.length) return [];
        let checkedIn = 0, missed = 0, pending = 0;
        matches.forEach(m => {
            const hasLog = participantsWithLogs.has(m.participant1_id) || participantsWithLogs.has(m.participant2_id);
            if (hasLog) checkedIn++;
            else if (m.day_of_call > todayWeekday) pending++;
            else missed++;
        });
        return [
            { name: 'Checked In', count: checkedIn, value: (checkedIn / matches.length) * 100, color: '#7FBC41' },
            { name: 'Missed', count: missed, value: (missed / matches.length) * 100, color: '#F76D6D' },
            { name: 'Pending', count: pending, value: (pending / matches.length) * 100, color: '#EAB419' }
        ];
    }, [matches, todayWeekday, participantsWithLogs]);

    const callLengthData = useMemo(() => {
        const buckets = [
            { name: '0-5 min', min: 0, max: 5 },
            { name: '5-10 min', min: 5, max: 10 },
            { name: '10-15 min', min: 10, max: 15 },
            { name: '15-20 min', min: 15, max: 20 },
            { name: '20+ min', min: 20, max: Infinity }
        ];
        return buckets.map(b => ({
            name: b.name,
            value: logs.filter(l => l.duration >= b.min && l.duration < b.max).length
        }));
    }, [logs]);

    const qualityData = useMemo(() => {
        const total = logs.length;
        const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        logs.forEach(l => { if (ratingCounts[l.rating] !== undefined) ratingCounts[l.rating]++; });
        return [5,4,3,2,1].map(r => ({
            stars: `${r} ${r===1?'Star':'Stars'}`,
            percentage: total ? Math.round((ratingCounts[r]/total)*100) : 0,
            count: ratingCounts[r]
        }));
    }, [logs]);

    const averageRating = useMemo(() => {
        if (!logs.length) return 0;
        return parseFloat((logs.reduce((sum,l)=>sum+l.rating,0)/logs.length).toFixed(1));
    }, [logs]);

    const concernsList = useMemo(() => {
        return logs
            .filter(l => l.concerns && l.concerns.trim() !== '')
            .map(l => ({
                uid: l.uid,
                displayName: participantNames[l.uid] || `Participant ${l.uid.slice(0,8)}`,
                concerns: l.concerns,
                rating: l.rating
            }));
    }, [logs, participantNames]);

    return (
        <div className={layoutStyles.page}>
            <div className={layoutStyles.surface}>
                <div className={styles.header}>
                    <div className={styles.weekSelector}>
                        <label htmlFor="weekSelect" className={styles.weekLabel}>Select Week:</label>
                        <select
                            id="weekSelect"
                            className={styles.weekDropdown}
                            value={selectedWeek}
                            onChange={e => setSelectedWeek(Number(e.target.value))}
                        >
                            {Array.from({length:20},(_,i)=>i+1).map(w=>(
                                <option key={w} value={w}>Week {w}</option>
                            ))}
                        </select>
                    </div>
                    <h1 className={styles.pageTitle}>Week {selectedWeek} Recaps</h1>
                </div>

                <div className={styles.cardRow}>
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Participant Check-in Stats</h2>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={checkInData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value">
                                        {checkInData.map((entry,index)=>(
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className={styles.legend}>
                                {checkInData.map(item=>(
                                    <div key={item.name} className={styles.legendItem}>
                                        <div className={styles.legendColor} style={{backgroundColor:item.color}}></div>
                                        <span className={styles.legendText}>{item.name} - {item.value.toFixed(2)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Length of Participant Calls</h2>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={callLengthData}>
                                    <XAxis dataKey="name" tick={{fontSize:12}}/>
                                    <YAxis tick={{fontSize:12}}/>
                                    <Bar dataKey="value" fill="#127BBE" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Average Quality Rating of Calls</h2>
                        <div className={styles.qualityContent}>
                            <div className={styles.averageRating}>
                                <div className={styles.stars}>
                                    {[1,2,3,4,5].map(s=>(
                                        <Star key={s} className={s<=Math.round(averageRating)?styles.starFilled:styles.starEmpty} />
                                    ))}
                                </div>
                                <p className={styles.ratingText}>{averageRating} out of 5</p>
                            </div>
                            <div className={styles.ratingBars}>
                                {qualityData.map(item=>(
                                    <div key={item.stars} className={styles.ratingRow}>
                                        <span className={styles.ratingLabel}>{item.stars}</span>
                                        <div className={styles.barContainer}>
                                            <div className={styles.barFill} style={{width:`${item.percentage}%`}}></div>
                                        </div>
                                        <span className={styles.percentage}>{item.percentage}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.cardRow}>
                    <div className={styles.cardWide}>
                        <h2 className={styles.cardTitle}>Participant Concerns</h2>
                        <div className={styles.concernsList}>
                            {concernsList.length===0 ? (
                                <p className={styles.emptyState}>No concerns reported this week.</p>
                            ) : concernsList.map((item,index)=>(
                                <div key={index} className={styles.concernItem}>
                                    <div className={styles.concernHeader}>
                                        <span className={styles.concernUser}>{item.displayName}</span>
                                        <div className={styles.concernRating}>
                                            {[...Array(5)].map((_,i)=>(
                                                <Star key={i} className={i<item.rating?styles.starSmallFilled:styles.starSmallEmpty} sx={{fontSize:16}}/>
                                            ))}
                                        </div>
                                    </div>
                                    <p className={styles.concernText}>{item.concerns}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
