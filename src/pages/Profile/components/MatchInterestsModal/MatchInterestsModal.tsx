import React from "react";
import styles from "../../Profile.module.css";
import type { Questions } from "../../../../types";

interface MatchInterestsModalProps {
  open: boolean;
  matchName?: string;
  matchInterests?: Questions[];
  onClose: () => void;
}

const MatchInterestsModal: React.FC<MatchInterestsModalProps> = ({
  open,
  matchName,
  matchInterests = [],
  onClose,
}) => {
  if (!open) return null;

  const handleBackdropClick = () => {
    onClose();
  };

  const handleContentClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
  };

  const displayName =
    matchName && matchName.trim().length > 0 ? matchName : "Your match";

  const displayInterests = matchInterests.filter(
    (item) =>
      item &&
      item.title &&
      item.answer !== null &&
      item.answer !== undefined &&
      item.answer !== "",
  );

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={handleContentClick}>
        <div className={styles.modalHeader}>
          <h3>{displayName}&apos;s Interests</h3>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {displayInterests.length === 0 ? (
            <p>No interests response available.</p>
          ) : (
            <div className={styles.interestsList}>
              {displayInterests.map((item, index) => (
                <div key={`${item.title}-${index}`} className={styles.fieldBox}>
                  <div className={styles.boxContent}>
                    <div className={styles.boxHeader}>
                      <span className={styles.boxLabel}>{item.title}</span>
                    </div>
                    <span className={styles.boxValue}>
                      {typeof item.answer === "number"
                        ? item.answer.toString()
                        : item.answer}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchInterestsModal;
