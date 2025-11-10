import React, { useEffect, useRef, useState } from "react";
import styles from "./Event.module.css";

export type EditEventValues = {
  title: string;
  timeText?: string;
  locationText?: string;
  colorHex?: string;
};

interface EditEventProps {
  initial: EditEventValues;
  onSave: (vals: EditEventValues) => void;
  onClose: () => void;
}

export default function EditEvent({
  initial,
  onSave,
  onClose,
}: EditEventProps) {
  const [title, setTitle] = useState(initial.title);
  const [timeText, setTimeText] = useState(initial.timeText ?? "");
  const [locationText, setLocationText] = useState(initial.locationText ?? "");
  const [colorHex, setColorHex] = useState(initial.colorHex ?? "#1a73e8");
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  const handleSave = () => onSave({ title, timeText, locationText, colorHex });

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className={styles.popupBackdrop}
      role="dialog"
      aria-modal="true"
      onKeyDown={onKeyDown}
    >
      <div className={styles.popupCard}>
        <div className={styles.popupHeader}>
          <div className={styles.popupTitle}>Edit event</div>
          <button
            className={styles.popupClose}
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.popupBody}>
          <div className={styles.field}>
            <label className={styles.label}>Title</label>
            <input
              ref={first}
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Time</label>
            <input
              className={styles.input}
              placeholder="All day or 9:00–10:30"
              value={timeText}
              onChange={(e) => setTimeText(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Location</label>
            <input
              className={styles.input}
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Color</label>
            <input
              className={styles.colorInput}
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.popupFooter}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
