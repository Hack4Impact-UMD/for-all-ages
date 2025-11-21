import styles from "./LogCallForm.module.css";
import { useState, useEffect } from 'react';
import { useAuth } from '../../../../auth/AuthProvider';
import { getMatchesByParticipant, getPartnerId } from '../../../../services/matches';
import { submitLog, getLogForParticipantWeek } from '../../../../services/logs';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import type { Match, Logs } from '../../../../types';

const defaultForm = {
  duration: undefined as number | undefined,
  rating: undefined as number | undefined,
  concerns: "" as string,
  mode: "edit" as "edit" | "saved",
};

interface LogCallFormProps {
  weekNumber: number;
  onSuccess?: () => void;
}

export default function LogCallForm({ weekNumber, onSuccess }: LogCallFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(defaultForm);
  const [match, setMatch] = useState<(Match & { id: string }) | null>(null);
  const [partnerName, setPartnerName] = useState<string>('Your Partner');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reload match/log when week changes
  useEffect(() => {
    setSuccessMessage(null);
    
    async function loadData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const allMatches = await getMatchesByParticipant(user.uid);

        let matchData: (Match & { id: string }) | null = null;
        
        if (allMatches.length > 0) {
          matchData = allMatches[0];
        }
        
        setMatch(matchData);

        if (matchData) {
          try {
            const partnerId = getPartnerId(matchData, user.uid);
            const partnerRef = doc(db, 'participants', partnerId);
            const partnerDoc = await getDoc(partnerRef);
            
            if (partnerDoc.exists()) {
              const partnerData = partnerDoc.data();
              const name = partnerData.displayName || partnerData.name || partnerData.email || 'Your Partner';
              setPartnerName(name);
            } else {
              setPartnerName('Your Partner');
            }
          } catch (err) {
            console.error('Error fetching partner name:', err);
            setPartnerName('Your Partner');
          }

          const logData = await getLogForParticipantWeek(user.uid, weekNumber);

          if (logData) {
            setFormData({
              duration: logData.duration,
              rating: logData.rating,
              concerns: logData.concerns || "",
              mode: "saved", // Set to saved mode since log already exists
            });
          } else {
            setFormData(defaultForm);
          }
        } else {
          setFormData(defaultForm);
          setPartnerName('');
        }
      } catch (err) {
        console.error('Error loading match/log data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [weekNumber, user]);

  const updateField = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setSuccessMessage(null); // Clear success message when editing
  };

  const handleSubmit = async () => {
    if (!user || !match) {
      setError('Unable to submit: user or match not found');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const logData: Logs = {
        week: weekNumber,
        uid: user.uid,
        duration: formData.duration!,
        rating: formData.rating!,
        concerns: formData.concerns || '',
      };

      await submitLog(logData, match.id);

      // Update form mode to saved
      setFormData(prev => ({ ...prev, mode: "saved" }));
      setSuccessMessage('Call log saved successfully!');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error submitting log:', err);
      setError('Failed to save log. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const disabled = formData.mode === "saved" || saving;

  // Loading state
  if (loading) {
    return (
      <div className={`${styles.container}`}>
        <p>Loading...</p>
      </div>
    );
  }

  // No match for this participant
  if (!match) {
    return (
      <div className={`${styles.container}`}>
        <h1>Log Call Notes</h1>
        <p>No match found for your account.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.container}`}>
      <h1>Log Call Notes - Week {weekNumber}</h1>
      {partnerName && (
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Your partner: <strong>{partnerName}</strong>
        </p>
      )}

      {error && (
        <div style={{ padding: '10px', marginBottom: '10px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: '10px', marginBottom: '10px', backgroundColor: '#efe', color: '#060', borderRadius: '4px' }}>
          {successMessage}
        </div>
      )}

      <div className={styles.columns}>
        <div className={`${styles.left}`}>
          {/* Duration of the call */}
          <section>
            <p>Duration (minutes) <span className={styles.required}>*</span></p>
            <input
              type="number"
              className={styles.durationInput}
              value={formData.duration ?? ""}
              onChange={(e) => updateField("duration", Number(e.target.value))}
              disabled={disabled}
              min="0"
            />
          </section>

          {/* Rating for the Call */}
          <section>
            <p>How would you rate this call? <span className={styles.required}>*</span></p>
            <div className={`${styles.starRating} ${disabled ? styles.disabled : ''}`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  style={{
                    cursor: "pointer",
                    fontSize: "2.5rem",
                    color: star <= (formData.rating ?? 0) ? "#127bbe" : "#ccc",
                  }}
                  onClick={() => {
                    if (!disabled) updateField("rating", formData.rating == star ? undefined : star)
                  }}
                >
                  ★
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className={`${styles.right}`}>
          {/* Concerns */}
          <p>Any concerns or notes:</p>
          <textarea
            className={styles.meetingNotesInput}
            value={formData.concerns}
            onChange={(e) => updateField("concerns", e.target.value)}
            disabled={disabled}
            placeholder="Share any concerns or feedback about the call..."
          />
        </div>
      </div>

      <div>
        {formData.mode == 'edit' ? (
          <button
            disabled={!formData.duration || formData.duration <= 0 || formData.rating == undefined || saving}
            onClick={handleSubmit}
          >
            {saving ? 'Saving...' : 'Submit Log'}
          </button>
        ) : (
          <button onClick={() => updateField("mode", "edit")}>
            Edit Log
          </button>
        )}
      </div>
    </div>
  );
}
