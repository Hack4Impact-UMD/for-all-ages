import styles from "./LogCallForm.module.css";
import { useState, useEffect } from 'react';
import { Radio, RadioGroup , FormControlLabel, Typography } from "@mui/material";

const defaultForm = {
  callComplete: undefined as boolean | undefined,
  duration: undefined as number | undefined,
  satisfactionScore: undefined as number | undefined,
  meetingNotes: "" as string,
  mode: "edit" as "edit" | "saved",
};


interface LogCallFormProps {
  weekNumber: number;
};

export default function LogCallForm( { weekNumber }: LogCallFormProps) {
  const [weeklyForms, setWeeklyForms] = useState<{ [week: number]: typeof defaultForm }>({});
  const [formData, setFormData] = useState(defaultForm);
  const [match, setMatch] = useState<(Match & { id: string }) | null>(null);
  const [partnerName, setPartnerName] = useState<string>('Your Tea-mate');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
              const name = partnerData.displayName || partnerData.name || partnerData.email || 'Your Tea-mate';
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
    setWeeklyForms((prev) => ({ ...prev, [weekNumber]: {...updated} }));
  };

  const disabled = formData.mode === "saved";


  return (
    <div className={`${styles.container}`}>
      <h1>Call Log - Week {weekNumber}</h1>
      {partnerName && (
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Your tea-mate: <strong>{partnerName}</strong>
        </p>
      )}
      <b className={styles.warning}>Note: your answers will NOT be shared with your tea-mate</b>

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
          {/* Call Completed */}
          <section>
            <p>Was a call completed this week? <span className={styles.required}>*</span></p>
            <RadioGroup
              className={`${styles.callCompleteGroup} ${formData.mode==='saved' ? styles.disabled : ''}`}
              value={formData.callComplete === undefined ? "" : formData.callComplete ? "yes" : "no"}
              onChange={(e) => updateField("callComplete", e.target.value === "yes")}
              name="callComplete"
              sx={{ gap: 0.5 }}
            >
              <FormControlLabel
                value="yes"
                disabled={disabled} 
                control={
                  <Radio
                    sx={{
                      width: 20,
                      height: 20,
                      padding: 0,
                      "& .MuiSvgIcon-root": {
                        borderRadius: "5px", 
                        color: "#D9D9D9",
                        backgroundColor: "#D9D9D9"
                      },
                      "&.Mui-checked .MuiSvgIcon-root": {
                        backgroundColor: "#0f6bb1",
                        color: "#0f6bb1",
                      },
                      "&.Mui-disabled .MuiSvgIcon-root": {
                        opacity: 0.3,
                      }
                    }}
                  />
                }
                label={
                  <Typography fontFamily="Merriweather" fontSize="1rem" color="#000">
                    Yes
                  </Typography>
                }
              />

              <FormControlLabel
                value="no"
                disabled={disabled} 
                control={
                  <Radio
                    sx={{
                      width: 20,
                      height: 20,
                      padding: 0,
                      "& .MuiSvgIcon-root": {
                        borderRadius: "5px", 
                        color: "#D9D9D9",
                        backgroundColor: "#D9D9D9", 
                      },
                      "&.Mui-checked .MuiSvgIcon-root": {
                        backgroundColor: "#0f6bb1",
                        color: "#0f6bb1",
                      },
                      "&.Mui-disabled .MuiSvgIcon-root": {
                        opacity: 0.3,
                      }
                    }}
                  />
                }
                label={
                  <Typography fontFamily="Merriweather" fontSize="1rem" color="#000">
                    No
                  </Typography>
                }
              />
            </RadioGroup>
          </section>

          {/* Duration of the call */}
          <section>
          <p>Duration (minutes) <span className={styles.required}>*</span></p>
          <input
            type="number"
            className={styles.durationInput}
            value={formData.duration ?? ""}
            onChange={(e) => {updateField("duration", Number(e.target.value))}}
            disabled={disabled}
            min="0"
          />
          </section>

          {/* Satisfaction Rating for the Call */}
          <section>
            <p>How satisfied were you with this call? <span className={styles.required}>*</span></p>
            <div className={`${styles.starRating} ${disabled ? styles.disabled : ''}`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  style={{
                    cursor: "pointer",
                    fontSize: "2.5rem",
                    color: star <= (formData.satisfactionScore ?? 0) ? "#127bbe" : "#ccc",
                  }}
                  onClick={() => {if (!disabled) updateField("satisfactionScore", formData.satisfactionScore == star ? undefined : star)}}
                >
                  ★
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className={`${styles.right}`}>
          {/* Concerns */}
          <p>Do you have any concerns? (Leave empty if not)</p>
          <textarea
            className={styles.meetingNotesInput}
            value={formData.meetingNotes}
            onChange={(e) => updateField("meetingNotes", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        {formData.mode=='edit' ? (
          <button
          disabled = {formData.callComplete == undefined || !formData.duration|| formData.duration <= 0 || formData.satisfactionScore == undefined}
            onClick={() => updateField("mode", "saved")}
          >Submit Log</button>
        ) : (
          <button
            onClick={() => updateField("mode", "edit")}
          >Edit Log</button>
        )}
      </div>
    </div>
  );
}
