import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../auth/AuthProvider';
import { getMatchesByParticipant, getPartnerId, updateMatchDayOfWeek } from '../../services/matches';
import { db } from '../../firebase';
import Navbar from '../../components/Navbar';
import styles from './MatchedDashboard.module.css';
import type { Match } from '../../types';

interface PartnerInfo {
  id: string;
  name: string;
  displayName: string;
  email: string;
  phone_number: string;
  user_type: string;
}

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/user/matched' },
  { label: 'Profile', path: '/profile' },
];

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

export default function MatchedDashboard() {
  const { user, participant, loading: authLoading, participantLoading } = useAuth();
  const [match, setMatch] = useState<(Match & { id: string }) | null>(null);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [concerns, setConcerns] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  let greetingName = 'there';
  if (participant && typeof participant.displayName === 'string') {
    greetingName = participant.displayName;
  } else if (participant && typeof participant.firstName === 'string') {
    greetingName = participant.firstName;
  } else if (user && user.email) {
    greetingName = user.email.split('@')[0];
  }
  
  // Check if current user is a student
  const isStudent = participant && participant.user_type === 'student';

  useEffect(() => {
    async function loadMatchData() {
      if (!user || !user.uid || authLoading || participantLoading) {
        return;
      }

      try {
        setLoading(true);
        
        const matches = await getMatchesByParticipant(user.uid);
        
        if (matches.length === 0) {
          setLoading(false);
          return;
        }

        const userMatch = matches[0];
        setMatch(userMatch);
        setSelectedDay(userMatch.day_of_call);

        const partnerId = getPartnerId(userMatch, user.uid);
        
        const participantRef = doc(db, 'participants', partnerId);
        const participantDoc = await getDoc(participantRef);
        
        if (participantDoc.exists()) {
          const data = participantDoc.data();
          
          const partnerData: PartnerInfo = {
            id: participantDoc.id,
            name: data.name || data.displayName || 'Unknown',
            displayName: data.displayName || data.name || 'Unknown',
            email: data.email || 'Not provided',
            phone_number: data.phone_number || data.phoneNumber || 'Not provided',
            user_type: data.user_type || 'adult',
          };
          setPartner(partnerData);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading match data:', error);
        setLoading(false);
      }
    }

    loadMatchData();
  }, [user, authLoading, participantLoading]);

  const handleFinalizeTime = async () => {
    if (!match) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitMessage(null);

      await updateMatchDayOfWeek(match.id, selectedDay);
      
      setSubmitMessage({ 
        type: 'success', 
        text: 'Meeting time updated successfully!' 
      });
      
      const updatedMatch = {
        ...match,
        day_of_call: selectedDay
      };
      setMatch(updatedMatch);
      
    } catch (error) {
      console.error('Error updating meeting time:', error);
      setSubmitMessage({ 
        type: 'error', 
        text: 'Failed to update meeting time. Please try again.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendConcerns = async () => {
    // Check if concern s field is empty
    if (concerns.trim() === '') {
      setSubmitMessage({ 
        type: 'error', 
        text: 'Please enter your concerns before sending.' 
      });
      return;
    }

    // Log concerns   (in a real app, this would send to admin)
    console.log('Concerns submitted:', concerns);
    
    setSubmitMessage({ 
      type: 'success', 
      text: 'Your concerns have been sent to the admin team!' 
    });
    
    setConcerns('');
  };

  const isLoading = authLoading || participantLoading || loading;

  if (isLoading) {
    return (
      <div className={styles.page}>
        <Navbar navItems={NAV_ITEMS} />
        <div className={styles.surface}>
          <div className={styles.loadingMessage}>Loading your dashboard…</div>
        </div>
      </div>
    );
  }

  if (!match || !partner) {
    return (
      <div className={styles.page}>
        <Navbar navItems={NAV_ITEMS} />
        <div className={styles.surface}>
          <div className={styles.noMatchMessage}>
            <h2>No Match Found</h2>
            <p>You haven't been matched with anyone yet. Please check back later!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Navbar navItems={NAV_ITEMS} />
      <div className={styles.surface}>
        <h1 className={styles.welcomeHeading}>Welcome, {greetingName}!</h1>

        <div className={styles.cardsContainer}>
          {/* Match Information Card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Your Match!!</h2>
            <div className={styles.matchContent}>
              <div className={styles.profileSection}>
                <div className={styles.avatar}>
                  {partner.displayName.charAt(0)}
                </div>
                <h3 className={styles.partnerName}>{partner.displayName}</h3>
              </div>
              
              <div className={styles.contactInfo}>
                <h4 className={styles.contactTitle}>Contact Information:</h4>
                <div className={styles.contactDetails}>
                  <div className={styles.contactItem}>
                    <span className={styles.contactLabel}>Preferred:</span>
                    <span className={styles.contactValue}>{partner.phone_number}</span>
                  </div>
                  <div className={styles.contactItem}>
                    <span className={styles.contactLabel}>Secondary:</span>
                    <span className={styles.contactValue}>{partner.email}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Time Selector Card - Only visible for students */}
          {isStudent && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Set a time for your weekly check in!</h2>
              <div className={styles.timeContent}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Day</label>
                  <select 
                    className={styles.select}
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(Number(e.target.value))}
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  className={styles.finalizeButton}
                  onClick={handleFinalizeTime}
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Finalize Time'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Status Messages */}
        {submitMessage && (
          <div className={`${styles.message} ${styles[submitMessage.type]}`}>
            {submitMessage.text}
          </div>
        )}

        {/* Concerns Card */}
        <div className={styles.concernsCard}>
          <h2 className={styles.cardTitle}>Any Concerns?</h2>
          <textarea
            className={styles.textarea}
            placeholder="Share any concerns or questions you have..."
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            rows={6}
          />
          <button 
            className={styles.sendButton}
            onClick={handleSendConcerns}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

