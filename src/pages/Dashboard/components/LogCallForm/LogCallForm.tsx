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

  useEffect(() => {
    setFormData(weeklyForms[weekNumber] || {...defaultForm});
  }, [weekNumber]);

  const updateField = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setWeeklyForms((prev) => ({ ...prev, [weekNumber]: {...updated} }));
  };

  const disabled = formData.mode === "saved";


  return (
    <div className={`${styles.container}`}>
      <h1>Log Call Notes</h1>

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
          {/* Meeting Notes */}
          <p>Any Meeting Notes:</p>
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
