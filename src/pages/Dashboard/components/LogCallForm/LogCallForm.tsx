import styles from "./LogCallForm.module.css";
import { useState } from 'react';
import { Radio, RadioGroup , FormControlLabel, Typography } from "@mui/material";

export default function LogCallForm() {
  const [callComplete, setCallComplete] = useState<boolean | undefined>(undefined);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [satisfactionScore, setSatisfactionScore] = useState<number|undefined>(undefined);
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [mode, setMode] = useState<'edit' | 'saved'>('edit');

  return (
    <div className={`${styles.container}`}>
      <h1>Log Call Notes</h1>

      <div className={styles.columns}>
        <div className={`${styles.left}`}>
          {/* Call Completed */}
          <section>
            <p>Was a call completed this week? <span className={styles.required}>*</span></p>
            <RadioGroup
              className={`${styles.callCompleteGroup} ${mode==='saved' ? styles.disabled : ''}`}
              value={callComplete === undefined ? "" : callComplete ? "yes" : "no"}
              onChange={(e) => setCallComplete(e.target.value === "yes")}
              aria-label="callComplete"
              name="callComplete"
              sx={{ gap: 0.5 }}
            >
              <FormControlLabel
                value="yes"
                disabled={mode === 'saved'} 
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
                        opacity: 0.6,
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
                disabled={mode === 'saved'} 
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
                        opacity: 0.6,
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
            value={duration}
            onChange={(e) => {setDuration(Number(e.target.value))}}
            disabled={mode === 'saved'}
          />
          </section>

          {/* Satisfaction Rating for the Call */}
          <section>
            <p>How satisfied were you with this call? <span className={styles.required}>*</span></p>
            <div className={`${styles.starRating} ${mode==='saved' ? styles.disabled : ''}`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  style={{
                    cursor: "pointer",
                    fontSize: "2.5rem",
                    color: star <= (satisfactionScore ?? 0) ? "#127bbe" : "#ccc",
                  }}
                  onClick={() => {if (mode !== 'saved') setSatisfactionScore(star)}}
                >
                  ★
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className={`${styles.right}`}>
          {/* Meeting Notes */}
          <p>Any Meeting Notes:</p>
          <textarea
            className={styles.meetingNotesInput}
            value={meetingNotes}
            onChange={(e) => setMeetingNotes(e.target.value)}
            disabled={mode === 'saved'}
          />
        </div>
      </div>

      <div>
        {mode=='edit' ? (
          <button
          disabled = {callComplete == undefined || duration == undefined || satisfactionScore == undefined}
            onClick={() => setMode('saved')}
          >Submit Log</button>
        ) : (
          <button
            onClick={() => setMode('edit')}
          >Edit Log</button>
        )}
      </div>
    </div>
  );
}
