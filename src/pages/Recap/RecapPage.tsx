import { useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import Star from '@mui/icons-material/Star'
import Navbar from '../../components/Navbar'
import layoutStyles from '../Dashboard/Dashboard.module.css'
import styles from './RecapPage.module.css'

const checkInData = [
    { name: 'May', value: 24.89, color: '#F76D6D' },
    { name: 'Jun', value: 28.8, color: '#127BBE' },
    { name: 'Jul', value: 24.54, color: '#7FBC41' },
    { name: 'Aug', value: 21.77, color: '#EAB419' }
]

const callLengthData = [
    { name: '0-5 min', value: 45 },
    { name: '5-10 min', value: 38 },
    { name: '10-15 min', value: 32 },
    { name: '15-20 min', value: 28 },
    { name: '20+ min', value: 22 }
]

const qualityData = [
    { stars: '5 Stars', percentage: 80, count: 12 },
    { stars: '4 Stars', percentage: 20, count: 3 },
    { stars: '3 Stars', percentage: 0, count: 0 },
    { stars: '2 Stars', percentage: 0, count: 0 },
    { stars: '1 Star', percentage: 0, count: 0 }
]

export default function RecapPage() {
    const [selectedWeek] = useState(5)

    return (
        <div className={layoutStyles.page}>
            <Navbar
                navItems={[
                    { label: 'Main', path: '/admin/main' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Profile', path: '/admin/profile' }
                ]}
            />
            <div className={layoutStyles.surface}>
                <h1 className={styles.pageTitle}>Week {selectedWeek} Recaps</h1>

                <div className={styles.cardRow}>
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Participant Check-in Stats</h2>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={checkInData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        dataKey="value"
                                    >
                                        {checkInData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className={styles.legend}>
                                {checkInData.map((item) => (
                                    <div key={item.name} className={styles.legendItem}>
                                        <div
                                            className={styles.legendColor}
                                            style={{ backgroundColor: item.color }}
                                        ></div>
                                        <span className={styles.legendText}>
                                            {item.name} - {item.value.toFixed(2)}%
                                        </span>
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
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
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
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star 
                                            key={star} 
                                            className={star <= 4 ? styles.starFilled : styles.starEmpty} 
                                        />
                                    ))}
                                </div>
                                <p className={styles.ratingText}>4.7 out of 5</p>
                            </div>
                            <div className={styles.ratingBars}>
                                {qualityData.map((item) => (
                                    <div key={item.stars} className={styles.ratingRow}>
                                        <span className={styles.ratingLabel}>{item.stars}</span>
                                        <div className={styles.barContainer}>
                                            <div
                                                className={styles.barFill}
                                                style={{ width: `${item.percentage}%` }}
                                            ></div>
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
                        <h2 className={styles.cardTitle}>Participation Distribution</h2>
                        <div className={styles.emptyState}>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

