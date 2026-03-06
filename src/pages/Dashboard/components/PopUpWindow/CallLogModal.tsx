import { useEffect, useState } from 'react'
import { getLogForParticipantWeek } from '../../../../services/logs'
import type { Match, Logs } from '../../../../types'
import styles from './CallLogModal.module.css'


interface CallLogModalProps {
 match: Match & { id: string }
 participantNames: Record<string, string>
 weekNumber: number
 onClose: () => void
}


export default function CallLogModal({
 match,
 participantNames,
 weekNumber,
 onClose,
}: CallLogModalProps) {
 const [log1, setLog1] = useState<Logs | null>(null)
 const [log2, setLog2] = useState<Logs | null>(null)
 const [loading, setLoading] = useState(true)


 const p1Name = participantNames[match.participant1_id] || match.participant1_id
 const p2Name = participantNames[match.participant2_id] || match.participant2_id


 useEffect(() => {
   async function fetchLogs() {
     try {
       setLoading(true)
       // Fetch logs for both participants individually using existing service
       const [l1, l2] = await Promise.all([
         getLogForParticipantWeek(match.participant1_id, weekNumber),
         getLogForParticipantWeek(match.participant2_id, weekNumber)
       ])
       setLog1(l1)
       setLog2(l2)
     } catch (err) {
       console.error('Error fetching logs:', err)
     } finally {
       setLoading(false)
     }
   }
   fetchLogs()
 }, [match.participant1_id, match.participant2_id, weekNumber])


 const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
   if (e.target === e.currentTarget) onClose()
 }


 // Determine if at least one log exists to mark the call as "completed"
 const isCompleted = !!(log1 || log2)


 return (
   <div className={styles.backdrop} onClick={handleBackdropClick}>
     <div className={styles.modal} role="dialog">
       <button className={styles.closeBtn} onClick={onClose}>✕</button>


       <div className={styles.headerContainer}>
         <div className={styles.headerBox}>
           <h2 className={styles.mainTitle}>Log Call Notes</h2>
           <p className={styles.subTitle}>
             <span className={styles.fromText}>from</span>
             <span className={styles.participantName}> {p1Name} </span>
             <span className={styles.fromText}>and</span>
             <span className={styles.participantName}> {p2Name}</span>
           </p>
         </div>
       </div>


       {loading ? (
         <div className={styles.loadingState}>Loading...</div>
       ) : (
         <div className={styles.body}>
           <div className={styles.leftCol}>
             <section className={styles.section}>
               <h3 className={styles.merriweatherTitle}>Was the call completed this week?</h3>
               <div className={styles.checkboxRow}>
                   <div className={`${styles.square} ${isCompleted ? styles.checked : ''}`} />
                   <span className={styles.interText}>Yes</span>
               </div>
               <div className={styles.checkboxRow}>
                   <div className={`${styles.square} ${!isCompleted ? styles.checked : ''}`} />
                   <span className={styles.interText}>No</span>
               </div>
             </section>


             <section className={styles.section}>
               <h3 className={styles.merriweatherTitle}>Duration (minutes)</h3>
               <DurationRow name={p1Name} duration={log1?.duration} submitted={!!log1} />
               <DurationRow name={p2Name} duration={log2?.duration} submitted={!!log2} />
             </section>


             <section className={styles.section}>
               <h3 className={styles.merriweatherTitle}>Ratings</h3>
               <RatingRow name={p1Name} rating={log1?.rating} submitted={!!log1} />
               <RatingRow name={p2Name} rating={log2?.rating} submitted={!!log2} />
             </section>
           </div>


           <div className={styles.rightCol}>
             <h3 className={styles.merriweatherTitle}>Meeting Notes:</h3>
             <div className={styles.notesArea}>
               <NoteBox name={p1Name} text={log1?.concerns} submitted={!!log1} />
               <NoteBox name={p2Name} text={log2?.concerns} submitted={!!log2} />
             </div>
           </div>
         </div>
       )}
     </div>
   </div>
 )
}


/* ── Sub-components with TypeScript fixes ── */


function DurationRow({ name, duration, submitted }: { name: string; duration?: number | string; submitted: boolean }) {
 return (
   <div className={`${styles.infoRow} ${!submitted ? styles.dimmed : ''}`}>
     <span className={`${styles.infoName} ${styles.interText}`}>{name}</span>
     <div className={styles.durationInputBox}>
       <span className={styles.interText}>{submitted ? duration : "—"}</span>
     </div>
   </div>
 )
}


function RatingRow({ name, rating, submitted }: { name: string; rating?: number; submitted: boolean }) {
 return (
   <div className={`${styles.infoRow} ${!submitted ? styles.dimmed : ''}`}>
     <span className={`${styles.infoName} ${styles.interText}`}>{name}</span>
     <div className={styles.stars}>
       {[1, 2, 3, 4, 5].map((s) => (
         <span key={s} className={`${styles.star} ${submitted && rating && s <= rating ? styles.starFilled : ''}`}>
           ★
         </span>
       ))}
     </div>
   </div>
 )
}


function NoteBox({ name, text, submitted }: { name: string; text?: string; submitted: boolean }) {
 return (
   <div className={`${styles.noteBox} ${!submitted ? styles.dimmed : ''}`}>
     <div className={`${styles.noteName} ${styles.interText}`}>{name}:</div>
     <div className={`${styles.noteText} ${styles.interText}`}>
       {submitted ? (text || "No notes provided.") : "No log submitted."}
     </div>
   </div>
 )
}

